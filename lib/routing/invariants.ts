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
import {
  classifyDomainAwareSegments,
  classifySegmentAgainstNode,
  classifySegmentAgainstSegment,
  type RoutingDomain,
} from './rules/collision';

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
  /** Optional routing domain for domain-specific edge-edge clearance. */
  domain?: RoutingDomain;
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

const samePoint = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;

/**
 * Gemeinsamer Abschnitt zweier kollinearer Segmente als [von, bis] entlang
 * der gemeinsamen Achse — `null`, wenn sie sich nicht echt überdecken.
 */
function overlapInterval(s1: Segment, s2: Segment): { lo: number; hi: number } | null {
  const horizontal = Math.abs(s1[0].y - s1[1].y) <= EPS;
  const lo1 = horizontal ? Math.min(s1[0].x, s1[1].x) : Math.min(s1[0].y, s1[1].y);
  const hi1 = horizontal ? Math.max(s1[0].x, s1[1].x) : Math.max(s1[0].y, s1[1].y);
  const lo2 = horizontal ? Math.min(s2[0].x, s2[1].x) : Math.min(s2[0].y, s2[1].y);
  const hi2 = horizontal ? Math.max(s2[0].x, s2[1].x) : Math.max(s2[0].y, s2[1].y);
  const lo = Math.max(lo1, lo2);
  const hi = Math.min(hi1, hi2);
  return hi - lo > EPS ? { lo, hi } : null;
}

/**
 * Port-Bündel-Ausnahme (ADR 0009 „Touch am gemeinsamen Handle ist kein
 * Overlap“): Zwei Kanten, die sich EINE Anschlussstelle teilen, verlassen sie
 * naturgemäß auf demselben Stub. Erlaubt ist genau das — der gemeinsame
 * Abschnitt muss vollständig in den Stubs BEIDER Kanten liegen. Jede
 * Überdeckung darüber hinaus bleibt ein harter Verstoß: Spätestens am
 * Lane-Punkt (Port-Fan-Out) müssen sich die Trassen trennen.
 */
function isPortBundleOverlap(
  a: { segments: Segment[]; ports: Segment[]; points: Point[] },
  b: { segments: Segment[]; ports: Segment[]; points: Point[] },
  s1: Segment,
  s2: Segment
): boolean {
  const sharesPort =
    a.points.some((pa) => b.points.some((pb) => samePoint(pa, pb))) &&
    (samePoint(a.points[0]!, b.points[0]!) ||
      samePoint(a.points[0]!, b.points[b.points.length - 1]!) ||
      samePoint(a.points[a.points.length - 1]!, b.points[0]!) ||
      samePoint(a.points[a.points.length - 1]!, b.points[b.points.length - 1]!));
  if (!sharesPort) return false;
  const interval = overlapInterval(s1, s2);
  if (!interval) return false;
  const withinStub = (stubs: readonly Segment[]): boolean =>
    stubs.some((stub) => {
      if (!sameAxis(stub, s1)) return false;
      const coords = stubCoords(stub);
      const lo = Math.min(coords[0]!, coords[1]!);
      const hi = Math.max(coords[0]!, coords[1]!);
      return interval.lo >= lo - EPS && interval.hi <= hi + EPS;
    });
  return withinStub(a.ports) && withinStub(b.ports);
}

/** Liegen beide Segmente auf derselben Achsrichtung (beide waagerecht/senkrecht)? */
const sameAxis = (a: Segment, b: Segment): boolean =>
  Math.abs(a[0].y - a[1].y) <= EPS === Math.abs(b[0].y - b[1].y) <= EPS;

/** Endkoordinaten eines achsenparallelen Segments entlang seiner Achse. */
const stubCoords = (segment: Segment): [number, number] =>
  Math.abs(segment[0].y - segment[1].y) <= EPS ? [segment[0].x, segment[1].x] : [segment[0].y, segment[1].y];

/** I2 — keine kollineare Überdeckung zwischen VERSCHIEDENEN Kanten. */
export function checkEdgeEdgeOverlaps(edges: readonly RoutedEdge[]): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const segmentsById = edges.map((edge) => {
    const points = simplifyWaypoints(edge.waypoints);
    const segments = waypointsToSegments(points);
    return {
      edge,
      segments,
      points,
      // Stubs = erstes und letztes Segment (die einzigen, die sich zwei
      // Kanten an einem gemeinsamen Port teilen dürfen).
      ports: segments.length > 0 ? [segments[0]!, segments[segments.length - 1]!] : [],
    };
  });
  for (let i = 0; i < segmentsById.length; i++) {
    for (let j = i + 1; j < segmentsById.length; j++) {
      const a = segmentsById[i]!;
      const b = segmentsById[j]!;
      let overlapping = false;
      for (const s1 of a.segments) {
        for (const s2 of b.segments) {
          // 'hard' (edge-edge-overlap) des Modells IS die I2-Bedingung (ADR 0019).
          if (classifySegmentAgainstSegment(s1, s2).class !== 'hard') continue;
          if (isPortBundleOverlap(a, b, s1, s2)) continue;
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
 * I3 — jedes Segment hält `cableClearance` Abstand zu unbeteiligten Nodes.
 * Segmente, die den Node treffen, meldet bereits I1 ('hard') — hier zählt
 * nur die Unterschreitung der Freigabe ohne Berührung ('weighted').
 *
 * Das Modell (`classifySegmentAgainstNode`) liefert beides aus demselben
 * Aufruf: hard ⇒ I1, weighted ⇒ I3. Die bisher hier geführte EPS-Toleranz
 * (1e-6 px unter der Schwelle) entfällt — das Modell definiert `< clearance`
 * exakt. Der Golden-Master-Ratchet über die realen Pläne zeigt: keine
 * Zähländerung (ADR 0019).
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
        const verdict = classifySegmentAgainstNode(segment, rect, tokens.cableClearance);
        if (verdict.class === 'weighted' && verdict.distance !== undefined) {
          violations.push({
            invariant: 'I3',
            edgeId: edge.id,
            otherId: rect.id,
            detail: `Abstand ${verdict.distance.toFixed(1)}px < cableClearance ${tokens.cableClearance}px zu Node ${rect.id}`,
          });
        }
      }
    }
  }
  return [...violations, ...checkDomainClearance(edges, tokens)];
}

/** I3 extension: pair-specific domain clearance for already routed edges. */
export function checkDomainClearance(
  edges: readonly RoutedEdge[],
  tokens: RoutingTokens = ROUTING_TOKENS
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (let i = 0; i < edges.length; i++) {
    const first = edges[i]!;
    if (!first.domain) continue;
    const firstSegments = waypointsToSegments(first.waypoints);
    for (let j = i + 1; j < edges.length; j++) {
      const second = edges[j]!;
      if (!second.domain) continue;
      const secondSegments = waypointsToSegments(second.waypoints);
      for (let firstIndex = 0; firstIndex < firstSegments.length; firstIndex++) {
        const firstSegment = firstSegments[firstIndex]!;
        for (let secondIndex = 0; secondIndex < secondSegments.length; secondIndex++) {
          const secondSegment = secondSegments[secondIndex]!;
          const verdict = classifyDomainAwareSegments(
            { segment: firstSegment, domain: first.domain },
            { segment: secondSegment, domain: second.domain },
            undefined,
            tokens
          );
          // Shared ports intentionally allow their two first/last stubs to
          // touch or bundle. The rest of a domain-separated route does not.
          const inSharedPortStub =
            (first.source === second.source && firstIndex === 0 && secondIndex === 0) ||
            (first.source === second.target &&
              firstIndex === 0 &&
              secondIndex === secondSegments.length - 1) ||
            (first.target === second.source &&
              firstIndex === firstSegments.length - 1 &&
              secondIndex === 0) ||
            (first.target === second.target &&
              firstIndex === firstSegments.length - 1 &&
              secondIndex === secondSegments.length - 1);
          if (verdict.class === 'weighted' && !inSharedPortStub) {
            violations.push({
              invariant: 'I3',
              edgeId: first.id,
              otherId: second.id,
              detail: `Domänenabstand ${verdict.distance?.toFixed(1) ?? '?'}px < ${
                verdict.requiredClearance ?? tokens.crossDomainSpacing
              }px zwischen ${first.id} und ${second.id}`,
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
