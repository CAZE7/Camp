/**
 * lib/planner/routing-core/candidates.ts
 *
 * Generates deterministic routing candidates for one edge.
 *
 * Candidates are:
 *  - direct orthogonal L-shapes between the handle ports,
 *  - A* routes through the obstacle-aware corridor graph,
 *  - A* routes with source/target offsets (execution on different lane levels).
 */

import type {
  PlannerNode,
  PlannerNodeData,
  Point,
} from '../domainModel';
import type { CorridorGraph } from '../geometry/corridor';
import { bboxFromNode } from '../geometry/collision';
import { GEOMETRY } from '../tokens';
import type { RouteCandidate } from './types';
import {
  astarRoute,
  prepareRoutedEdges,
  type AStarOptions,
  type RoutedGeometry,
} from './astar';
import type { CostWeights } from './costModel';

export type GenerateCandidatesOptions = {
  readonly graph: CorridorGraph;
  readonly edgeId: string;
  readonly sourceNode: PlannerNode<PlannerNodeData>;
  readonly targetNode: PlannerNode<PlannerNodeData>;
  readonly sourceHandle?: string;
  readonly targetHandle?: string;
  readonly weights?: CostWeights;
  readonly maxCandidates?: number;
  readonly routed?: readonly RoutedGeometry[];
};

const OFFSETS: readonly number[] = [
  0,
  GEOMETRY.laneGrid,
];

export function generateRoutingCandidates(
  options: GenerateCandidatesOptions,
): readonly RouteCandidate[] {
  const {
    graph,
    edgeId,
    maximum,
  } = {
    maximum: options.maxCandidates ?? 8,
    ...options,
  };

  const sourcePort = portPoint(options.sourceNode, options.sourceHandle);
  const targetPort = portPoint(options.targetNode, options.targetHandle);
  const routedBounded = prepareRoutedEdges(options.routed ?? []);

  const candidates: RouteCandidate[] = [];
  let sequence = 0;

  // 1. Direct orthogonal L candidates (no offsets, no A*).
  addDirectCandidates(candidates, edgeId, sourcePort, targetPort, sequence);
  sequence += 2;

  // 2. A* with lane offsets. [0,0] is the canonical corridor route.
  for (const sourceOffset of OFFSETS) {
    for (const targetOffset of OFFSETS) {
      if (sourceOffset === 0 && targetOffset === 0) continue;

      const start = translatePortOutward(
        sourcePort,
        options.sourceHandle,
        sourceOffset,
      );
      const goal = translatePortOutward(
        targetPort,
        options.targetHandle,
        targetOffset,
      );

      const path = astarRoute(makeAStarOptions(options, start, goal, routedBounded));
      if (!path || path.length < 2) continue;

      const points = prependAndAppend(
        path,
        sourcePort,
        targetPort,
      );
      candidates.push({
        id: candidateId(edgeId, sequence++),
        edgeId,
        points,
        sourceHandle: options.sourceHandle,
        targetHandle: options.targetHandle,
      });
    }
  }

  // 3. Canonical A* route (zero offsets) is usually the strongest candidate.
  const canonical = astarRoute(
    makeAStarOptions(options, sourcePort, targetPort, routedBounded),
  );
  if (canonical && canonical.length >= 2) {
    candidates.push({
      id: candidateId(edgeId, sequence++),
      edgeId,
      points: prependAndAppend(canonical, sourcePort, targetPort),
      sourceHandle: options.sourceHandle,
      targetHandle: options.targetHandle,
    });
  }

  dedupeCandidates(candidates);
  return candidates.slice(0, maximum);
}

function addDirectCandidates(
  candidates: RouteCandidate[],
  edgeId: string,
  source: Point,
  target: Point,
  startSequence: number,
): void {
  if (samePoint(source, target)) {
    candidates.push({
      id: candidateId(edgeId, startSequence),
      edgeId,
      points: [source, target],
    });
    return;
  }

  // Horizontal-first and vertical-first L shapes.
  candidates.push({
    id: candidateId(edgeId, startSequence),
    edgeId,
    points: [source, { x: target.x, y: source.y }, target],
  });
  candidates.push({
    id: candidateId(edgeId, startSequence + 1),
    edgeId,
    points: [source, { x: source.x, y: target.y }, target],
  });
}

function makeAStarOptions(
  options: GenerateCandidatesOptions,
  start: Point,
  goal: Point,
  routedBounded: ReturnType<typeof prepareRoutedEdges>,
): AStarOptions {
  return {
    graph: options.graph,
    start,
    goal,
    weights: options.weights,
    routed: options.routed,
    routedBounded,
  };
}

function translatePortOutward(
  port: Point,
  handle: string | undefined,
  offset: number,
): Point {
  const side = portSide(handle);
  const outward = outwardVector(side);
  return {
    x: port.x + outward.x * offset,
    y: port.y + outward.y * offset,
  };
}

function prependAndAppend(
  path: readonly Point[],
  sourcePort: Point,
  targetPort: Point,
): readonly Point[] {
  const points: Point[] = [];
  points.push(sourcePort);
  for (const point of path) {
    if (!samePoint(points[points.length - 1], point)) points.push(point);
  }
  const last = points[points.length - 1];
  if (!samePoint(last, targetPort)) points.push(targetPort);
  return trimReversalSpikes(points);
}

/**
 * Removes grid overshoot spikes introduced when the A* path ends on a cell just
 * beyond the actual port and is then snapped back to the port. Only collinear
 * middle points that lie OUTSIDE the a->c span are removed. Straight grid runs
 * (points strictly between a and c) are intentionally kept unchanged.
 */
export function trimReversalSpikes(points: readonly Point[]): readonly Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = result[result.length - 1];
    const b = points[index];
    const c = points[index + 1];

    if (collinear(a, b, c) && !strictlyBetween(a, b, c)) {
      // b is an overshoot on the same line; the direct a->c segment is shorter
      // and semantically identical. Drop b.
      continue;
    }
    result.push(b);
  }
  result.push(points[points.length - 1]);

  return result;
}

function collinear(a: Point, b: Point, c: Point): boolean {
  const cross =
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(cross) < 1e-6;
}

function strictlyBetween(a: Point, b: Point, c: Point): boolean {
  const distanceAC = distance(a, c);
  if (distanceAC < 1e-6) return false;
  const distanceViaB = distance(a, b) + distance(b, c);
  return distanceViaB < distanceAC + 1e-6;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dedupeCandidates(candidates: RouteCandidate[]): void {
  const seen = new Set<string>();
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const key = candidates[index].points
      .map((point) => `${point.x}:${point.y}`)
      .join('|');
    if (seen.has(key)) {
      candidates.splice(index, 1);
    } else {
      seen.add(key);
    }
  }
}

function candidateId(edgeId: string, sequence: number): string {
  return `${edgeId}:${sequence}`;
}

// ---------------------------------------------------------------------------
// Port position helpers
// ---------------------------------------------------------------------------

type PortSide = 'left' | 'right' | 'top' | 'bottom';

export function portPoint(
  node: PlannerNode<PlannerNodeData>,
  handle: string | undefined,
): Point {
  const bbox = bboxFromNode(node);
  const side = portSide(handle);
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;

  switch (side) {
    case 'left':
      return { x: bbox.x, y: centerY };
    case 'top':
      return { x: centerX, y: bbox.y };
    case 'bottom':
      return { x: centerX, y: bbox.y + bbox.height };
    case 'right':
    default:
      return { x: bbox.x + bbox.width, y: centerY };
  }
}

function portSide(handle: string | undefined): PortSide {
  if (!handle) return 'right';
  const normalized = handle.toLowerCase();
  if (normalized.includes('left') || normalized.includes('minus') || normalized.includes('out')) {
    return 'left';
  }
  if (normalized.includes('top') || normalized.includes('up')) {
    return 'top';
  }
  if (normalized.includes('bottom') || normalized.includes('down')) {
    return 'bottom';
  }
  return 'right';
}

function outwardVector(side: PortSide): Point {
  switch (side) {
    case 'left':
      return { x: -1, y: 0 };
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'right':
    default:
      return { x: 1, y: 0 };
  }
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}
