import { EPS, ORIENT_EPS, type Point, type Rect, type Segment } from './types';

/**
 * WP-2 (#392): Segment-Primitives — pure Functions, kein Domänenwissen.
 *
 * `segmentsIntersect` ist die wörtliche Migration der (bis WP-2 doppelt
 * gepflegten) Implementierungen aus `pathfinding.ts` und
 * `orthogonalRouting.ts`. Die Unterscheidung „echte Kreuzung vs. Touch vs.
 * kollineare Überlappung" (`segmentsCross`, `segmentsOverlap`) ist neu und
 * die Grundlage des Kollisionsmodells (WP-3): Overlap = HARD,
 * Crossing = SOFT (ADR 0009).
 */

/** Orientierung des Tripels a→b→c: 0 kollinear, 1 im, 2 gegen Uhrzeigersinn. */
export const orientation = (a: Point, b: Point, c: Point): number => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < ORIENT_EPS) return 0;
  return value > 0 ? 1 : 2;
};

/** Liegt b in der Bounding-Box von a–c? (Nur für kollineare Tripel sinnvoll.) */
export const onSegmentBox = (a: Point, b: Point, c: Point): boolean =>
  b.x <= Math.max(a.x, c.x) + ORIENT_EPS &&
  b.x >= Math.min(a.x, c.x) - ORIENT_EPS &&
  b.y <= Math.max(a.y, c.y) + ORIENT_EPS &&
  b.y >= Math.min(a.y, c.y) - ORIENT_EPS;

/** Liegt der Punkt p auf der Strecke s (inklusive Endpunkte)? */
export const pointOnSegment = (p: Point, s: Segment): boolean =>
  orientation(s[0], p, s[1]) === 0 && onSegmentBox(s[0], p, s[1]);

/**
 * Die vier Orientierungs-Prädikate eines Streckenpaares, EINMAL berechnet.
 *
 * PERF-002 (2026-10-03): `segmentsIntersect`, `segmentsCross` und
 * `segmentsOverlap` bestimmten dieselben vier Werte jeweils neu — ein
 * Klassifikationsaufruf des Kollisionsmodells kostete bis zu 10
 * `orientation`-Aufrufe. Im 500-Knoten-Spannkanten-Szenario lag
 * `classifySegmentAgainstSegment` damit bei 55 % der Gesamtlaufzeit
 * (CPU-Profil, s. `benchmarks/routeAllWorstCase.probe.ts`). Die Werte hier
 * einmal zu berechnen ändert **kein** Urteil: Alle drei Funktionen lesen
 * ausschließlich diese vier Zahlen plus die Box-Prädikate.
 *
 * Reihenfolge im Tupel: `[o(p1,q1,p2), o(p1,q1,q2), o(p2,q2,p1), o(p2,q2,q1)]`.
 */
export type Orientations = readonly [number, number, number, number];

/** Die vier Orientierungen eines Streckenpaares (Reihenfolge s. `Orientations`). */
export const orientationsOf = (s1: Segment, s2: Segment): Orientations => {
  const [p1, q1] = s1;
  const [p2, q2] = s2;
  return [orientation(p1, q1, p2), orientation(p1, q1, q2), orientation(p2, q2, p1), orientation(p2, q2, q1)];
};

/**
 * `segmentsIntersect` mit vorberechneten Orientierungen.
 *
 * Semantisch identisch zur öffentlichen Funktion (dieselbe Reihenfolge der
 * Prüfungen, dieselben Box-Prädikate) — nur ohne die zweite Berechnung der
 * Orientierungen. Wer das Paar ohnehin schon klassifiziert, spart hier den
 * Hauptteil der Arbeit.
 */
export function segmentsIntersectWith(s1: Segment, s2: Segment, o: Orientations): boolean {
  const [p1, q1] = s1;
  const [p2, q2] = s2;
  const o1 = o[0];
  const o2 = o[1];
  const o3 = o[2];
  const o4 = o[3];
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegmentBox(p1, p2, q1)) return true;
  if (o2 === 0 && onSegmentBox(p1, q2, q1)) return true;
  if (o3 === 0 && onSegmentBox(p2, p1, q2)) return true;
  if (o4 === 0 && onSegmentBox(p2, q1, q2)) return true;
  return false;
}

/**
 * Berühren oder schneiden sich zwei Strecken? (Touch zählt mit —
 * das ist der bisherige Router-Begriff für die Kreuzungszählung.)
 */
export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  return segmentsIntersectWith(s1, s2, orientationsOf(s1, s2));
}

/** Sind beide Strecken kollinear (auf derselben Geraden)? */
export function areCollinear(s1: Segment, s2: Segment): boolean {
  return orientation(s1[0], s1[1], s2[0]) === 0 && orientation(s1[0], s1[1], s2[1]) === 0;
}

/** Kollinearität aus vorberechneten Orientierungen (`o1 === 0 && o2 === 0`). */
export const areCollinearWith = (o: Orientations): boolean => o[0] === 0 && o[1] === 0;

/**
 * Kollineare Überlappung mit echter gemeinsamer Länge (> EPS).
 * Punktberührung Ende-an-Ende zählt NICHT als Overlap.
 */
export function segmentsOverlap(s1: Segment, s2: Segment): boolean {
  if (!areCollinear(s1, s2)) return false;
  return collinearOverlap(s1, s2);
}

/**
 * Überdeckungs-Teil von `segmentsOverlap`, ohne die Kollinearitätsprüfung:
 * Der Aufrufer hat sie (über die Orientierungen) bereits. Projiziert wird auf
 * die dominante Achse — bei kollinearen Strecken liefert das dieselbe Länge
 * wie entlang der gemeinsamen Geraden.
 */
export function collinearOverlap(s1: Segment, s2: Segment): boolean {
  const [a1, a2] = s1;
  const [b1, b2] = s2;
  // Entlang der dominanten Achse projizieren (funktioniert auch diagonal,
  // weil beide Strecken auf derselben Geraden liegen).
  const horizontal = Math.abs(a2.x - a1.x) >= Math.abs(a2.y - a1.y);
  const lo1 = horizontal ? Math.min(a1.x, a2.x) : Math.min(a1.y, a2.y);
  const hi1 = horizontal ? Math.max(a1.x, a2.x) : Math.max(a1.y, a2.y);
  const lo2 = horizontal ? Math.min(b1.x, b2.x) : Math.min(b1.y, b2.y);
  const hi2 = horizontal ? Math.max(b1.x, b2.x) : Math.max(b1.y, b2.y);
  return Math.min(hi1, hi2) - Math.max(lo1, lo2) > EPS;
}

/**
 * ECHTE Kreuzung (Crossing): die Strecken schneiden sich in genau einem
 * inneren Punkt beider Strecken. Touch (Endpunkt auf der anderen Strecke)
 * und kollineare Überlappung sind KEIN Crossing — das Kollisionsmodell
 * klassifiziert sie anders (Touch: none/weighted, Overlap: hard).
 */
export function segmentsCross(s1: Segment, s2: Segment): boolean {
  return segmentsCrossWith(orientationsOf(s1, s2));
}

/**
 * `segmentsCross` aus vorberechneten Orientierungen: Nur der strikte Fall —
 * beide Endpunkte je Strecke auf verschiedenen Seiten der anderen, kollinear
 * (0) schließt „echt" aus.
 */
export const segmentsCrossWith = (o: Orientations): boolean =>
  o[0] !== 0 && o[1] !== 0 && o[2] !== 0 && o[3] !== 0 && o[0] !== o[1] && o[2] !== o[3];

/**
 * Schnittpunkt zweier ECHT kreuzender Strecken (`segmentsCross`).
 *
 * Gibt `undefined` zurück, wenn die Strecken sich nicht echt kreuzen —
 * Berührung und kollineare Überlappung haben keinen eindeutigen Punkt und
 * sind laut Kollisionsmodell (WP-3) ohnehin kein Crossing. Grundlage des
 * Kreuzungs-Hoppings (WP-7): der Punkt ist der Mittelpunkt des Bogens.
 */
export function segmentIntersectionPoint(s1: Segment, s2: Segment): Point | undefined {
  if (!segmentsCross(s1, s2)) return undefined;
  const [p1, q1] = s1;
  const [p2, q2] = s2;
  const r = { x: q1.x - p1.x, y: q1.y - p1.y };
  const s = { x: q2.x - p2.x, y: q2.y - p2.y };
  const denominator = r.x * s.y - r.y * s.x;
  // segmentsCross schließt Parallelität aus; die Prüfung bleibt als Absicherung.
  if (Math.abs(denominator) <= ORIENT_EPS) return undefined;
  const t = ((p2.x - p1.x) * s.y - (p2.y - p1.y) * s.x) / denominator;
  return { x: p1.x + t * r.x, y: p1.y + t * r.y };
}

/**
 * Quadratischer Abstand Punkt ↔ Strecke.
 *
 * PERF-002 (2026-10-03): interne Rechenform — `Math.hypot` ist rund 10×
 * teurer als eine Multiplikation, und Vergleiche brauchen keine Wurzel.
 * `distancePointToSegment` bleibt die öffentliche, exakt gleichwertige
 * Fassung (Wurzel des Quadrats).
 */
export const squaredDistancePointToSegment = (p: Point, s: Segment): number => {
  const [a, b] = s;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= EPS * EPS) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return px * px + py * py;
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const qx = p.x - (a.x + t * dx);
  const qy = p.y - (a.y + t * dy);
  return qx * qx + qy * qy;
};

/** Abstand Punkt ↔ Strecke (euklidisch). */
export function distancePointToSegment(p: Point, s: Segment): number {
  return Math.sqrt(squaredDistancePointToSegment(p, s));
}

/** Quadratischer Abstand zweier Strecken, die sich NICHT schneiden. */
export const squaredDistanceBetweenDisjointSegments = (s1: Segment, s2: Segment): number =>
  Math.min(
    squaredDistancePointToSegment(s1[0], s2),
    squaredDistancePointToSegment(s1[1], s2),
    squaredDistancePointToSegment(s2[0], s1),
    squaredDistancePointToSegment(s2[1], s1)
  );

/**
 * Abstand zweier Strecken, die sich **nicht** schneiden.
 *
 * PERF-002: Der Aufrufer hat Schnitt/Berührung (Orientierungen, Box-Prädikate)
 * bereits ausgeschlossen; die zweite `segmentsIntersect`-Prüfung entfällt.
 * Exakt derselbe Wert wie `distanceSegmentToSegment` — nur ohne die Arbeit,
 * die der Aufrufer schon geleistet hat.
 */
export const distanceBetweenDisjointSegments = (s1: Segment, s2: Segment): number =>
  Math.sqrt(squaredDistanceBetweenDisjointSegments(s1, s2));

/** Abstand Strecke ↔ Strecke (0 bei Schnitt/Berührung). */
export function distanceSegmentToSegment(s1: Segment, s2: Segment): number {
  if (segmentsIntersect(s1, s2)) return 0;
  return distanceBetweenDisjointSegments(s1, s2);
}

/**
 * Liegen zwei Strecken weiter als `distance` auseinander?
 *
 * Billige, **exakte** Vorprüfung über die achsenparallelen Hüllboxen: Berührt
 * die um `distance` aufgeblasene Box von A die Box von B nicht, ist der
 * Abstand beider Strecken sicher > `distance` (denn für jedes Punktpaar gilt
 * dann |Δx| > distance ODER |Δy| > distance).
 *
 * Der Umkehrschluss ist nur ein Notwendigkeitskriterium — die Vorprüfung
 * spart Arbeit, sie entscheidet nichts: Wer `false` bekommt, klassifiziert
 * wie bisher. PERF-002: In den Suchschleifen des Routers liegt der weit
 * überwiegende Teil der Paare außerhalb jeder Freigabe; dort ersetzt diese
 * Prüfung vier Wurzeln durch vier Vergleiche.
 */
export const segmentsApartByMoreThan = (s1: Segment, s2: Segment, distance: number): boolean => {
  const aMinX = Math.min(s1[0].x, s1[1].x);
  const aMaxX = Math.max(s1[0].x, s1[1].x);
  const aMinY = Math.min(s1[0].y, s1[1].y);
  const aMaxY = Math.max(s1[0].y, s1[1].y);
  const bMinX = Math.min(s2[0].x, s2[1].x);
  const bMaxX = Math.max(s2[0].x, s2[1].x);
  const bMinY = Math.min(s2[0].y, s2[1].y);
  const bMaxY = Math.max(s2[0].y, s2[1].y);
  return (
    bMinX > aMaxX + distance ||
    bMaxX < aMinX - distance ||
    bMinY > aMaxY + distance ||
    bMaxY < aMinY - distance
  );
};

/** Abstand Strecke ↔ Rechteck (0, wenn die Strecke die Box berührt/schneidet). */
export function distanceSegmentToRect(s: Segment, r: Rect): number {
  const corners: Point[] = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
  // Endpunkt in der Box (inkl. Rand) ⇒ Abstand 0.
  const inside = (p: Point): boolean =>
    p.x >= r.x - EPS && p.x <= r.x + r.width + EPS && p.y >= r.y - EPS && p.y <= r.y + r.height + EPS;
  if (inside(s[0]) || inside(s[1])) return 0;
  let min = Infinity;
  for (let i = 0; i < 4; i++) {
    const edge: Segment = [corners[i]!, corners[(i + 1) % 4]!];
    if (segmentsIntersect(s, edge)) return 0;
    min = Math.min(min, distanceSegmentToSegment(s, edge));
  }
  return min;
}
