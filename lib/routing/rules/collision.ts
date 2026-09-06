import {
  distanceSegmentToRect,
  distanceSegmentToSegment,
  segmentHitsRect,
  segmentsCross,
  segmentsIntersect,
  segmentsOverlap,
  type Rect,
  type Segment,
} from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';

/**
 * WP-3 (#391): Kollisionsmodell — Schicht 2 (Routing Rules).
 *
 * EIN Modell für beide Pässe: der ELK-Pass (WP-4) und der A*-Pass (WP-6)
 * konsumieren dieselbe Klassifikation — kein Router besitzt eine eigene
 * Definition von Kollisionen oder Abständen (ROUTING-V2.md §4, ADR 0009).
 *
 * | Typ                              | Klasse     |
 * |----------------------------------|------------|
 * | Edge × Node                      | hard       |
 * | Edge × Edge — Overlap/kollinear  | hard       |
 * | Edge × Edge — Crossing           | soft       |
 * | Clearance-Verletzung             | weighted   |
 * | keine Kollision                  | none       |
 */

/** Kollisionsklasse — Konsequenz siehe `RoutingConstraint`. */
export type CollisionClass = 'hard' | 'soft' | 'weighted' | 'none';

/** Art des Befunds (für Hop-Rendering, Kostenmodell und Diagnose). */
export type CollisionKind = 'edge-node' | 'edge-edge-overlap' | 'edge-edge-crossing' | 'clearance' | 'none';

/** Wie ein Router die Klasse zu interpretieren hat. */
export type RoutingConstraint = {
  /** hard = verboten (A*: Infinity, ELK: unzulässig), soft = minimieren, weighted = Kosten. */
  class: CollisionClass;
  kind: CollisionKind;
  /**
   * Bei `weighted`: gemessener Abstand und geforderte Mindest-Clearance —
   * das Kostenmodell (WP-6) leitet daraus die Straffe ab, ELK sein Spacing.
   */
  distance?: number;
  requiredClearance?: number;
};

const NONE: RoutingConstraint = { class: 'none', kind: 'none' };

/**
 * Klassifiziert ein Kanten-Segment gegen ein Node-Hindernis.
 *
 * `obstacle` ist die fertige Hindernis-Box (Node ∪ Handle-Ausrisse,
 * `inflateObstacle` OHNE Clearance-Aufschlag) — die Clearance-Bewertung
 * übernimmt diese Funktion selbst, damit hard und weighted aus derselben
 * Quelle kommen.
 */
export function classifySegmentAgainstNode(
  segment: Segment,
  obstacle: Rect,
  clearance: number = ROUTING_TOKENS.cableClearance
): RoutingConstraint {
  if (segmentHitsRect(segment[0], segment[1], obstacle)) {
    return { class: 'hard', kind: 'edge-node' };
  }
  const distance = distanceSegmentToRect(segment, obstacle);
  if (distance < clearance) {
    return { class: 'weighted', kind: 'clearance', distance, requiredClearance: clearance };
  }
  return NONE;
}

/**
 * Klassifiziert zwei Kanten-Segmente verschiedener Kanten gegeneinander.
 *
 * Reihenfolge der Prüfung ist Teil des Vertrags: Overlap (hard) schlägt
 * Crossing (soft) schlägt Clearance (weighted). Touch (Berührung ohne
 * echte Kreuzung, z. B. Fan-Out am gemeinsamen Handle) ist KEIN Overlap
 * und KEIN Crossing — er fällt in die Clearance-Bewertung (Abstand 0 ⇒
 * weighted), denn Bündel-Lanes am Port sind legitim und werden über
 * Kosten, nicht Verbote gesteuert.
 */
export function classifySegmentAgainstSegment(
  a: Segment,
  b: Segment,
  clearance: number = ROUTING_TOKENS.cableClearance
): RoutingConstraint {
  if (segmentsOverlap(a, b)) {
    return { class: 'hard', kind: 'edge-edge-overlap' };
  }
  if (segmentsCross(a, b)) {
    return { class: 'soft', kind: 'edge-edge-crossing' };
  }
  if (segmentsIntersect(a, b)) {
    // Touch: Berührung ohne echte Kreuzung.
    return { class: 'weighted', kind: 'clearance', distance: 0, requiredClearance: clearance };
  }
  const distance = distanceSegmentToSegment(a, b);
  if (distance < clearance) {
    return { class: 'weighted', kind: 'clearance', distance, requiredClearance: clearance };
  }
  return NONE;
}

/** Eingabe für die generische Klassifikation. */
export type CollisionQuery =
  | { type: 'edge-node'; segment: Segment; obstacle: Rect; clearance?: number }
  | { type: 'edge-edge'; a: Segment; b: Segment; clearance?: number };

/** Gemeinsamer Einstiegspunkt — beide Pässe rufen ausschließlich hierüber. */
export function classifyCollision(query: CollisionQuery): RoutingConstraint {
  if (query.type === 'edge-node') {
    return classifySegmentAgainstNode(query.segment, query.obstacle, query.clearance);
  }
  return classifySegmentAgainstSegment(query.a, query.b, query.clearance);
}

// ---------------------------------------------------------------------------
// Domain Rules (Schicht 3) — fachliche Trennregeln.
// ---------------------------------------------------------------------------

/** Fachdomäne einer Trasse (erweiterbar: gas, heat, …). */
export type RoutingDomain = 'electrical' | 'water' | 'dc12' | 'ac230';

export type DomainSeparationRule = { minimumClearance: number };

export type DomainSeparationRules = Partial<
  Record<RoutingDomain, Partial<Record<RoutingDomain, DomainSeparationRule>>>
>;

/**
 * Paar-Regeln der Domänentrennung (ROUTING-V2.md §4.2). Die WERTE kommen
 * aus den Tokens (WP-1); die PAARE sind Domänenlogik und leben genau hier —
 * nicht in der Geometrie-Schicht. Erweiterbar: gas ↔ electrical,
 * heat ↔ cable.
 */
export function buildDomainSeparationRules(tokens: RoutingTokens = ROUTING_TOKENS): DomainSeparationRules {
  return {
    electrical: {
      water: { minimumClearance: tokens.crossDomainSpacing },
    },
    ac230: {
      dc12: { minimumClearance: tokens.crossDomainSpacing },
    },
  };
}

export const domainSeparationRules: DomainSeparationRules = buildDomainSeparationRules();

/** Ober-Domäne für Regel-Lookups: dc12/ac230 sind elektrische Unterdomänen. */
const parentDomain = (d: RoutingDomain): RoutingDomain | null =>
  d === 'dc12' || d === 'ac230' ? 'electrical' : null;

/**
 * Geforderte Clearance zwischen zwei Domänen: das Maximum aus der
 * Basis-Clearance und allen zutreffenden Paar-Regeln (symmetrisch,
 * inkl. Ober-Domänen — ac230 ↔ water erbt electrical ↔ water).
 */
export function requiredClearanceBetween(
  a: RoutingDomain,
  b: RoutingDomain,
  rules: DomainSeparationRules = domainSeparationRules,
  tokens: RoutingTokens = ROUTING_TOKENS
): number {
  let clearance = tokens.cableClearance;
  const candidatesA = [a, parentDomain(a)].filter((d): d is RoutingDomain => d !== null);
  const candidatesB = [b, parentDomain(b)].filter((d): d is RoutingDomain => d !== null);
  for (const da of candidatesA) {
    for (const db of candidatesB) {
      const rule = rules[da]?.[db] ?? rules[db]?.[da];
      if (rule) clearance = Math.max(clearance, rule.minimumClearance);
    }
  }
  return clearance;
}

/**
 * Domänenbewusste Kanten-Klassifikation: wie
 * `classifySegmentAgainstSegment`, aber mit der Paar-Regel-Clearance der
 * beiden Domänen als Schwelle.
 */
export function classifyDomainAwareSegments(
  a: { segment: Segment; domain: RoutingDomain },
  b: { segment: Segment; domain: RoutingDomain },
  rules: DomainSeparationRules = domainSeparationRules,
  tokens: RoutingTokens = ROUTING_TOKENS
): RoutingConstraint {
  return classifySegmentAgainstSegment(
    a.segment,
    b.segment,
    requiredClearanceBetween(a.domain, b.domain, rules, tokens)
  );
}
