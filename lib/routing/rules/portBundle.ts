import { EPS, simplifyWaypoints, waypointsToSegments, type Point, type Segment } from '../geometry';

/**
 * Port-Bündel-Ausnahme (ADR 0009) — die EINE Wahrheit.
 *
 * Zwei Leitungen, die sich eine Anschlussstelle teilen, verlassen sie
 * naturgemäß auf demselben Stub; ihre ersten Segmente liegen also kollinear
 * übereinander. Das ist **erlaubt**, solange die gemeinsame Strecke
 * vollständig innerhalb der Stubs BEIDER Kanten liegt. Jede Überdeckung
 * darüber hinaus bleibt ein harter Verstoß (I2): Spätestens am Lane-Punkt
 * (Port-Fan-Out) müssen sich die Trassen trennen.
 *
 * Bis 2026-09-27 lebte diese Regel ausschließlich als private Funktion in
 * `lib/routing/invariants.ts` (`checkEdgeEdgeOverlaps`) — und in einer
 * zweiten, abweichenden Fassung im Diagnose-Skript `scripts/routing/audit.ts`.
 * Das Kostenmodell (`costModel.ts`, ROUTE-002) braucht dieselbe Kenntnis, um
 * legitime Bündel nicht als „unmöglich“ (`Infinity`) zu verwerfen. Deshalb
 * steht sie hier in der Rules-Schicht, importierbar aus beiden Richtungen:
 *
 *   Invarianten (I2)  →  portBundle  ←  Kostenmodell (segmentExtraCost)
 *   Diagnose (audit)  →  portBundle
 *
 * Rein geometrisch, framework-frei, ohne Tokens — die Schwellen kommen aus
 * der Geometrie (`EPS`) und aus den Stubs der Kanten selbst.
 */

/**
 * Vorberechnete Geometrie einer gerouteten Kante — genau die Sicht, die die
 * Ausnahme braucht: Stützpunkte (für die gemeinsame Anschlussstelle),
 * Segmente (für die Klassifikation) und Stubs (erstes/letztes Segment).
 *
 * `routedPathGeometry` vereinfacht die Stützpunkte wie der Invarianten-Check
 * (`simplifyWaypoints`) — so treffen Modell und I2 dieselben Entscheidungen.
 */
export type RoutedPathGeometry = {
  readonly points: readonly Point[];
  readonly segments: readonly Segment[];
  /** Erstes und letztes Segment — die einzigen, die sich zwei Kanten am gemeinsamen Port teilen dürfen. */
  readonly stubs: readonly Segment[];
};

/** Geometrie einer Kante aus ihren Stützpunkten (vereinfacht wie der Invarianten-Check). */
export function routedPathGeometry(waypoints: readonly Point[]): RoutedPathGeometry {
  const points = simplifyWaypoints(waypoints);
  const segments = waypointsToSegments(points);
  const stubs = segments.length > 0 ? [segments[0]!, segments[segments.length - 1]!] : [];
  return { points, segments, stubs };
}

/** Zwei Punkte identisch (EPS)? */
export function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;
}

/**
 * Teilen sich zwei Kanten eine Anschlussstelle? Geprüft werden Anfang und
 * Ende beider Wege — der gemeinsame Handle ist bei beiden Kanten ein
 * Endpunkt. (Sobald ein Endpunkt-Paar übereinstimmt, gibt es ohnehin einen
 * gemeinsamen Stützpunkt; die frühere Zusatzbedingung „irgendein gemeinsamer
 * Punkt“ war damit redundant und ist entfallen — gleiche Entscheidungen,
 * eine Bedingung weniger.)
 */
export function sharesPort(a: RoutedPathGeometry, b: RoutedPathGeometry): boolean {
  const a0 = a.points[0];
  const a1 = a.points[a.points.length - 1];
  const b0 = b.points[0];
  const b1 = b.points[b.points.length - 1];
  if (!a0 || !a1 || !b0 || !b1) return false;
  return samePoint(a0, b0) || samePoint(a0, b1) || samePoint(a1, b0) || samePoint(a1, b1);
}

/**
 * Gemeinsamer Abschnitt zweier kollinearer Segmente als [von, bis] entlang
 * der gemeinsamen Achse — `null`, wenn sie sich nicht echt überdecken.
 */
export function overlapInterval(s1: Segment, s2: Segment): { lo: number; hi: number } | null {
  const horizontal = Math.abs(s1[0].y - s1[1].y) <= EPS;
  const lo1 = horizontal ? Math.min(s1[0].x, s1[1].x) : Math.min(s1[0].y, s1[1].y);
  const hi1 = horizontal ? Math.max(s1[0].x, s1[1].x) : Math.max(s1[0].y, s1[1].y);
  const lo2 = horizontal ? Math.min(s2[0].x, s2[1].x) : Math.min(s2[0].y, s2[1].y);
  const hi2 = horizontal ? Math.max(s2[0].x, s2[1].x) : Math.max(s2[0].y, s2[1].y);
  const lo = Math.max(lo1, lo2);
  const hi = Math.min(hi1, hi2);
  return hi - lo > EPS ? { lo, hi } : null;
}

/** Liegen beide Segmente auf derselben Achsrichtung (beide waagerecht/senkrecht)? */
const sameAxis = (a: Segment, b: Segment): boolean =>
  Math.abs(a[0].y - a[1].y) <= EPS === Math.abs(b[0].y - b[1].y) <= EPS;

/** Endkoordinaten eines achsenparallelen Segments entlang seiner Achse. */
const stubCoords = (segment: Segment): [number, number] =>
  Math.abs(segment[0].y - segment[1].y) <= EPS ? [segment[0].x, segment[1].x] : [segment[0].y, segment[1].y];

/**
 * Ist diese kollineare Überdeckung die legitime Port-Bündelung zweier Kanten,
 * die sich eine Anschlussstelle teilen? Nur dann darf ein „hard“-Urteil des
 * Kollisionsmodells (I2 / `segmentExtraCost`) fallen gelassen werden.
 */
export function isPortBundleOverlap(
  a: RoutedPathGeometry,
  b: RoutedPathGeometry,
  s1: Segment,
  s2: Segment
): boolean {
  if (!sharesPort(a, b)) return false;
  const interval = overlapInterval(s1, s2);
  if (!interval) return false;
  const withinStub = (stubs: readonly Segment[]): boolean =>
    stubs.some((stub) => {
      if (!sameAxis(stub, s1)) return false;
      const coords = stubCoords(stub);
      const lo = Math.min(coords[0], coords[1]);
      const hi = Math.max(coords[0], coords[1]);
      return interval.lo >= lo - EPS && interval.hi <= hi + EPS;
    });
  return withinStub(a.stubs) && withinStub(b.stubs);
}

// ---------------------------------------------------------------------------
// Port-Korridor (ADR 0031) — die Freigabe-Seite derselben Ausnahme.
// ---------------------------------------------------------------------------

/**
 * Port-Korridor einer Kante: die Segmente, die der FESTE Port-Rahmen
 * bestimmt — Stub (S→S2) und Fan-Out-Jog (S2→S3) — je Route-Ende.
 *
 * Die Invariante I2 (kollineare Überdeckung) braucht nur die Stubs: Zwei
 * Kanten eines Bündels überdecken sich kollinear ausschließlich auf dem
 * gemeinsamen Stub-Abschnitt. Die Freigabe (I3, Abstand < Clearance ohne
 * Berührung) entsteht aber auch am JOG: Die Kante weicht am Stub-Ende auf
 * ihre Lane aus und kreuzt dabei die Strecke, auf der die Nachbarkante
 * weiterläuft — gemessen 0 px am Fan-Out-Punkt, 24–40 px vom Port entfernt
 * (sechs Referenzpläne, 2026-10-02). Der Korridor ist deshalb Stub PLUS
 * angrenzender Jog.
 *
 * `routedPathGeometry` vereinfacht die Stützpunkte wie der Invarianten-Check;
 * bei Lane 0 fällt der Jog mit dem Stub-Ende zusammen und vereinfacht sich
 * weg — der Korridor ist dann der Stub allein (konservativ, nie breiter als
 * die Geometrie, die der Router tatsächlich gefahren ist).
 */
export type PortCorridor = {
  /** Korridor-Segmente am Routen-Start (Port am ersten Stützpunkt). */
  start: readonly Segment[];
  /** Korridor-Segmente am Routen-Ende (Port am letzten Stützpunkt). */
  end: readonly Segment[];
};

/** Liegt der Punkt auf dem Segment (EPS-Toleranz)? */
const pointOnSegment = (p: Point, s: Segment): boolean => {
  const [a, b] = s;
  // achsenparallel (Vertrag des Routers, geprüft von I2/R2): Box-Test genügt.
  const withinBox =
    p.x >= Math.min(a.x, b.x) - EPS &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS &&
    p.y <= Math.max(a.y, b.y) + EPS;
  if (!withinBox) return false;
  const horizontal = Math.abs(a.y - b.y) <= EPS;
  return horizontal ? Math.abs(p.y - a.y) <= EPS : Math.abs(p.x - a.x) <= EPS;
};

/** Port-Korridor einer Kante aus ihrer (vereinfachten) Geometrie. */
export function portCorridor(geometry: RoutedPathGeometry): PortCorridor {
  const segments = geometry.segments;
  const n = segments.length;
  if (n === 0) return { start: [], end: [] };
  if (n === 1) return { start: [segments[0]!], end: [segments[0]!] };
  if (n === 2) return { start: [segments[0]!], end: [segments[1]!] };
  return {
    start: [segments[0]!, segments[1]!],
    end: [segments[n - 2]!, segments[n - 1]!],
  };
}

/**
 * Ist diese Abstands-Unterschreitung (I3, `weighted` des Kollisionsmodells)
 * die legitime Port-Bündelung zweier Kanten, die sich eine Anschlussstelle
 * teilen? Nur dann darf sie aus der I3-Zählung fallen — jede andere
 * Unterschreitung bleibt eine gemeldete Verletzung.
 *
 * Kriterium (Spiegel von `isPortBundleOverlap`, ADR 0009/0025/0031):
 *
 *  1. **Gemeinsame Anschlussstelle:** Beide Kanten haben einen identischen
 *     Endpunkt (den gemeinsamen Port).
 *  2. **Korridor-Segmente:** Das beteiligte Segment JEDER Kante gehört zum
 *     Port-Korridor dieser Kante am gemeinsamen Port (Stub oder Fan-Out-Jog,
 *     maximal die ersten/beiden letzten zwei Segmente). Freie Trassen-
 *     segmente sind nie korridor-freigestellt — sie sind gesuchte Geometrie,
 *     der Router hätte sie fernhalten können.
 *  3. Keine Längengrenze nach Port-Distanz: Der Korridor folgt der eigenen
 *     Geometrie der Kante (rangscaled Stubs sind genauso Bündel wie der
 *     Mindest-Stub) — keine zweite, tokens-basierte Schwelle neben der
 *     Geometrie (Modul-Vertrag: framework-frei, ohne Tokens).
 *
 * Da `checkClearance` dieselben (vereinfachten) Segmente prüft, ist der
 * Segment-Vergleich Identität — kein räumliches Matching nötig.
 */
export function isPortBundleProximity(
  a: RoutedPathGeometry,
  b: RoutedPathGeometry,
  s1: Segment,
  s2: Segment
): boolean {
  // Gemeinsamer Port (wie sharesPort, aber mit Fundstelle für die Seite).
  const a0 = a.points[0];
  const aN = a.points[a.points.length - 1];
  const b0 = b.points[0];
  const bN = b.points[b.points.length - 1];
  if (!a0 || !aN || !b0 || !bN) return false;
  let port: Point | undefined;
  let sideA: 'start' | 'end' | null = null;
  let sideB: 'start' | 'end' | null = null;
  if (samePoint(a0, b0)) {
    port = a0;
    sideA = 'start';
    sideB = 'start';
  } else if (samePoint(a0, bN)) {
    port = a0;
    sideA = 'start';
    sideB = 'end';
  } else if (samePoint(aN, b0)) {
    port = aN;
    sideA = 'end';
    sideB = 'start';
  } else if (samePoint(aN, bN)) {
    port = aN;
    sideA = 'end';
    sideB = 'end';
  }
  if (port === undefined || sideA === null || sideB === null) return false;

  const corridorA = portCorridor(a)[sideA];
  const corridorB = portCorridor(b)[sideB];
  const inCorridor = (segment: Segment, corridor: readonly Segment[]): boolean =>
    corridor.some(
      (corridorSegment) =>
        // Identität (checkClearance prüft dieselben Segmente) oder — für
        // Aufrufer mit unvereinfachten Segmenten — räumliche Deckung auf
        // derselben Achse (Teilstrecke eines Korridor-Segments).
        corridorSegment === segment ||
        (sameAxis(corridorSegment, segment) &&
          overlapInterval(corridorSegment, segment) !== null &&
          ((pointOnSegment(corridorSegment[0], segment) && pointOnSegment(corridorSegment[1], segment)) ||
            (pointOnSegment(segment[0], corridorSegment) && pointOnSegment(segment[1], corridorSegment))))
    );
  return inCorridor(s1, corridorA) && inCorridor(s2, corridorB);
}
