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
