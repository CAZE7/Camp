import { EPS, type Point, type Rect } from './types';

/**
 * WP-2 (#392): Rechteck-Primitives — wörtliche Migration aus
 * `pathfinding.ts` (inflateRect, containsPoint, segmentHitsRect) plus
 * `inflateObstacle` mit Handle-Ausrissen (M11-1, ROUTING-V2.md §5).
 */

/** Box um `margin` in alle Richtungen vergrößern. */
export const inflateRect = (r: Rect, margin: number): Rect => ({
  x: r.x - margin,
  y: r.y - margin,
  width: r.width + margin * 2,
  height: r.height + margin * 2,
});

/** Liegt der Punkt ECHT im Inneren (Rand zählt nicht)? */
export const containsPoint = (r: Rect, p: Point): boolean =>
  p.x > r.x + EPS && p.x < r.x + r.width - EPS && p.y > r.y + EPS && p.y < r.y + r.height - EPS;

/** Echter Schnitt eines achsenparallelen Segments mit dem Inneren der Box. */
export function segmentHitsRect(a: Point, b: Point, r: Rect): boolean {
  if (Math.abs(a.x - b.x) <= EPS) {
    const x = a.x;
    if (x <= r.x + EPS || x >= r.x + r.width - EPS) return false;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return hi > r.y + EPS && lo < r.y + r.height - EPS;
  }
  if (Math.abs(a.y - b.y) <= EPS) {
    const y = a.y;
    if (y <= r.y + EPS || y >= r.y + r.height - EPS) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return hi > r.x + EPS && lo < r.x + r.width - EPS;
  }
  return true;
}

/** Achsenparallele Ausdehnung eines Handles relativ zur Node-Box (px). */
export type HandleExtent = { x: number; y: number; width: number; height: number };

/**
 * Hindernis-Box eines Nodes: Node-Rect ∪ Handle-Ausrisse, dann + Clearance.
 *
 * Handles sitzen seit M11-1 ±22 px AUSSERHALB der Node-Karte
 * (`overflow: visible`) — ohne Einrechnung verletzt der Stub die Clearance
 * am eigenen Knoten (ROUTING-V2.md §5). Entspricht der Logik in
 * `nodesToObstacles` (pathfinding.ts), hier als pure Primitive ohne
 * React-Flow-Typen.
 */
export function inflateObstacle(node: Rect, handles: readonly HandleExtent[], clearance: number): Rect {
  let x = node.x;
  let y = node.y;
  let x2 = node.x + node.width;
  let y2 = node.y + node.height;
  for (const hb of handles) {
    const hx = node.x + hb.x;
    const hy = node.y + hb.y;
    x = Math.min(x, hx);
    y = Math.min(y, hy);
    x2 = Math.max(x2, hx + hb.width);
    y2 = Math.max(y2, hy + hb.height);
  }
  return inflateRect({ x, y, width: x2 - x, height: y2 - y }, clearance);
}
