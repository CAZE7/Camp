import { segmentIntersectionPoint, waypointsToSegments, type Point, type Segment } from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';

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
  }) as Readonly<Record<HopDomain, number>>,
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

/** Achsparalleles Hüllrechteck einer Kante — Grobfilter vor dem Segmentvergleich. */
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const boundsOf = (points: readonly Point[]): Bounds | undefined => {
  if (points.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

const boundsDisjoint = (a: Bounds, b: Bounds): boolean =>
  a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY;

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
  return a.id.localeCompare(b.id) > 0 ? a.id : b.id;
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
export function resolveHops(edges: readonly HopEdge[]): Map<string, Hop[]> {
  const result = new Map<string, Hop[]>();
  for (const edge of edges) result.set(edge.id, []);

  const sorted = [...edges].sort((a, b) => a.id.localeCompare(b.id));
  const segmentsById = new Map<string, Segment[]>(
    sorted.map((edge) => [edge.id, waypointsToSegments(edge.waypoints)])
  );

  const boundsById = new Map(sorted.map((edge) => [edge.id, boundsOf(edge.waypoints)]));

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    const boundsA = boundsById.get(a.id);
    if (!boundsA) continue;
    const segmentsA = segmentsById.get(a.id) ?? [];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      const boundsB = boundsById.get(b.id);
      if (!boundsB || boundsDisjoint(boundsA, boundsB)) continue;
      const hopperId = hoppingEdgeId(a, b);
      if (!hopperId) continue;
      const segmentsB = segmentsById.get(b.id) ?? [];
      for (const segA of segmentsA) {
        for (const segB of segmentsB) {
          const carrier = hopperId === a.id ? segA : segB;
          const horizontal = isHorizontal(carrier);
          if (!horizontal && !isVertical(carrier)) continue;
          const point = segmentIntersectionPoint(segA, segB);
          if (!point) continue;
          result.get(hopperId)?.push({
            x: point.x,
            y: point.y,
            orientation: horizontal ? 'horizontal' : 'vertical',
          });
        }
      }
    }
  }

  for (const [id, hops] of result) {
    const unique = new Map<string, Hop>();
    for (const hop of hops) unique.set(dedupeKey(hop), hop);
    result.set(
      id,
      [...unique.values()].sort((p, q) => p.x - q.x || p.y - q.y)
    );
  }
  return result;
}
