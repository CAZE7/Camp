/**
 * Unabhängige Geometrie-Primitive für die Orakel-Prüfung.
 *
 * Regeln für diese Datei (docs/ROUTING-QUALITY-AND-VERIFICATION.md §3.2):
 *
 *  1. **Kein Import aus dem Produktivpfad.** Keine `geometry`-Funktionen, keine
 *     `rules`-Helfer, kein Spatial Index. Nur Typen.
 *  2. **Absichtlich naiv.** Brute Force, offene Bedingungen, keine Vorprüfung,
 *     keine Wiederverwendung von Zwischenergebnissen. Langsam ist hier ein
 *     Feature: was schnell ist, teilt Fehler mit dem Router.
 *  3. **Semantik ist geteilt, Code nicht.** Die Bedingungen (offenes Band,
 *     echter Überlapp) sind dieselben wie in `lib/routing/geometry/rects.ts`,
 *     aber hier neu geschrieben. Weicht das Verhalten ab, ist genau das der
 *     Befund, den die Kreuzprobe melden soll.
 *
 * `EPS` ist bewusst derselbe Wert wie im Produktivpfad (1e-6). Toleranzen sind
 * Semantik, nicht Implementierung.
 */

import type { Point, Rect, Segment } from '../../../../lib/routing/geometry';

export const EPS = 1e-6;

/** Punkt echt innerhalb des Rechtecks (Rand zählt nicht). */
export function pointInOpenRect(point: Point, rect: Rect): boolean {
  const x0 = rect.x;
  const x1 = rect.x + rect.width;
  const y0 = rect.y;
  const y1 = rect.y + rect.height;
  return point.x > x0 + EPS && point.x < x1 - EPS && point.y > y0 + EPS && point.y < y1 - EPS;
}

/** Liegt der Punkt im geschlossenen Rechteck (Rand zählt)? */
export function pointInClosedRect(point: Point, rect: Rect): boolean {
  const x0 = rect.x;
  const x1 = rect.x + rect.width;
  const y0 = rect.y;
  const y1 = rect.y + rect.height;
  return point.x >= x0 - EPS && point.x <= x1 + EPS && point.y >= y0 - EPS && point.y <= y1 + EPS;
}

const isVertical = (segment: Segment): boolean => Math.abs(segment[0].x - segment[1].x) <= EPS;
const isHorizontal = (segment: Segment): boolean => Math.abs(segment[0].y - segment[1].y) <= EPS;

/**
 * Trifft das Segment das **Innere** des Rechtecks?
 *
 * Getrennt nach Achse geschrieben, ohne gemeinsame Hilfsfunktion:
 * liegt die Segmentkoordinate im offenen Band des Rechtecks und überlappt die
 * Ausdehnung des Segments die Ausdehnung des Rechtecks echt, dann trifft es.
 *
 * Eine Tangente am Rand ist **kein** Treffer (Randberührung ist Sache der
 * Freigabeprüfung I3, nicht der Durchdringung I1).
 */
export function segmentHitsRect(segment: Segment, rect: Rect): boolean {
  const [a, b] = segment;
  const x0 = rect.x;
  const x1 = rect.x + rect.width;
  const y0 = rect.y;
  const y1 = rect.y + rect.height;

  if (isVertical(segment)) {
    const x = a.x;
    if (x <= x0 + EPS || x >= x1 - EPS) return false;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return hi > y0 + EPS && lo < y1 - EPS;
  }

  if (isHorizontal(segment)) {
    const y = a.y;
    if (y <= y0 + EPS || y >= y1 - EPS) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return hi > x0 + EPS && lo < x1 - EPS;
  }

  // Nicht achsparallel: kann eine gültige Route nicht enthalten. Das Orakel
  // meldet die Diagonale nicht als Durchdringung — dafür gibt es die
  // Orthogonalitätsprüfung, die auf einer anderen Stufe liegt.
  return false;
}

/** Abstand zweier achsenparalleler Boxen; 0 bei Berührung oder Überlappung. */
export function boxGap(
  ax0: number,
  ax1: number,
  ay0: number,
  ay1: number,
  bx0: number,
  bx1: number,
  by0: number,
  by1: number
): number {
  const dx = Math.max(bx0 - ax1, 0, ax0 - bx1);
  const dy = Math.max(by0 - ay1, 0, ay0 - by1);
  return Math.hypot(dx, dy);
}

/**
 * Abstand Segment ↔ Rechteck.
 *
 * Ein Segment ist eine entartete Box (Höhe oder Breite 0), deshalb genügt der
 * Box-Abstand. Die Aussage „ein Punkt im Rechteck ⇒ Abstand 0“ fällt dabei
 * automatisch heraus und braucht keinen Sonderfall.
 */
export function segmentRectDistance(segment: Segment, rect: Rect): number {
  const [a, b] = segment;
  const sx0 = Math.min(a.x, b.x);
  const sx1 = Math.max(a.x, b.x);
  const sy0 = Math.min(a.y, b.y);
  const sy1 = Math.max(a.y, b.y);
  return boxGap(sx0, sx1, sy0, sy1, rect.x, rect.x + rect.width, rect.y, rect.y + rect.height);
}

/** Abstand zweier achsenparalleler Segmente (Box-Abstand). */
export function segmentDistance(a: Segment, b: Segment): number {
  const ax0 = Math.min(a[0].x, a[1].x);
  const ax1 = Math.max(a[0].x, a[1].x);
  const ay0 = Math.min(a[0].y, a[1].y);
  const ay1 = Math.max(a[0].y, a[1].y);
  const bx0 = Math.min(b[0].x, b[1].x);
  const bx1 = Math.max(b[0].x, b[1].x);
  const by0 = Math.min(b[0].y, b[1].y);
  const by1 = Math.max(b[0].y, b[1].y);
  return boxGap(ax0, ax1, ay0, ay1, bx0, bx1, by0, by1);
}

/**
 * Kollineare Überdeckung: beide Segmente auf derselben Achsenlinie und mit
 * echter Überlappungslänge (> 0). Nur das ist I2; eine Kreuzung ist es nicht.
 */
export function collinearOverlap(a: Segment, b: Segment): boolean {
  const aVert = isVertical(a);
  const bVert = isVertical(b);
  if (aVert !== bVert) return false;

  if (aVert) {
    if (Math.abs(a[0].x - b[0].x) > EPS) return false;
    const aLo = Math.min(a[0].y, a[1].y);
    const aHi = Math.max(a[0].y, a[1].y);
    const bLo = Math.min(b[0].y, b[1].y);
    const bHi = Math.max(b[0].y, b[1].y);
    return Math.min(aHi, bHi) - Math.max(aLo, bLo) > EPS;
  }

  if (Math.abs(a[0].y - b[0].y) > EPS) return false;
  const aLo = Math.min(a[0].x, a[1].x);
  const aHi = Math.max(a[0].x, a[1].x);
  const bLo = Math.min(b[0].x, b[1].x);
  const bHi = Math.max(b[0].x, b[1].x);
  return Math.min(aHi, bHi) - Math.max(aLo, bLo) > EPS;
}

/** Überlappen sich zwei Intervalle echt (positive Länge)? */
export function overlapLength(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1));
}

/**
 * Achsenparallele Segmente, die sich kreuzen (echte Kreuzung, kein Berühren am
 * Endpunkt). Wird vom Orakel nur für die Diagnose gebraucht, nicht für ein
 * Urteil: Kreuzungen sind erlaubt, aber zählbar (I10).
 */
export function segmentsCross(a: Segment, b: Segment): boolean {
  const aVert = isVertical(a);
  const bVert = isVertical(b);
  if (aVert === bVert) return false;
  const vertical = aVert ? a : b;
  const horizontal = aVert ? b : a;
  const vx = vertical[0].x;
  const vLo = Math.min(vertical[0].y, vertical[1].y);
  const vHi = Math.max(vertical[0].y, vertical[1].y);
  const hy = horizontal[0].y;
  const hLo = Math.min(horizontal[0].x, horizontal[1].x);
  const hHi = Math.max(horizontal[0].x, horizontal[1].x);
  return vx > hLo + EPS && vx < hHi - EPS && hy > vLo + EPS && hy < vHi - EPS;
}
