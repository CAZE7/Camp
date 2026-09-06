import { ROUTING_TOKENS, type RoutingTokens } from './tokens';
import {
  distanceSegmentToRect,
  hasMinimumStubs,
  manhattan,
  mergeCloseBends,
  segmentHitsRect,
  segmentsCross,
  segmentsOverlap,
  simplifyWaypoints,
  waypointsToSegments,
  type Point,
  type Rect,
  type Segment,
} from './geometry';

/**
 * WP-10 (#399): Routing-Invarianten (ROUTING-V2.md §12) als reine, für
 * BEIDE Pässe (ELK-Output und A-Stern/Bestandsrouter) anwendbare Prüf-Funktionen.
 *
 * Nummerierung wie in der Spezifikation:
 *  I1  kein Edge-Node-Collision
 *  I2  kein Edge-Edge-Overlap (kollineare Überdeckung)
 *  I3  Clearance ≥ `cableClearance` überall
 *  I4  kein U-Turn direkt am Handle
 *  I5  Stub ≥ `stubMin`
 *  I6  Segment ≥ `stubMin`
 *  I7  kein unnötiges Treppenmuster (Bend-Merge greift)
 *  I8  deterministische Lanes            → laneRegistry.test.ts + Determinismus-Läufe
 *  I9  deterministisches Ergebnis        → Doppel-Lauf-Vergleich (checkDeterminism)
 *  I10 Crossing nur, wenn unvermeidbar   → Fixture-Paare (countCrossings)
 *
 * Alle Schwellen kommen aus den Design Tokens (#390) — keine Zahl ist hier
 * hart kodiert. Die Checker geben Verletzungslisten zurück; die Testsuite
 * (`invariants.test.ts`) macht daraus CI-Blocker.
 */

export type RoutedEdge = {
  id: string;
  source: string;
  target: string;
  waypoints: Point[];
};

export type NodeRect = Rect & { id: string };

export type InvariantId = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'I7';

export type InvariantViolation = {
  invariant: InvariantId;
  edgeId: string;
  /** Beteiligter zweiter Akteur (Node- oder Edge-ID), falls vorhanden. */
  otherId?: string;
  detail: string;
};

const EPS = 1e-6;

const foreignRects = (edge: RoutedEdge, nodes: readonly NodeRect[]): NodeRect[] =>
  nodes.filter((node) => node.id !== edge.source && node.id !== edge.target);

/** I1 — kein Segment schneidet die Box eines UNBETEILIGTEN Nodes. */
export function checkEdgeNodeCollisions(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[]
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    const rects = foreignRects(edge, nodes);
    for (const [a, b] of waypointsToSegments(edge.waypoints)) {
      for (const rect of rects) {
        if (segmentHitsRect(a, b, rect)) {
          violations.push({
            invariant: 'I1',
            edgeId: edge.id,
            otherId: rect.id,
            detail: `Segment (${a.x},${a.y})→(${b.x},${b.y}) schneidet Node ${rect.id}`,
          });
        }
      }
    }
  }
  return violations;
}

/** I2 — keine kollineare Überdeckung zwischen VERSCHIEDENEN Kanten. */
export function checkEdgeEdgeOverlaps(edges: readonly RoutedEdge[]): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const segmentsById = edges.map((edge) => ({
    edge,
    segments: waypointsToSegments(edge.waypoints),
  }));
  for (let i = 0; i < segmentsById.length; i++) {
    for (let j = i + 1; j < segmentsById.length; j++) {
      const a = segmentsById[i]!;
      const b = segmentsById[j]!;
      let overlapping = false;
      for (const s1 of a.segments) {
        for (const s2 of b.segments) {
          if (segmentsOverlap(s1, s2)) {
            overlapping = true;
            break;
          }
        }
        if (overlapping) break;
      }
      if (overlapping) {
        violations.push({
          invariant: 'I2',
          edgeId: a.edge.id,
          otherId: b.edge.id,
          detail: `Kanten ${a.edge.id} und ${b.edge.id} überdecken sich kollinear`,
        });
      }
    }
  }
  return violations;
}

/**
 * I3 — jedes Segment hält `cableClearance` Abstand zu unbeteiligten Nodes.
 * Segmente, die den Node treffen, meldet bereits I1 — hier zählt nur die
 * Unterschreitung der Freigabe ohne Berührung.
 */
export function checkClearance(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    const rects = foreignRects(edge, nodes);
    for (const segment of waypointsToSegments(edge.waypoints)) {
      for (const rect of rects) {
        if (segmentHitsRect(segment[0], segment[1], rect)) continue; // I1-Fall
        const distance = distanceSegmentToRect(segment, rect);
        if (distance < tokens.cableClearance - EPS) {
          violations.push({
            invariant: 'I3',
            edgeId: edge.id,
            otherId: rect.id,
            detail: `Abstand ${distance.toFixed(1)}px < cableClearance ${tokens.cableClearance}px zu Node ${rect.id}`,
          });
        }
      }
    }
  }
  return violations;
}

const direction = ([a, b]: Segment): Point => ({ x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) });

const isUTurn = (s1: Segment, s2: Segment): boolean => {
  const d1 = direction(s1);
  const d2 = direction(s2);
  return d1.x === -d2.x && d1.y === -d2.y && (d1.x !== 0 || d1.y !== 0);
};

/** I4 — die ersten und letzten beiden Segmente kehren nicht um (Handle-Nähe). */
export function checkUTurnAtHandle(edges: readonly RoutedEdge[]): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    const segments = waypointsToSegments(simplifyWaypoints(edge.waypoints));
    if (segments.length < 2) continue;
    if (isUTurn(segments[0]!, segments[1]!)) {
      violations.push({ invariant: 'I4', edgeId: edge.id, detail: 'U-Turn direkt am Quell-Handle' });
    }
    if (isUTurn(segments[segments.length - 2]!, segments[segments.length - 1]!)) {
      violations.push({ invariant: 'I4', edgeId: edge.id, detail: 'U-Turn direkt am Ziel-Handle' });
    }
  }
  return violations;
}

/** I5 — erstes und letztes Segment (Stubs) sind mindestens `stubMin` lang. */
export function checkStubs(
  edges: readonly RoutedEdge[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    if (!hasMinimumStubs(simplifyWaypoints(edge.waypoints), tokens.stubMin)) {
      violations.push({
        invariant: 'I5',
        edgeId: edge.id,
        detail: `Stub kürzer als stubMin ${tokens.stubMin}px`,
      });
    }
  }
  return violations;
}

/** I6 — JEDES Segment ist mindestens `stubMin` lang. */
export function checkSegmentLengths(
  edges: readonly RoutedEdge[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    for (const [a, b] of waypointsToSegments(simplifyWaypoints(edge.waypoints))) {
      const length = manhattan(a, b);
      if (length < tokens.stubMin - EPS) {
        violations.push({
          invariant: 'I6',
          edgeId: edge.id,
          detail: `Segment ${length.toFixed(1)}px < stubMin ${tokens.stubMin}px`,
        });
      }
    }
  }
  return violations;
}

/** I7 — `mergeCloseBends` findet keinen entfernbaren Doppel-Bend mehr. */
export function checkStairs(
  edges: readonly RoutedEdge[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    const simplified = simplifyWaypoints(edge.waypoints);
    const merged = mergeCloseBends(simplified, tokens.bendRadius);
    if (merged.length < simplified.length) {
      violations.push({
        invariant: 'I7',
        edgeId: edge.id,
        detail: `Treppenmuster: Bend-Merge reduziert ${simplified.length}→${merged.length} Wegpunkte`,
      });
    }
  }
  return violations;
}

/** I10-Hilfe — echte Kreuzungen (X-Schnitte) zwischen verschiedenen Kanten. */
export function countCrossings(edges: readonly RoutedEdge[]): number {
  let crossings = 0;
  const segmentsById = edges.map((edge) => waypointsToSegments(edge.waypoints));
  for (let i = 0; i < segmentsById.length; i++) {
    for (let j = i + 1; j < segmentsById.length; j++) {
      for (const s1 of segmentsById[i]!) {
        for (const s2 of segmentsById[j]!) {
          if (segmentsCross(s1, s2)) crossings += 1;
        }
      }
    }
  }
  return crossings;
}

/** I9-Hilfe — kanonische Serialisierung eines Routings für Doppel-Lauf-Vergleich. */
export function serializeRoutes(edges: readonly RoutedEdge[]): string {
  return JSON.stringify(
    [...edges]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((edge) => ({ id: edge.id, waypoints: edge.waypoints }))
  );
}

export type InvariantReport = Record<InvariantId, InvariantViolation[]>;

/** Alle strukturell prüfbaren Invarianten (I1–I7) über ein geroutetes Set. */
export function checkInvariants(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantReport {
  return {
    I1: checkEdgeNodeCollisions(edges, nodes),
    I2: checkEdgeEdgeOverlaps(edges),
    I3: checkClearance(edges, nodes, tokens),
    I4: checkUTurnAtHandle(edges),
    I5: checkStubs(edges, tokens),
    I6: checkSegmentLengths(edges, tokens),
    I7: checkStairs(edges, tokens),
  };
}
