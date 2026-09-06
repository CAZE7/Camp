/**
 * lib/planner/routing-v2/hopping.ts
 *
 * Post-processing step for unavoidable edge crossings.
 *
 * The router already penalizes crossings during candidate selection. This module
 * handles only the remaining crossings: it plans a deterministic hop for each
 * crossing and applies the hop plan to the routed polylines.
 *
 * Hopping is NOT a substitute for collision detection. It must be followed by a
 * re-run of the edge-edge overlap checks.
 */

import type { Point } from '../domainModel';
import {
  classifyEdgeEdgeIntersections,
  type EdgeEdgeCollision,
} from '../geometry/collision';
import { GEOMETRY, ROUTING } from '../tokens';

export type HoppingEdge = {
  readonly edgeId: string;
  readonly points: readonly Point[];
};

export type Hop = {
  readonly edgeId: string;
  readonly point: Point;
  readonly otherEdgeId: string;
};

export type HopPlan = {
  readonly hops: readonly Hop[];
  readonly crossingsBefore: number;
};

export type HopResult = {
  readonly edges: readonly HoppingEdge[];
  readonly hopsApplied: number;
  readonly crossingsBefore: number;
  readonly crossingsAfter: number;
};

export function planHops(
  edges: readonly HoppingEdge[],
  minGap = Math.max(4, GEOMETRY.laneGrid / 2),
): HopPlan {
  const hops: Hop[] = [];

  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const { crossings } = classifyEdgeEdgeIntersections(
        edges[i].edgeId,
        edges[i].points,
        edges[j].edgeId,
        edges[j].points,
      );

      for (const crossing of crossings) {
        const hopEdge = hopTarget(edges[i].edgeId, edges[j].edgeId);
        hops.push({
          edgeId: hopEdge,
          point: crossing.point,
          otherEdgeId: hopEdge === edges[i].edgeId ? edges[j].edgeId : edges[i].edgeId,
        });
        void minGap;
      }
    }
  }

  hops.sort((a, b) => {
    if (a.edgeId !== b.edgeId) return a.edgeId < b.edgeId ? -1 : 1;
    if (a.point.x !== b.point.x) return a.point.x - b.point.x;
    return a.point.y - b.point.y;
  });

  return { hops, crossingsBefore: hops.length };
}

export function applyHopPlan(
  plan: HopPlan,
  edges: readonly HoppingEdge[],
  hopHeight = Math.max(8, GEOMETRY.edgeEdgeSpacing / 2),
  hopHalf = Math.max(4, GEOMETRY.laneGrid / 2),
): readonly HoppingEdge[] {
  const resolved = new Map(edges.map((edge) => [edge.edgeId, [...edge.points]]));

  for (const hop of plan.hops) {
    const points = resolved.get(hop.edgeId);
    if (!points) continue;
    const updated = bumpPoints(points, hop.point, hopHeight, hopHalf);
    resolved.set(hop.edgeId, updated);
  }

  // Sort deterministically by edge id (HoppingEdge type is readonly for input,
  // but the returned list is a new canonical array).
  return Array.from(resolved.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([edgeId, points]) => ({
      edgeId,
      points: dedupePoints(points),
    }));
}

/**
 * Executes the hop pipeline and returns the crossings after the hop. This is the
 * "hop correctness" check used by the measurement suite.
 */
export function rerouteCrossings(
  edges: readonly HoppingEdge[],
  minGap?: number,
): HopResult {
  const plan = planHops(edges, minGap);
  const hopped = applyHopPlan(plan, edges);
  const crossingsAfter = countAllCrossings(hopped);
  return {
    edges: hopped,
    hopsApplied: plan.hops.length,
    crossingsBefore: plan.crossingsBefore,
    crossingsAfter,
  };
}

function hopTarget(edgeA: string, edgeB: string): string {
  return edgeA < edgeB ? edgeA : edgeB;
}

function bumpPoints(
  points: readonly Point[],
  crossing: Point,
  height: number,
  half: number,
): Point[] {
  const result: Point[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const used = segmentContainsPoint(a, b, crossing);

    if (!used || pointOnSegmentEndpoint(a, b, crossing)) {
      if (result.length === 0 || !samePoint(result[result.length - 1], a)) {
        result.push(a);
      }
      if (index === points.length - 2) {
        if (!samePoint(result[result.length - 1], b)) result.push(b);
      }
      continue;
    }

    const horizontal = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
    if (horizontal) {
      result.push(a);
      result.push({ x: crossing.x - half, y: crossing.y - height });
      result.push({ x: crossing.x + half, y: crossing.y - height });
      result.push({ x: crossing.x + half, y: crossing.y + 0 });
      result.push(b);
    } else {
      result.push(a);
      result.push({ x: crossing.x - height, y: crossing.y - half });
      result.push({ x: crossing.x - height, y: crossing.y + half });
      result.push({ x: crossing.x + 0, y: crossing.y + half });
      result.push(b);
    }
  }

  return dedupePoints(result);
}

function countAllCrossings(edges: readonly HoppingEdge[]): number {
  let count = 0;
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const { crossings } = classifyEdgeEdgeIntersections(
        edges[i].edgeId,
        edges[i].points,
        edges[j].edgeId,
        edges[j].points,
      );
      count += crossings.length;
    }
  }
  return count;
}

function segmentContainsPoint(a: Point, b: Point, p: Point): boolean {
  const tolerance = 1e-6;
  const cross =
    (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
  if (Math.abs(cross) > tolerance) return false;
  return (
    Math.min(a.x, b.x) - tolerance <= p.x &&
    p.x <= Math.max(a.x, b.x) + tolerance &&
    Math.min(a.y, b.y) - tolerance <= p.y &&
    p.y <= Math.max(a.y, b.y) + tolerance
  );
}

function pointOnSegmentEndpoint(a: Point, b: Point, p: Point): boolean {
  return samePoint(a, p) || samePoint(b, p);
}

function dedupePoints(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || !samePoint(last, point)) result.push(point);
  }
  return result;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}
