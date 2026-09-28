import {
  SegmentSpatialIndex,
  segmentIntersectionPoint,
  waypointsToSegments,
  type Point,
  type Rect,
  type Segment,
} from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';
import { compareIds } from '../../sortOrder';

/**
 * WP-7 (#395): Kreuzungs-Hopping — Schicht 2 (Routing Rules) + Schicht 3
 * (Domain Rules) laut `docs/ROUTING-V2.md` §8.
 *
 * ```text
 * crossing detected → priority comparison → lower priority hops → render hop
 * ```
 *
 * Warum eine eigene Schicht und nicht „im Renderer schnell ausrechnen“:
 * Die Frage „wer hüpft?“ ist eine Regel, keine Darstellung. Sie muss für
 * beide Pässe (ELK, A*) dieselbe Antwort geben, deterministisch sein
 * (ADR 0010) und ohne Browser testbar bleiben (ADR 0007). Der Renderer
 * bekommt nur noch fertige Bogen-Mittelpunkte.
 *
 * Was hier NICHT passiert: Kreuzungen vermeiden. Das ist Aufgabe des
 * Routings (SOFT-Kollision, Kostenmodell WP-6). Gehoppt wird erst, was
 * übrig bleibt — Crossings sind erlaubt, nur Overlaps sind verboten
 * (ADR 0009).
 */

/** Elektrische/fachliche Domäne einer Leitung (Schicht 3). */
export type HopDomain = 'AC_230V' | 'Solar' | 'DC_12V' | 'water' | 'unknown';

/**
 * Gewichte der Prioritätsformel aus §8:
 *
 * ```text
 * routingPriority = domainPriority + backboneWeight + crossSectionWeight + manualLockWeight
 * ```
 *
 * Die Staffelung ist so gewählt, dass die beiden *strukturellen* Terme nie
 * durch die Summe der fachlichen überstimmt werden können:
 *
 * | Term                 | Spanne    | schlägt                         |
 * | -------------------- | --------- | ------------------------------- |
 * | `manualLockWeight`   | 0 / 10000 | alles                           |
 * | `backboneWeight`     | 0 / 1000  | Domäne + Querschnitt (max. 580) |
 * | `domainPriority`     | 0 … 300   | — gleiche Ebene                 |
 * | `crossSectionWeight` | 0 … 280   | — gleiche Ebene                 |
 *
 * Das ist die fachliche Aussage „Backbone bleibt gerade, Abzweig hüpft“ in
 * Zahlen: ein 70-mm²-Abzweig zwingt keinen Trunk zum Hüpfen.
 *
 * Domäne und Querschnitt liegen bewusst auf **einer** Ebene und addieren
 * sich, wie §8 es vorgibt („+“, keine Lexikografie): eine 70-mm²-DC-Leitung
 * (380) bleibt gegenüber einer 1,5-mm²-AC-Leitung (306) gerade. Wer eine
 * strikte Domänen-Hierarchie will, müsste die Formel ändern — das wäre
 * eine Spec-Änderung und gehört in ADR + Ledger, nicht in dieses Modul.
 */
export const HOP_PRIORITY_WEIGHTS = Object.freeze({
  /** Nutzer-fixierte Leitung (Lock) — hoppt nie. */
  manualLock: 10000,
  /** Kern-Verteilung (Batterie/Busbar/Shunt/Sicherung) bleibt gerade. */
  backbone: 1000,
  /** Fachliche Rangfolge der Domänen. */
  domain: Object.freeze({
    AC_230V: 300,
    Solar: 200,
    DC_12V: 100,
    water: 50,
    unknown: 0,
  }),
  /** Faktor je mm² Querschnitt; bei 70 mm² (Normobergrenze) gedeckelt. */
  crossSectionFactor: 4,
  crossSectionCap: 70,
});

/** Eine Leitung, wie das Hopping sie sieht — Geometrie plus Rangmerkmale. */
export type HopEdge = {
  id: string;
  waypoints: readonly Point[];
  domain?: HopDomain;
  /** Teil der Kern-Verteilung (Trasse). */
  backbone?: boolean;
  /** Leiterquerschnitt in mm². */
  crossSection?: number;
  /** Vom Nutzer fixiert — hoppt nie (§8). */
  locked?: boolean;
};

/** Ein zu rendernder Bogen: Mittelpunkt + Richtung des hüpfenden Segments. */
export type Hop = {
  x: number;
  y: number;
  /** Orientierung des Segments, das den Bogen trägt. */
  orientation: 'horizontal' | 'vertical';
};

/**
 * Radius des Hop-Bogens. Kein neues Token, sondern aus `laneGrid`
 * abgeleitet (halbe Lane) — so bleibt der Bogen garantiert schmaler als
 * der Abstand zweier Bündel-Lanes und kann nie in die Nachbartrasse
 * ragen. Gleiche Herleitungs-Disziplin wie `alternativeRouteGap`.
 */
export const hopRadius = (tokens: RoutingTokens = ROUTING_TOKENS): number => tokens.laneGrid / 2;

/** Prioritätswert einer Leitung (§8) — höherer Wert bleibt gerade. */
export function routingPriority(
  edge: Pick<HopEdge, 'domain' | 'backbone' | 'crossSection' | 'locked'>
): number {
  const domainPriority = HOP_PRIORITY_WEIGHTS.domain[edge.domain ?? 'unknown'] ?? 0;
  const backboneWeight = edge.backbone ? HOP_PRIORITY_WEIGHTS.backbone : 0;
  const crossSection = Number.isFinite(edge.crossSection) ? Math.max(0, edge.crossSection as number) : 0;
  const crossSectionWeight =
    Math.min(crossSection, HOP_PRIORITY_WEIGHTS.crossSectionCap) * HOP_PRIORITY_WEIGHTS.crossSectionFactor;
  const manualLockWeight = edge.locked ? HOP_PRIORITY_WEIGHTS.manualLock : 0;
  return domainPriority + backboneWeight + crossSectionWeight + manualLockWeight;
}

const AXIS_EPS = 1e-6;
const isHorizontal = (segment: Segment): boolean => Math.abs(segment[1].y - segment[0].y) < AXIS_EPS;
const isVertical = (segment: Segment): boolean => Math.abs(segment[1].x - segment[0].x) < AXIS_EPS;

/**
 * Entscheidet, welche der beiden Leitungen an einer Kreuzung hüpft.
 *
 * Reihenfolge (deterministisch, ADR 0010):
 * 1. Ein fixiertes Kabel hüpft nie — hüpft das andere, auch wenn es die
 *    höhere Priorität hat. Sind **beide** fixiert, hüpft keines: der
 *    Nutzer hat beide Verläufe bewusst festgelegt, eine stille
 *    Änderung wäre schlimmer als eine ungeschmückte Kreuzung.
 * 2. Sonst hüpft die niedrigere Priorität.
 * 3. Bei Gleichstand hüpft die lexikografisch größere ID — willkürlich,
 *    aber stabil über Re-Layout, Undo/Redo und Kantenpermutationen.
 */
function hoppingEdgeId(a: HopEdge, b: HopEdge): string | undefined {
  if (a.locked && b.locked) return undefined;
  if (a.locked) return b.id;
  if (b.locked) return a.id;
  const pa = routingPriority(a);
  const pb = routingPriority(b);
  if (pa !== pb) return pa < pb ? a.id : b.id;
  return compareIds(a.id, b.id) > 0 ? a.id : b.id;
}

const dedupeKey = (hop: Hop): string => `${hop.x.toFixed(3)},${hop.y.toFixed(3)},${hop.orientation}`;

/**
 * Berechnet für jede Leitung die Bogen-Mittelpunkte.
 *
 * Formal O(E²) über die Kantenpaare, innen O(S₁·S₂) über die Segmente. Der
 * teure Teil wird durch einen Hüllrechteck-Vergleich je Paar abgeschnitten:
 * Leitungen, deren Bounding-Boxen sich nicht überlappen, können sich nicht
 * kreuzen. In realen Plänen liegt fast jedes Paar weit auseinander, daher
 * bleibt der gemessene Aufwand am 585-Kanten-Plan im Bereich einer
 * Millisekunde (Perf-Gate ADR 0012).
 *
 * Die Eingabereihenfolge ist egal: Paare werden über sortierte IDs
 * gebildet, die Ausgabe ist je Kante nach Position sortiert.
 *
 * Gehoppt wird nur auf achsparallelen Segmenten. Das Routing ist
 * orthogonal (ADR 0003), ein schräger Träger ist also kein erwarteter
 * Zustand — und der Halbkreis wäre auf ihm nicht eindeutig orientierbar.
 * Ein Hop, den der Renderer nicht zeichnen kann, darf hier gar nicht erst
 * gemeldet werden: `PathResult.hops` und der Pfad müssen dasselbe sagen.
 */
export type RouteCrossingAnalysis = {
  /** Render-Hops, wie bisher von `resolveHops` geliefert. */
  hopsByEdge: Map<string, Hop[]>;
  /** Zahl verschiedener fremder Kanten, die jede Route echt schneiden. */
  crossingCountsByEdge: Map<string, number>;
};

const segmentBounds = (segment: Segment): Rect => {
  const [a, b] = segment;
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
};

/**
 * Berechnet Hops UND echte Fremdkanten-Kreuzungszahlen in EINEM Scan.
 *
 * Beides konsumiert dieselbe Geometrieprädikatsmenge. Der frühere
 * Render-Pass lief `resolveHops` und zählte direkt danach dieselben
 * Segmentpaare ein zweites Mal für die Kreuzungsmetadaten. Für orthogonale
 * Routen nutzt der Scan einen x-Sweep; diagonal gemischte Eingaben verwenden
 * den räumlichen Segmentindex. Beide Wege besuchen jedes Kantenpaar einmal
 * und leiten beide Ergebnisse aus demselben exakten Schnittpunkt ab.
 */
export function analyzeRouteCrossings(edges: readonly HopEdge[]): RouteCrossingAnalysis {
  const sorted = [...edges].sort((a, b) => compareIds(a.id, b.id));
  const hopsByEdge = new Map<string, Hop[]>();
  const crossingCountsByEdge = new Map<string, number>();
  const segmentsById = new Map<string, Segment[]>();
  const ownerBySegment = new Map<Segment, string>();
  const allSegments: Segment[] = [];
  const horizontalSegments: Segment[] = [];
  const verticalSegments: Segment[] = [];
  const diagonalSegments: Segment[] = [];
  const indexById = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    const edge = sorted[i]!;
    const segments = waypointsToSegments(edge.waypoints);
    indexById.set(edge.id, i);
    segmentsById.set(edge.id, segments);
    hopsByEdge.set(edge.id, []);
    crossingCountsByEdge.set(edge.id, 0);
    for (const segment of segments) {
      allSegments.push(segment);
      ownerBySegment.set(segment, edge.id);
      if (segment[0].y === segment[1].y) horizontalSegments.push(segment);
      else if (segment[0].x === segment[1].x) verticalSegments.push(segment);
      else diagonalSegments.push(segment);
    }
  }

  const seenCrossingPairs = new Set<number>();
  const hopperByPair = new Map<number, string | null>();
  const edgeCount = sorted.length;
  const recordCrossing = (i: number, segA: Segment, j: number, segB: Segment, point: Point): void => {
    if (i > j) return;
    const a = sorted[i]!;
    const b = sorted[j]!;
    const pairKey = i * edgeCount + j;
    if (!seenCrossingPairs.has(pairKey)) {
      seenCrossingPairs.add(pairKey);
      crossingCountsByEdge.set(a.id, (crossingCountsByEdge.get(a.id) ?? 0) + 1);
      crossingCountsByEdge.set(b.id, (crossingCountsByEdge.get(b.id) ?? 0) + 1);
    }

    let hopperId = hopperByPair.get(pairKey);
    if (hopperId === undefined) {
      hopperId = hoppingEdgeId(a, b) ?? null;
      hopperByPair.set(pairKey, hopperId);
    }
    if (!hopperId) return;

    const carrier = hopperId === a.id ? segA : segB;
    const horizontal = isHorizontal(carrier);
    if (!horizontal && !isVertical(carrier)) return;
    hopsByEdge.get(hopperId)?.push({
      x: point.x,
      y: point.y,
      orientation: horizontal ? 'horizontal' : 'vertical',
    });
  };

  if (diagonalSegments.length === 0) {
    // Orthogonal fast path: a sweep over x keeps only active horizontal
    // segments, then queries the y interval of each vertical segment. This
    // avoids materializing spatial-grid buckets for the overwhelmingly
    // common route geometry while retaining the exact intersection predicate.
    type Horizontal = {
      edgeIndex: number;
      edgeId: string;
      segment: Segment;
      minX: number;
      maxX: number;
      y: number;
    };
    type Vertical = { edgeIndex: number; segment: Segment; x: number; minY: number; maxY: number };
    type Event =
      | { x: number; kind: 'start'; horizontal: Horizontal }
      | { x: number; kind: 'end'; horizontal: Horizontal }
      | { x: number; kind: 'vertical'; vertical: Vertical };

    const events: Event[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const edge = sorted[i]!;
      for (const segment of segmentsById.get(edge.id) ?? []) {
        if (segment[0].y === segment[1].y) {
          const horizontal: Horizontal = {
            edgeIndex: i,
            edgeId: edge.id,
            segment,
            minX: Math.min(segment[0].x, segment[1].x),
            maxX: Math.max(segment[0].x, segment[1].x),
            y: segment[0].y,
          };
          events.push(
            { x: horizontal.minX, kind: 'start', horizontal },
            { x: horizontal.maxX, kind: 'end', horizontal }
          );
        } else {
          events.push({
            x: segment[0].x,
            kind: 'vertical',
            vertical: {
              edgeIndex: i,
              segment,
              x: segment[0].x,
              minY: Math.min(segment[0].y, segment[1].y),
              maxY: Math.max(segment[0].y, segment[1].y),
            },
          });
        }
      }
    }

    const eventOrder = { end: 0, vertical: 1, start: 2 } as const;
    events.sort((a, b) => a.x - b.x || eventOrder[a.kind] - eventOrder[b.kind]);
    const active: Horizontal[] = [];
    const compareHorizontal = (a: Horizontal, b: Horizontal): number =>
      a.y - b.y || compareIds(a.edgeId, b.edgeId) || a.minX - b.minX || a.maxX - b.maxX;

    for (const event of events) {
      if (event.kind === 'start') {
        let lo = 0;
        let hi = active.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (compareHorizontal(active[mid]!, event.horizontal) <= 0) lo = mid + 1;
          else hi = mid;
        }
        active.splice(lo, 0, event.horizontal);
        continue;
      }
      if (event.kind === 'end') {
        const index = active.indexOf(event.horizontal);
        if (index >= 0) active.splice(index, 1);
        continue;
      }

      const vertical = event.vertical;
      let lo = 0;
      let hi = active.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (active[mid]!.y <= vertical.minY) lo = mid + 1;
        else hi = mid;
      }
      for (let i = lo; i < active.length; i++) {
        const horizontal = active[i]!;
        if (horizontal.y >= vertical.maxY) break;
        if (horizontal.edgeIndex === vertical.edgeIndex) continue;
        if (vertical.x <= horizontal.minX || vertical.x >= horizontal.maxX) continue;
        const horizontalFirst = horizontal.edgeIndex < vertical.edgeIndex;
        const point = horizontalFirst
          ? segmentIntersectionPoint(horizontal.segment, vertical.segment)
          : segmentIntersectionPoint(vertical.segment, horizontal.segment);
        if (!point) continue;
        if (horizontalFirst) {
          recordCrossing(
            horizontal.edgeIndex,
            horizontal.segment,
            vertical.edgeIndex,
            vertical.segment,
            point
          );
        } else {
          recordCrossing(
            vertical.edgeIndex,
            vertical.segment,
            horizontal.edgeIndex,
            horizontal.segment,
            point
          );
        }
      }
    }
  } else {
    // Pure routing rules may also receive diagonal segments; retain the
    // complete spatial-index path for those uncommon inputs.
    const index = new SegmentSpatialIndex(allSegments);
    const candidateSegments: Segment[] = [];
    const seenCandidates = new Set<Segment>();
    for (let i = 0; i < sorted.length; i++) {
      const edge = sorted[i]!;
      for (const segA of segmentsById.get(edge.id) ?? []) {
        index.queryRectInto(segmentBounds(segA), candidateSegments, seenCandidates);
        for (const segB of candidateSegments) {
          const otherId = ownerBySegment.get(segB);
          if (otherId === undefined) continue;
          const j = indexById.get(otherId);
          if (j === undefined || j <= i) continue;
          const point = segmentIntersectionPoint(segA, segB);
          if (point) recordCrossing(i, segA, j, segB, point);
        }
      }
    }
  }

  for (const [id, hops] of hopsByEdge) {
    const unique = new Map<string, Hop>();
    for (const hop of hops) unique.set(dedupeKey(hop), hop);
    hopsByEdge.set(
      id,
      [...unique.values()].sort((p, q) => p.x - q.x || p.y - q.y)
    );
  }

  return { hopsByEdge, crossingCountsByEdge };
}

export function resolveHops(edges: readonly HopEdge[]): Map<string, Hop[]> {
  return analyzeRouteCrossings(edges).hopsByEdge;
}
