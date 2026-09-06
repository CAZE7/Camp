import { ROUTING_TOKENS } from '../tokens';
import { EPS, type Point, type Segment } from './types';

/**
 * WP-2 (#392): Polylinien-Primitives — Migration aus `pathfinding.ts`
 * (manhattan, pathLength, countBends, isOrthogonalPath, simplifyWaypoints,
 * waypointsToSegments) plus die neuen Spec-Primitives Stub-Minimum-Check,
 * Bend-Merge und Lane-Berechnung (ROUTING-V2.md §5).
 */

export const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Manhattan-Länge einer Polylinie. */
export function pathLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) len += manhattan(points[i]!, points[i + 1]!);
  return len;
}

/** Zahl der 90°-Richtungswechsel. */
export function countBends(points: readonly Point[]): number {
  let bends = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const inH = Math.abs(curr.y - prev.y) <= EPS;
    const outH = Math.abs(next.y - curr.y) <= EPS;
    if (inH !== outH) bends++;
  }
  return bends;
}

/** Sind alle Segmente achsenparallel? */
export function isOrthogonalPath(points: readonly Point[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

/** Zerlegt eine Polylinie in Segmente (Null-Längen werden übersprungen). */
export function waypointsToSegments(points: readonly Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (a.x !== b.x || a.y !== b.y) segments.push([a, b]);
  }
  return segments;
}

/**
 * Entfernt Duplikate und kollineare Zwischenpunkte (gleiche Richtung).
 * Wörtliche Migration aus `pathfinding.simplifyWaypoints`.
 */
export function simplifyWaypoints(points: readonly Point[]): Point[] {
  if (points.length <= 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Point[] = [{ x: points[0]!.x, y: points[0]!.y }];
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const last = out[out.length - 1]!;
    if (Math.abs(last.x - p.x) <= EPS && Math.abs(last.y - p.y) <= EPS) continue;
    out.push({ x: p.x, y: p.y });
  }
  const collapsed: Point[] = [];
  for (let i = 0; i < out.length; i++) {
    if (collapsed.length >= 2) {
      const a = collapsed[collapsed.length - 2]!;
      const b = collapsed[collapsed.length - 1]!;
      const c = out[i]!;
      const vertical = Math.abs(a.x - b.x) <= EPS && Math.abs(b.x - c.x) <= EPS;
      const horizontal = Math.abs(a.y - b.y) <= EPS && Math.abs(b.y - c.y) <= EPS;
      if (vertical || horizontal) {
        const sameDir = vertical ? (b.y - a.y) * (c.y - b.y) >= -EPS : (b.x - a.x) * (c.x - b.x) >= -EPS;
        if (sameDir) {
          collapsed[collapsed.length - 1] = c;
          continue;
        }
      }
    }
    collapsed.push(out[i]!);
  }
  return collapsed;
}

/**
 * Stub-Minimum-Check (Invariante 5): erstes und letztes Segment sind
 * mindestens `stubMin` lang. Pfade mit < 2 Punkten gelten als verletzt.
 */
export function hasMinimumStubs(points: readonly Point[], stubMin: number = ROUTING_TOKENS.stubMin): boolean {
  const segments = waypointsToSegments(points);
  if (segments.length === 0) return false;
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  return manhattan(first[0], first[1]) >= stubMin - EPS && manhattan(last[0], last[1]) >= stubMin - EPS;
}

/**
 * Bend-Merge (ROUTING-V2.md §5): Zwischensegmente kürzer als
 * 2 × `bendRadius` erzeugen das „Zitter-Treppenmuster" — der Mittelpunkt
 * zweier benachbarter Bends wird entfernt, indem das kurze Segment auf die
 * Achse des Vorgängers gezogen wird. Endpunkte (Handles) bleiben unberührt;
 * das Ergebnis bleibt orthogonal und wird abschließend vereinfacht.
 *
 * Reine Funktion ohne Hindernis-Wissen — der Aufrufer prüft das Ergebnis
 * gegen Hindernisse (wie bei `alignSharedCorridors`).
 */
export function mergeCloseBends(
  points: readonly Point[],
  bendRadius: number = ROUTING_TOKENS.bendRadius
): Point[] {
  const threshold = 2 * bendRadius;
  let current = simplifyWaypoints(points);
  // Iterativ, weil ein Merge neue kurze Segmente erzeugen kann; die
  // Schleife terminiert, da jede Runde mindestens einen Punkt entfernt.
  for (let guard = 0; guard < points.length; guard++) {
    if (current.length < 5) return current;
    let merged = false;
    // Kurzes Innensegment a→b (beide Nachbarsegmente sind Bends): das
    // FOLGE-Segment b→c wird auf die Achse des Vorgängersegments prev→a
    // gezogen — die Doppelstufe entfällt. c darf kein Endpunkt sein
    // (Handles bleiben exakt), daher i ≤ length−4.
    for (let i = 1; i <= current.length - 4; i++) {
      const prev = current[i - 1]!;
      const a = current[i]!;
      const b = current[i + 1]!;
      const c = current[i + 2]!;
      if (manhattan(a, b) >= threshold - EPS) continue;
      const prevHorizontal = Math.abs(a.y - prev.y) <= EPS;
      // c auf die prev-Achse projizieren; a→c' läuft dann kollinear zu prev.
      const movedC = prevHorizontal ? { x: c.x, y: a.y } : { x: a.x, y: c.y };
      const candidate = [...current.slice(0, i + 1), movedC, ...current.slice(i + 3)];
      if (!isOrthogonalPath(candidate)) continue;
      current = simplifyWaypoints(candidate);
      merged = true;
      break;
    }
    if (!merged) return current;
  }
  return current;
}

/**
 * Lane-Berechnung (ROUTING-V2.md §5/§7): Versatz einer Lane vom
 * Referenzverlauf — `laneIndex × laneGrid`. Einzige Quelle für
 * Quer-Offsets der V2-Schicht (die LaneRegistry (WP-5) vergibt die Indizes).
 */
export function laneOffset(laneIndex: number, laneGrid: number = ROUTING_TOKENS.laneGrid): number {
  return laneIndex * laneGrid;
}
