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
 * Berühren oder schneiden sich zwei Strecken? (Touch zählt mit —
 * das ist der bisherige Router-Begriff für die Kreuzungszählung.)
 */
export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const [p1, q1] = s1;
  const [p2, q2] = s2;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegmentBox(p1, p2, q1)) return true;
  if (o2 === 0 && onSegmentBox(p1, q2, q1)) return true;
  if (o3 === 0 && onSegmentBox(p2, p1, q2)) return true;
  if (o4 === 0 && onSegmentBox(p2, q1, q2)) return true;
  return false;
}

/** Sind beide Strecken kollinear (auf derselben Geraden)? */
export function areCollinear(s1: Segment, s2: Segment): boolean {
  return orientation(s1[0], s1[1], s2[0]) === 0 && orientation(s1[0], s1[1], s2[1]) === 0;
}

/**
 * Kollineare Überlappung mit echter gemeinsamer Länge (> EPS).
 * Punktberührung Ende-an-Ende zählt NICHT als Overlap.
 */
export function segmentsOverlap(s1: Segment, s2: Segment): boolean {
  if (!areCollinear(s1, s2)) return false;
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
  const [p1, q1] = s1;
  const [p2, q2] = s2;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  // Nur der strikte Fall: beide Endpunkte je Strecke auf verschiedenen
  // Seiten der anderen — kollinear (0) schließt „echt" aus.
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

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

/** Abstand Punkt ↔ Strecke (euklidisch). */
export function distancePointToSegment(p: Point, s: Segment): number {
  const [a, b] = s;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= EPS * EPS) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Abstand Strecke ↔ Strecke (0 bei Schnitt/Berührung). */
export function distanceSegmentToSegment(s1: Segment, s2: Segment): number {
  if (segmentsIntersect(s1, s2)) return 0;
  return Math.min(
    distancePointToSegment(s1[0], s2),
    distancePointToSegment(s1[1], s2),
    distancePointToSegment(s2[0], s1),
    distancePointToSegment(s2[1], s1)
  );
}

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
