import type { Node, XYPosition } from 'reactflow';
import { getNodeLayoutSize } from './layout';
import { PLANNER_SNAP_GRID } from '../constants';

export type NodeRect = { left: number; top: number; right: number; bottom: number };

export function nodeRect(node: Node, position: XYPosition = node.position): NodeRect {
  const { width, height } = getNodeLayoutSize(node);
  return {
    left: position.x,
    top: position.y,
    right: position.x + width,
    bottom: position.y + height,
  };
}

export function rectsOverlap(a: NodeRect, b: NodeRect): boolean {
  // Touching borders are allowed; only a positive-area intersection collides.
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function collidingNodeIds(node: Node, nodes: Node[], position: XYPosition = node.position): string[] {
  const candidate = nodeRect(node, position);
  return nodes
    .filter((other) => other.id !== node.id && other.type !== 'backboneGroup')
    .filter((other) => rectsOverlap(candidate, nodeRect(other)))
    .map((other) => other.id);
}

const snap = (value: number, grid: number): number => Math.round(value / grid) * grid;

/**
 * Finds the nearest grid position whose bounding box does not overlap another
 * node. Candidates are searched in expanding square rings, ordered by distance
 * within each ring, so the visual jump remains as small as possible.
 */
export function findNearestFreePosition(
  node: Node,
  nodes: Node[],
  grid: readonly [number, number] = PLANNER_SNAP_GRID,
  maxRings = 128
): XYPosition {
  const origin = {
    x: snap(node.position.x, grid[0]),
    y: snap(node.position.y, grid[1]),
  };
  if (collidingNodeIds(node, nodes, origin).length === 0) return origin;

  for (let ring = 1; ring <= maxRings; ring += 1) {
    const candidates: XYPosition[] = [];
    for (let dx = -ring; dx <= ring; dx += 1) {
      candidates.push({ x: origin.x + dx * grid[0], y: origin.y - ring * grid[1] });
      candidates.push({ x: origin.x + dx * grid[0], y: origin.y + ring * grid[1] });
    }
    for (let dy = -ring + 1; dy < ring; dy += 1) {
      candidates.push({ x: origin.x - ring * grid[0], y: origin.y + dy * grid[1] });
      candidates.push({ x: origin.x + ring * grid[0], y: origin.y + dy * grid[1] });
    }
    candidates.sort((a, b) =>
      Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
    );
    const free = candidates.find((position) => collidingNodeIds(node, nodes, position).length === 0);
    if (free) return free;
  }

  // A 4096 px search radius at the default grid is already far outside a
  // normal plan. This deterministic fallback still snaps and never returns NaN.
  return { x: origin.x + (maxRings + 1) * grid[0], y: origin.y };
}
