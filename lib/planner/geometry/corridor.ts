/**
 * lib/planner/geometry/corridor.ts
 *
 * Builds the orthogonal corridor search space used by the A* router.
 *
 * The search space is a regular laneGrid graph. Nodes fall inside any expanded
 * node obstacle are removed except for the source/target nodes of the edge being
 * routed (those are excluded from the obstacle set, so ports remain reachable).
 */

import type { BBox, PlannerNode, PlannerNodeData, Point } from '../domainModel';
import { GEOMETRY, ROUTING } from '../tokens';
import { boundingBoxOfNodes, expandBBox, segmentIntersectsBBox } from './collision';

export type CorridorCell = {
  readonly gx: number;
  readonly gy: number;
  readonly x: number;
  readonly y: number;
};

export type CorridorGraphOptions = {
  readonly grid?: number;
  readonly padding?: number;
  readonly bounds?: BBox;
};

export class CorridorGraph {
  readonly bounds: BBox;
  readonly grid: number;
  readonly obstacleBBoxes: readonly BBox[];
  readonly excludedNodeIds: readonly string[];

  private readonly cellsByKey = new Map<string, CorridorCell>();
  private readonly neighborsByKey = new Map<string, readonly CorridorCell[]>();

  constructor(
    bounds: BBox,
    grid: number,
    obstacleBBoxes: readonly BBox[],
    excludedNodeIds: readonly string[],
    cells: readonly CorridorCell[],
    neighbors: ReadonlyMap<string, readonly CorridorCell[]>
  ) {
    this.bounds = bounds;
    this.grid = grid;
    this.obstacleBBoxes = obstacleBBoxes;
    this.excludedNodeIds = excludedNodeIds;
    for (const cell of cells) this.cellsByKey.set(cellKey(cell.gx, cell.gy), cell);
    Array.from(neighbors.entries()).forEach(([key, value]) => {
      this.neighborsByKey.set(key, value);
    });
  }

  hasCell(gx: number, gy: number): boolean {
    return this.cellsByKey.has(cellKey(gx, gy));
  }

  cellAt(gx: number, gy: number): CorridorCell | undefined {
    return this.cellsByKey.get(cellKey(gx, gy));
  }

  cellCount(): number {
    return this.cellsByKey.size;
  }

  neighbors(cell: CorridorCell): readonly CorridorCell[] {
    return this.neighborsByKey.get(cellKey(cell.gx, cell.gy)) ?? [];
  }

  nearestCell(point: Point): CorridorCell | undefined {
    const gx = Math.round((point.x - this.bounds.x) / this.grid);
    const gy = Math.round((point.y - this.bounds.y) / this.grid);
    const direct = this.cellAt(gx, gy);
    if (direct) return direct;

    // Small deterministic search for the nearest free cell.
    let best: CorridorCell | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cell of Array.from(this.cellsByKey.values())) {
      const distance = Math.abs(cell.x - point.x) + Math.abs(cell.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cell;
      }
    }
    return best;
  }
}

export function buildCorridorGraph(
  nodes: readonly PlannerNode<PlannerNodeData>[],
  excludedNodeIds: readonly string[],
  options: CorridorGraphOptions = {}
): CorridorGraph {
  const grid = options.grid ?? GEOMETRY.laneGrid;
  const padding = options.padding ?? ROUTING.searchPadding;
  const bounds = options.bounds ?? boundingBoxOfNodes(nodes, padding);

  const excluded = new Set(excludedNodeIds);
  const obstacleBBoxes = nodes
    .filter((node) => !excluded.has(node.id))
    .map((node) => expandBBox(boxFromNode(node), GEOMETRY.edgeNodeSpacing / 2));

  const widthCells = Math.ceil(bounds.width / grid) + 1;
  const heightCells = Math.ceil(bounds.height / grid) + 1;

  const cells: CorridorCell[] = [];
  const blocked = new Set<string>();

  for (let gy = 0; gy < heightCells; gy += 1) {
    for (let gx = 0; gx < widthCells; gx += 1) {
      const cell: CorridorCell = {
        gx,
        gy,
        x: bounds.x + gx * grid,
        y: bounds.y + gy * grid,
      };
      if (isCellBlocked(cell, obstacleBBoxes)) {
        blocked.add(cellKey(gx, gy));
        continue;
      }
      cells.push(cell);
    }
  }

  const neighbors = buildNeighbors(cells, obstacleBBoxes, blocked);

  return new CorridorGraph(bounds, grid, obstacleBBoxes, excludedNodeIds, cells, neighbors);
}

function boxFromNode(node: PlannerNode<PlannerNodeData>): BBox {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.width ?? GEOMETRY.defaultNodeWidth,
    height: node.height ?? GEOMETRY.defaultNodeHeight,
  };
}

function isCellBlocked(cell: CorridorCell, obstacles: readonly BBox[]): boolean {
  const point: Point = { x: cell.x, y: cell.y };
  return obstacles.some((bbox) => {
    return (
      point.x >= bbox.x &&
      point.x <= bbox.x + bbox.width &&
      point.y >= bbox.y &&
      point.y <= bbox.y + bbox.height
    );
  });
}

function buildNeighbors(
  cells: readonly CorridorCell[],
  obstacleBBoxes: readonly BBox[],
  blocked: ReadonlySet<string>
): ReadonlyMap<string, readonly CorridorCell[]> {
  const byKey = new Map<string, CorridorCell>();
  for (const cell of cells) byKey.set(cellKey(cell.gx, cell.gy), cell);

  const neighbors = new Map<string, CorridorCell[]>();
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const cell of cells) {
    const list: CorridorCell[] = [];
    for (const dir of directions) {
      const target = byKey.get(cellKey(cell.gx + dir.dx, cell.gy + dir.dy));
      if (!target || blocked.has(cellKey(target.gx, target.gy))) continue;

      const segment = { from: cell, to: target };
      if (obstacleBBoxes.some((bbox) => segmentIntersectsBBox(segment, bbox))) {
        continue;
      }
      list.push(target);
    }
    list.sort((a, b) => {
      if (a.gy !== b.gy) return a.gy - b.gy;
      if (a.gx !== b.gx) return a.gx - b.gx;
      return 0;
    });
    neighbors.set(cellKey(cell.gx, cell.gy), list);
  }

  return neighbors;
}

function cellKey(gx: number, gy: number): string {
  return `${gx}:${gy}`;
}
