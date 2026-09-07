/**
 * lib/planner/routing-core/astar.ts
 *
 * Deterministic A* over the orthogonal corridor graph.
 *
 * The graph already excludes cells that would collide with obstacles, so A*
 * never expands a segment which violates the clearance boundary.
 *
 * Crossings / overlaps against already routed edges are penalized during the
 * search. For performance the routed edges are pre-filtered by bounding box,
 * which is exactly equivalent to the full segment collision test.
 */

import type { Point, Segment } from '../domainModel';
import type { CorridorCell, CorridorGraph } from '../geometry/corridor';
import { ROUTING } from '../tokens';
import { classifyEdgeEdgeIntersections } from '../geometry/collision';
import type { CostWeights } from './costModel';
import { defaultCostWeights } from './costModel';

export type RoutedGeometry = {
  readonly edgeId: string;
  readonly points: readonly Point[];
};

export type AStarOptions = {
  readonly graph: CorridorGraph;
  readonly start: Point;
  readonly goal: Point;
  readonly weights?: CostWeights;
  readonly maxIterations?: number;
  /** Already routed edges. A* penalizes crossings/overlaps against these. */
  readonly routed?: readonly RoutedGeometry[];
  /**
   * Pre-bounded routed edges. When routing several candidates for the same edge
   * this is computed once instead of once per candidate.
   */
  readonly routedBounded?: readonly RoutedWithBounds[];
};

export function prepareRoutedEdges(
  routed: readonly RoutedGeometry[],
): readonly RoutedWithBounds[] {
  return routed.map(withBounds);
}

type AStarCell = {
  readonly gx: number;
  readonly gy: number;
  readonly point: Point;
  readonly prev: AStarCell | undefined;
  readonly g: number;
  readonly f: number;
  readonly incomingDir: 'H' | 'V' | undefined;
  readonly sequence: number;
};

type RoutedWithBounds = {
  readonly edgeId: string;
  readonly points: readonly Point[];
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
};

/**
 * Binary min-heap for the A* open list. The previous implementation re-sorted a
 * plain array on every expansion, which made dense grids O(n^2 log n). The heap
 * keeps the industrial fixtures within the interactive performance budget while
 * preserving the deterministic tie-break (f, then gx, then gy, then sequence).
 */
class MinHeap {
  private readonly items: AStarCell[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: AStarCell): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): AStarCell | undefined {
    const items = this.items;
    const count = items.length;
    if (count === 0) return undefined;
    if (count === 1) return items.pop();

    const top = items[0];
    const last = items.pop() as AStarCell;
    items[0] = last;
    this.siftDown(0);
    return top;
  }

  private siftUp(index: number): void {
    const items = this.items;
    const entry = items[index];
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parent = items[parentIndex];
      if (compare(parent, entry) <= 0) break;
      items[index] = parent;
      index = parentIndex;
    }
    items[index] = entry;
  }

  private siftDown(index: number): void {
    const items = this.items;
    const count = items.length;
    const entry = items[index];

    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= count) break;

      let smallest = left;
      if (right < count) {
        const rightEntry = items[right];
        const leftEntry = items[left];
        if (compare(rightEntry, leftEntry) < 0) smallest = right;
      }

      const child = items[smallest];
      if (compare(entry, child) <= 0) break;
      items[index] = child;
      index = smallest;
    }
    items[index] = entry;
  }
}

function compare(a: AStarCell, b: AStarCell): number {
  if (a.f !== b.f) return a.f - b.f;
  if (a.gx !== b.gx) return a.gx - b.gx;
  if (a.gy !== b.gy) return a.gy - b.gy;
  return a.sequence - b.sequence;
}

let sequenceCounter = 0;

export function astarRoute(options: AStarOptions): readonly Point[] | undefined {
  const { graph, start, goal } = options;
  const weights = options.weights ?? defaultCostWeights();
  const maxIterations = options.maxIterations ?? 20_000;

  const startCell = graph.nearestCell(start);
  const goalCell = graph.nearestCell(goal);
  if (!startCell || !goalCell) return undefined;

  if (startCell.gx === goalCell.gx && startCell.gy === goalCell.gy) {
    return [snapPoint(startCell), snapPoint(startCell)];
  }

  const segmentCost =
    (graph.grid / ROUTING.pxPerMeter) * weights.lengthPerMeter +
    weights.routeSegment;

  const routedWithBounds =
    options.routedBounded ?? (options.routed ?? []).map(withBounds);

  const open = new MinHeap();
  const byKey = new Map<string, AStarCell>();

  const startNode: AStarCell = {
    gx: startCell.gx,
    gy: startCell.gy,
    point: snapPoint(startCell),
    prev: undefined,
    g: 0,
    f: heuristic(startCell, goalCell, weights),
    incomingDir: undefined,
    sequence: sequenceCounter++,
  };
  open.push(startNode);
  byKey.set(cellKey(startNode.gx, startNode.gy), startNode);

  const closed = new Set<string>();
  let iterations = 0;

  while (open.size > 0) {
    iterations += 1;
    if (iterations > maxIterations) return undefined;

    const current = open.pop() as AStarCell;
    const key = cellKey(current.gx, current.gy);

    if (closed.has(key)) continue;
    if (current.gx === goalCell.gx && current.gy === goalCell.gy) {
      return reconstruct(current);
    }
    closed.add(key);

    const cell = graph.cellAt(current.gx, current.gy);
    if (!cell) continue;

    const neighbors = graph.neighbors(cell);
    for (const neighbor of neighbors) {
      const neighborKey = cellKey(neighbor.gx, neighbor.gy);
      if (closed.has(neighborKey)) continue;

      const nextDir = direction(current, neighbor);
      const bendCost = current.incomingDir && current.incomingDir !== nextDir
        ? weights.bend
        : 0;
      const segment: Segment = {
        from: current.point,
        to: { x: neighbor.x, y: neighbor.y },
      };
      const interferenceCost = interferencePenalty(
        segment,
        routedWithBounds,
        weights,
      );
      const g = current.g + segmentCost + bendCost + interferenceCost;

      const existing = byKey.get(neighborKey);
      if (existing && existing.g <= g) continue;

      const next: AStarCell = {
        gx: neighbor.gx,
        gy: neighbor.gy,
        point: snapPoint(neighbor),
        prev: current,
        g,
        f: g + heuristic(neighbor, goalCell, weights),
        incomingDir: nextDir,
        sequence: sequenceCounter++,
      };
      byKey.set(neighborKey, next);
      open.push(next);
    }
  }

  return undefined;
}

function heuristic(
  current: CorridorCell,
  goal: CorridorCell,
  weights: CostWeights,
): number {
  const distance =
    Math.abs(goal.x - current.x) + Math.abs(goal.y - current.y);
  return (distance / ROUTING.pxPerMeter) * weights.lengthPerMeter;
}

function direction(
  current: AStarCell,
  next: CorridorCell,
): 'H' | 'V' {
  if (current.gy === next.gy) return 'H';
  return 'V';
}

function reconstruct(current: AStarCell): readonly Point[] {
  const cells: AStarCell[] = [];
  let walker: AStarCell | undefined = current;
  while (walker) {
    cells.push(walker);
    walker = walker.prev;
  }
  cells.reverse();
  return cells.map((cell) => cell.point);
}

function withBounds(routed: RoutedGeometry): RoutedWithBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of routed.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    edgeId: routed.edgeId,
    points: routed.points,
    minX,
    maxX,
    minY,
    maxY,
  };
}

function segmentBounds(segment: Segment): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return {
    minX: Math.min(segment.from.x, segment.to.x),
    maxX: Math.max(segment.from.x, segment.to.x),
    minY: Math.min(segment.from.y, segment.to.y),
    maxY: Math.max(segment.from.y, segment.to.y),
  };
}

function boundsOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  return (
    a.minX <= b.maxX + 1e-9 &&
    a.maxX >= b.minX - 1e-9 &&
    a.minY <= b.maxY + 1e-9 &&
    a.maxY >= b.minY - 1e-9
  );
}

/**
 * Penalizes a candidate segment for crossing or overlapping already routed
 * edges. The bounding-box pre-filter is a pure optimization: a routed edge whose
 * bbox does not touch the candidate bbox cannot intersect it, so the exact
 * collision primitives are only invoked on candidates that actually overlap.
 */
function interferencePenalty(
  segment: Segment,
  routed: readonly RoutedWithBounds[],
  weights: CostWeights,
): number {
  let cost = 0;
  const segmentPath: readonly Point[] = [segment.from, segment.to];
  const segmentBox = segmentBounds(segment);

  for (const existing of routed) {
    if (!boundsOverlap(segmentBox, existing)) continue;

    const { crossings, overlaps } = classifyEdgeEdgeIntersections(
      'segment',
      segmentPath,
      existing.edgeId,
      existing.points,
    );
    cost += crossings.length * weights.hop + overlaps.length * weights.collision;
  }

  return cost;
}

function snapPoint(cell: CorridorCell): Point {
  return { x: cell.x, y: cell.y };
}

function cellKey(gx: number, gy: number): string {
  return `${gx}:${gy}`;
}
