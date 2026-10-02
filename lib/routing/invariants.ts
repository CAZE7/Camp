import { ROUTING_TOKENS, type RoutingTokens } from './tokens';
import {
  facingStubLength,
  hasMinimumStubs,
  manhattan,
  mergeCloseBends,
  segmentsCross,
  simplifyWaypoints,
  waypointsToSegments,
  type Point,
  type Rect,
  type Segment,
} from './geometry';
import { classifySegmentAgainstNode, classifySegmentAgainstSegment } from './rules/collision';
import { isPortBundleOverlap, isPortBundleProximity, routedPathGeometry } from './rules/portBundle';
import { compareIds } from '../sortOrder';

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
 *
 * ADR 0019 / AUDIT ROUTE-003 (Fix 2026-09-08): I1/I2/I3 besitzen KEINE eigene
 * Kollisions-/Abstandsbegriffswelt mehr. Die harten Freigabe-Urteile werden
 * aus dem geteilten Modell `rules/collision.ts` abgeleitet — hard ist I1/I2,
 * weighted ist I3. Der Produktiv-A* (pathfinding.ts) prüft im Innenloop
 * weiterhin über das äquivalente, billigere `segmentHitsRect` (PERF-001);
 * die Freigabe-Prüfung hier ist die eine Stelle, an der binäre Urteile
 * materiell erzeugt werden — und die liest das Modell.
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
        // 'hard' des Modells IS die I1-Bedingung (ADR 0019).
        if (classifySegmentAgainstNode([a, b], rect).class === 'hard') {
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

/** I2 — keine kollineare Überdeckung zwischen VERSCHIEDENEN Kanten und innerhalb EINER Kante. */
export function checkEdgeEdgeOverlaps(edges: readonly RoutedEdge[]): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const segmentsById = edges.map((edge) => {
    // Die Port-Bündel-Ausnahme (Stützpunkte, Segmente, Stubs) kommt aus
    // `rules/portBundle.ts` — dieselbe Funktion, die das Kostenmodell und das
    // Audit benutzen (ROUTE-002). `geometry` ist das vorberechnete
    // `RoutedPathGeometry` der Kante.
    const geometry = routedPathGeometry(edge.waypoints);
    return { edge, geometry };
  });
  for (let i = 0; i < segmentsById.length; i++) {
    // AUDIT ROUTE-011: Selbstüberlappung — zwei Segmente Derselben Kante
    // überdecken sich kollinear (z. B. U-förmiger Pfad). Die bisherige
    // Schleife (j = i + 1) verglich nur Kantenpaare und verfehlte diesen Fall.
    const own = segmentsById[i]!;
    for (let si = 0; si < own.geometry.segments.length; si++) {
      for (let sj = si + 1; sj < own.geometry.segments.length; sj++) {
        if (
          classifySegmentAgainstSegment(own.geometry.segments[si]!, own.geometry.segments[sj]!).class ===
          'hard'
        ) {
          violations.push({
            invariant: 'I2',
            edgeId: own.edge.id,
            otherId: own.edge.id,
            detail: `Kante ${own.edge.id} überdeckt sich selbst kollinear (Segmente ${si}↔${sj})`,
          });
          // Eine Selbstüberlappung pro Kante reicht.
          si = own.geometry.segments.length;
          break;
        }
      }
    }
    for (let j = i + 1; j < segmentsById.length; j++) {
      const a = segmentsById[i]!;
      const b = segmentsById[j]!;
      let overlapping = false;
      for (const s1 of a.geometry.segments) {
        for (const s2 of b.geometry.segments) {
          // 'hard' (edge-edge-overlap) des Modells IS die I2-Bedingung (ADR 0019).
          if (classifySegmentAgainstSegment(s1, s2).class !== 'hard') continue;
          if (isPortBundleOverlap(a.geometry, b.geometry, s1, s2)) continue;
          overlapping = true;
          break;
        }
        if (overlapping) break;
      }
      if (overlapping) {
        violations.push({
          invariant: 'I2',
          edgeId: a.edge.id,
          otherId: b.edge.id,
          detail: `Kanten ${a.edge.id} und ${b.edge.id} überdecken sich kollinear außerhalb des Ports`,
        });
      }
    }
  }
  return violations;
}

/**
 * I3 — jedes Segment hält `cableClearance` Abstand zu unbeteiligten Nodes
 * UND zu Segmenten fremder Kanten.
 *
 * Segmente, die den Node treffen, meldet bereits I1 ('hard') — hier zählt
 * nur die Unterschreitung der Freigabe ohne Berührung ('weighted').
 * Segment×Segment-Clearance war bisher nicht geprüft (nur Segment×Node);
 * die Doc-Tabelle (ROUTING-CONTEXT.md:123) verspricht „Abstand < clearance
 * ohne Berührung → weighted, Zählung als Verletzung, I3" auch für den
 * Segment×Segment-Fall.
 *
 * AUDIT ROUTE-012: Erweiterung um Segment×Segment via
 * `classifySegmentAgainstSegment` — dasselbe Modell, das I2 (hard) und
 * Crossing (soft) liefert, liefert hier den `weighted`-Fall.
 *
 * ADR 0031 (2026-10-02): Die Port-Bündel-Ausnahme gilt jetzt für BEIDE
 * Invarianten symmetrisch. Zwei Kanten, die sich eine Anschlussstelle
 * teilen, laufen auf ihrem gemeinsamen Stub kollinear übereinander — das
 * ist die dokumentierte Bündel-Ausnahme von I2 (ADR 0009/0025). Dieselbe
 * Geometrie ist notwendig auch eine Abstands-Unterschreitung (Abstand 0
 * auf dem gemeinsamen Abschnitt, plus das Lane-Ausweichen am Fan-Out):
 * I3 zählte sie trotzdem als Verletzung. Die Invariante war damit für
 * JEDEN Plan mit geteiltem Port unerfüllbar by construction, und echte
 * Verletzungen (29 von 98 über die sechs Referenzpläne) versteckten sich
 * im strukturellen Rauschen. `isPortBundleProximity` (Rules-Schicht, neben
 * `isPortBundleOverlap` — eine Wahrheit) gibt genau die Bündel-Fälle frei:
 * gemeinsame Anschlussstelle UND beide beteiligten Segmente im Port-
 * Korridor (Stub + Fan-Out-Jog) der jeweiligen Kante. Alles andere —
 * insbesondere freie Trassensegmente und Paare ohne gemeinsamen Port —
 * bleibt gemeldete Verletzung.
 */
export function checkClearance(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const clearance = tokens.cableClearance;
  // Segment × Node (bisheriger Pfad)
  for (const edge of edges) {
    const rects = foreignRects(edge, nodes);
    for (const segment of waypointsToSegments(edge.waypoints)) {
      for (const rect of rects) {
        const verdict = classifySegmentAgainstNode(segment, rect, clearance);
        if (verdict.class === 'weighted' && verdict.distance !== undefined) {
          violations.push({
            invariant: 'I3',
            edgeId: edge.id,
            otherId: rect.id,
            detail: `Abstand ${verdict.distance.toFixed(1)}px < cableClearance ${clearance}px zu Node ${rect.id}`,
          });
        }
      }
    }
  }
  // Segment × Segment: Abstand < cableClearance zwischen Segmenten
  // verschiedener Kanten — selbes Modell wie I2, aber der weighted-Fall.
  // Die Segmente kommen aus `routedPathGeometry` (vereinfacht) — dieselbe
  // Sicht wie `checkEdgeEdgeOverlaps`: eine Geometrie-Wahrheit für beide
  // Invarianten, keine Doppelzählung durch Kollinear-Splits in rohen
  // Stützpunkten.
  const geometryByEdge = edges.map((edge) => ({
    edge,
    geometry: routedPathGeometry(edge.waypoints),
  }));
  for (let i = 0; i < geometryByEdge.length; i++) {
    for (let j = i + 1; j < geometryByEdge.length; j++) {
      const a = geometryByEdge[i]!;
      const b = geometryByEdge[j]!;
      for (const s1 of a.geometry.segments) {
        for (const s2 of b.geometry.segments) {
          // ADR 0009/0031: legitime Port-Bündelung zählt nicht.
          if (isPortBundleProximity(a.geometry, b.geometry, s1, s2)) continue;
          const verdict = classifySegmentAgainstSegment(s1, s2, clearance);
          if (verdict.class === 'weighted' && verdict.distance !== undefined) {
            violations.push({
              invariant: 'I3',
              edgeId: a.edge.id,
              otherId: b.edge.id,
              detail: `Abstand ${verdict.distance.toFixed(1)}px < cableClearance ${clearance}px zwischen Kanten ${a.edge.id} und ${b.edge.id}`,
            });
          }
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

/** Achsrichtung eines Segments als vorzeichenbehafteter Einheitsvektor. */
const axisDirection = ([a, b]: Segment): Point => ({
  x: Math.abs(b.x - a.x) > EPS ? Math.sign(b.x - a.x) : 0,
  y: Math.abs(b.y - a.y) > EPS ? Math.sign(b.y - a.y) : 0,
});

/**
 * Geforderte Stub-Länge einer Kante (ROUTE-BUG-7).
 *
 * Normalfall: `stubMin`. Liegen sich die beiden Ports AUF DERSELBEN Achse
 * gegenüber und ist der Raum zwischen ihnen kleiner als zwei volle Stubs,
 * teilen sich beide Stubs den Raum (`facingStubLength`) — die Forderung sinkt
 * dann auf das geometrisch Mögliche. Ohne diese Herleitung wäre die Regel an
 * engen Stellen nicht erfüllbar: Der Router müsste entweder am Handle kehren
 * (I4) oder ein Kurzsegment einschieben (I6).
 */
export function requiredStubLength(
  points: readonly Point[],
  stubMin: number = ROUTING_TOKENS.stubMin
): number {
  const segments = waypointsToSegments(simplifyWaypoints(points));
  if (segments.length === 0) return stubMin;
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  const d1 = axisDirection(first);
  const d2 = axisDirection(last);
  const facing = d1.x === d2.x && d1.y === d2.y && (d1.x !== 0 || d1.y !== 0);
  if (!facing) return stubMin;
  const start = first[0];
  const end = last[1];
  const gap = (end.x - start.x) * d1.x + (end.y - start.y) * d1.y;
  return facingStubLength(gap, stubMin);
}

/** I5 — erstes und letztes Segment (Stubs) sind mindestens so lang wie gefordert. */
export function checkStubs(
  edges: readonly RoutedEdge[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    const points = simplifyWaypoints(edge.waypoints);
    const required = requiredStubLength(points, tokens.stubMin);
    if (!hasMinimumStubs(points, required)) {
      violations.push({
        invariant: 'I5',
        edgeId: edge.id,
        detail: `Stub kürzer als gefordert (${required.toFixed(1)}px, regulär ${tokens.stubMin}px)`,
      });
    }
  }
  return violations;
}

/**
 * I6 — JEDES Segment ist mindestens `segmentMin` lang.
 *
 * Schwelle ist `segmentMin` (= `laneGrid`), nicht `stubMin`: Ein Lane-Wechsel
 * (Port-Fan-Out, Bündelung) ist orthogonal nur als Quersegment von genau einer
 * Lane Breite darstellbar. Mit `stubMin` (24 px > laneGrid 16 px) wäre jeder
 * Lane-Wechel ein Verstoß — die Regel wäre nicht erfüllbar. Für die Stubs gilt
 * weiterhin `stubMin` (I5).
 */
export function checkSegmentLengths(
  edges: readonly RoutedEdge[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const edge of edges) {
    const points = simplifyWaypoints(edge.waypoints);
    // Engstelle: Mussten die Stubs gekürzt werden, weil sich zwei Ports
    // gegenüberliegen (ROUTE-BUG-7), gibt der Korridor auch für die übrigen
    // Segmente nicht mehr her — die Schwelle folgt dem verfügbaren Raum,
    // statt einen unerfüllbaren Wert zu fordern.
    const minimum = Math.min(tokens.segmentMin, requiredStubLength(points, tokens.stubMin));
    for (const [a, b] of waypointsToSegments(points)) {
      const length = manhattan(a, b);
      if (length < minimum - EPS) {
        violations.push({
          invariant: 'I6',
          edgeId: edge.id,
          detail: `Segment ${length.toFixed(1)}px < Mindestlänge ${minimum.toFixed(1)}px`,
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
      .sort((a, b) => compareIds(a.id, b.id))
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
