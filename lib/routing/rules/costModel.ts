import { type SegmentSpatialIndex } from '../geometry/segmentSpatialIndex';
import { classifyDomainAwareSegments, classifySegmentAgainstSegment, type RoutingDomain } from './collision';
import { distanceSegmentToSegment, type Segment } from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';

/**
 * WP-6 (#396): A*-Kostenmodell — Schicht 2 (Routing Rules).
 *
 * Kostenmatrix der Spec (ROUTING-V2.md §9) für den inkrementellen Pass.
 * Alle Werte sind px-äquivalent (1 Kosteneinheit = 1 px Leitungslänge,
 * dieselbe Währung wie BEND_COST im Bestandsrouter) und werden aus den
 * Tokens ABGELEITET — kein Wert ist hier von Hand gepflegt.
 *
 * | Situation           | Kosten      | Ableitung                          |
 * |---------------------|-------------|-------------------------------------|
 * | overlap             | Infinity    | hard (ADR 0009) — garantiert unmöglich |
 * | clearance violation | VERY_HIGH   | 25 × laneGrid = 400 (= U_TURN_COST: schlimmer als jede Kehre) |
 * | crossing            | HIGH        | 7,5 × laneGrid = 120 (Bestandswert des Routers, s. Sync-Test) |
 * | nearby lane         | MEDIUM      | 1 × laneGrid = 16 (eine Lane Ausweichen ist billiger) |
 * | preferred lane      | BONUS       | −laneGrid/2 = −8 (zieht auf die Registry-Lane, WP-5) |
 * | free space          | LOW         | 0 (nur die Weglänge zählt)          |
 *
 * Konsistenz mit dem Kollisionsmodell (WP-3) ist Vertrag und testgesichert:
 * hard ⇒ Infinity/verboten, soft ⇒ endliche Strafkosten, weighted ⇒ Kosten,
 * none ⇒ LOW. Datenbasis ist der `SegmentSpatialIndex` (geroutete Segmente
 * als weiche Hindernisse); alle Abstands-/Kollinearitäts-Checks kommen aus
 * der Geometrie-Schicht (WP-2).
 *
 * Einbau-Reihenfolge: Der Bestandsrouter konsumiert ab sofort den
 * Kreuzungswert (`scorePath`, wertgleich 120 — Golden Master unverändert);
 * die vollständige Kostenfunktion übernimmt der inkrementelle Pass in WP-8.
 */

export type CostWeights = {
  /** Edge-Edge-Overlap — hard, garantiert unmöglich. */
  readonly overlap: number;
  /** Verletzung der Mindest-Clearance (weighted, sehr teuer). */
  readonly clearanceViolation: number;
  /** Echte Kreuzung (soft — minimieren, nicht verbieten). */
  readonly crossing: number;
  /** Nachbarschaft einer fremden Lane (innerhalb einer Lane-Breite über der Clearance). */
  readonly nearbyLane: number;
  /** Bonus (negativ) für die von der LaneRegistry bevorzugte Lane (WP-5). */
  readonly preferredLaneBonus: number;
  /** Freier Raum — nur die Weglänge zählt. */
  readonly freeSpace: number;
};

/** Ableitungsfaktoren (dokumentiert in der Matrix oben) — Teil der Config. */
export const COST_FACTORS = Object.freeze({
  clearancePerLaneGrid: 25,
  crossingPerLaneGrid: 7.5,
  nearbyPerLaneGrid: 1,
  preferredBonusPerLaneGrid: -0.5,
});

/** Kostenmatrix aus den Tokens generieren — einzige Quelle der Werte. */
export function buildCostWeights(tokens: RoutingTokens = ROUTING_TOKENS): CostWeights {
  return Object.freeze({
    overlap: Infinity,
    clearanceViolation: COST_FACTORS.clearancePerLaneGrid * tokens.laneGrid,
    crossing: COST_FACTORS.crossingPerLaneGrid * tokens.laneGrid,
    nearbyLane: COST_FACTORS.nearbyPerLaneGrid * tokens.laneGrid,
    preferredLaneBonus: COST_FACTORS.preferredBonusPerLaneGrid * tokens.laneGrid,
    freeSpace: 0,
  });
}

/** Default-Gewichte (Spec-Tokens). */
export const COST_WEIGHTS: CostWeights = buildCostWeights();

export type SegmentCostBreakdown = {
  /** Summierte Zusatzkosten (ohne Weglänge); Infinity bei Overlap. */
  cost: number;
  overlaps: number;
  crossings: number;
  clearanceViolations: number;
  /** Violations using a pair-specific domain clearance. */
  domainClearanceViolations: number;
  nearbyLanes: number;
};

/**
 * Zusatzkosten eines Kandidaten-Segments gegen die bereits gerouteten
 * Segmente (weiche Hindernisse im `SegmentSpatialIndex`).
 *
 * Klassifikation läuft ausschließlich über das Kollisionsmodell (WP-3):
 * - hard/Overlap  → Infinity (Abbruch, Segment unmöglich)
 * - soft/Crossing → `crossing` je gekreuztem Fremdsegment
 * - weighted      → `clearanceViolation` (unter der Clearance)
 * - none          → `nearbyLane`, falls innerhalb einer Lane-Breite über
 *                   der Clearance (Bündelungs-Druck), sonst `freeSpace`.
 */
export function segmentExtraCost(
  segment: Segment,
  index: SegmentSpatialIndex,
  options?: {
    tokens?: RoutingTokens;
    weights?: CostWeights;
    clearance?: number;
    domain?: RoutingDomain;
    segmentDomains?: ReadonlyMap<Segment, RoutingDomain>;
  }
): SegmentCostBreakdown {
  const tokens = options?.tokens ?? ROUTING_TOKENS;
  const weights = options?.weights ?? (options?.tokens ? buildCostWeights(options.tokens) : COST_WEIGHTS);
  const clearance = options?.clearance ?? tokens.cableClearance;
  const nearbyBand = clearance + tokens.laneGrid;

  const breakdown: SegmentCostBreakdown = {
    cost: 0,
    overlaps: 0,
    crossings: 0,
    clearanceViolations: 0,
    domainClearanceViolations: 0,
    nearbyLanes: 0,
  };

  const neighbors = index.queryNear(segment[0], segment[1], nearbyBand);
  for (const other of neighbors) {
    const otherDomain = options?.segmentDomains?.get(other);
    const constraint =
      options?.domain && otherDomain
        ? classifyDomainAwareSegments(
            { segment, domain: options.domain },
            { segment: other, domain: otherDomain },
            undefined,
            tokens
          )
        : classifySegmentAgainstSegment(segment, other, clearance);
    if (constraint.class === 'hard') {
      breakdown.overlaps += 1;
      breakdown.cost = Infinity;
      return breakdown; // hard: garantiert unmöglich — weitersummieren sinnlos.
    }
    if (constraint.class === 'soft') {
      breakdown.crossings += 1;
      breakdown.cost += weights.crossing;
      continue;
    }
    if (constraint.class === 'weighted') {
      breakdown.clearanceViolations += 1;
      if (options?.domain && otherDomain && (constraint.requiredClearance ?? clearance) > clearance) {
        breakdown.domainClearanceViolations += 1;
      }
      breakdown.cost += weights.clearanceViolation;
      continue;
    }
    // none: ggf. Nachbarlane (knapp über der Clearance) — Bündelungs-Druck.
    const distance = distanceSegmentToSegment(segment, other);
    if (distance < nearbyBand) {
      breakdown.nearbyLanes += 1;
      breakdown.cost += weights.nearbyLane;
    } else {
      breakdown.cost += weights.freeSpace;
    }
  }
  return breakdown;
}

/**
 * Lane-Bonus (WP-5-Anbindung): liegt der Quer-Versatz eines Segments auf
 * der von der LaneRegistry bevorzugten Lane, wird der (negative) Bonus
 * gewährt — der A*-Pass zieht Trassen aktiv auf ihre Registry-Lane.
 */
export function preferredLaneBonus(
  actualOffset: number,
  preferredOffset: number | undefined,
  weights: CostWeights = COST_WEIGHTS
): number {
  if (preferredOffset === undefined) return 0;
  return Math.abs(actualOffset - preferredOffset) < 1e-6 ? weights.preferredLaneBonus : 0;
}
