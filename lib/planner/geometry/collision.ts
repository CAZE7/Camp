/**
 * lib/planner/geometry/collision.ts
 *
 * Collision and clearance checks for Routing V2. Pure geometry module — no UI,
 * no ELK, no React Flow.
 */

import type {
  BBox,
  Point,
  PlannerNode,
  PlannerNodeData,
  Segment,
} from '../domainModel';

export type CollisionType = 'edge-node' | 'edge-edge';

export type EdgeNodeCollision = {
  type: CollisionType;
  edgeId: string;
  nodeId: string;
};

export type EdgeEdgeCollision = {
  type: CollisionType;
  edgeA: string;
  edgeB: string;
  point: Point;
};

export type SegmentIntersection = {
  point: Point;
  overlap: boolean;
};

// ---------------------------------------------------------------------------
// BBox helpers
// ---------------------------------------------------------------------------

export function bboxFromNode(node: PlannerNode<PlannerNodeData>): BBox {
  const width = node.width ?? 120;
  const height = node.height ?? 80;
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

export function expandBBox(bbox: BBox, amount: number): BBox {
  return {
    x: bbox.x - amount,
    y: bbox.y - amount,
    width: bbox.width + amount * 2,
    height: bbox.height + amount * 2,
  };
}

/** Bounding box covering all nodes (used to define the search space bounds). */
export function boundingBoxOfNodes(
  nodes: readonly PlannerNode<PlannerNodeData>[],
  padding = 0,
): BBox {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const bbox = bboxFromNode(node);
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

// ---------------------------------------------------------------------------
// Path / segment helpers
// ---------------------------------------------------------------------------

export function pointsToSegments(points: readonly Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({ from: points[index], to: points[index + 1] });
  }
  return segments;
}

export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y,
    );
  }
  return total;
}

export function countBends(points: readonly Point[]): number {
  let bends = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const c = points[index + 1];
    const horizontalA = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
    const horizontalB = Math.abs(b.x - c.x) >= Math.abs(b.y - c.y);
    if (horizontalA !== horizontalB) bends += 1;
  }
  return bends;
}

// ---------------------------------------------------------------------------
// Primitive geometry
// ---------------------------------------------------------------------------

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  const crossValue = cross(p.x - a.x, p.y - a.y, b.x - a.x, b.y - a.y);
  if (Math.abs(crossValue) > 1e-9) return false;
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

/** Returns true when the two line segments touch or cross. */
export function segmentsIntersect(a: Segment, b: Segment): SegmentIntersection | null {
  const { from: p, to: q } = a;
  const { from: r, to: s } = b;

  const rX = q.x - p.x;
  const rY = q.y - p.y;
  const sX = s.x - r.x;
  const sY = s.y - r.y;

  const denominator = cross(rX, rY, sX, sY);

  if (Math.abs(denominator) > 1e-9) {
    const qpX = r.x - p.x;
    const qpY = r.y - p.y;
    const t = cross(qpX, qpY, sX, sY) / denominator;
    const u = cross(qpX, qpY, rX, rY) / denominator;

    if (t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) {
      return {
        point: { x: p.x + t * rX, y: p.y + t * rY },
        overlap: false,
      };
    }
    return null;
  }

  // Parallel / collinear case.
  const qpX = r.x - p.x;
  const qpY = r.y - p.y;
  if (Math.abs(cross(qpX, qpY, rX, rY)) > 1e-9) return null;

  // Handle axis-aligned collinear overlaps explicitly. The interval overlap must
  // have positive length; a single shared endpoint is not an overlap.
  const bothHorizontal =
    Math.abs(p.y - q.y) < 1e-9 && Math.abs(r.y - s.y) < 1e-9;
  const bothVertical =
    Math.abs(p.x - q.x) < 1e-9 && Math.abs(r.x - s.x) < 1e-9;

  if (bothHorizontal && Math.abs(p.y - r.y) < 1e-9) {
    const start = Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x));
    const end = Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x));
    if (end - start > 1e-6) {
      return { point: { x: start, y: p.y }, overlap: true };
    }
    return null;
  }

  if (bothVertical && Math.abs(p.x - r.x) < 1e-9) {
    const start = Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y));
    const end = Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y));
    if (end - start > 1e-6) {
      return { point: { x: p.x, y: start }, overlap: true };
    }
    return null;
  }

  return null;
}

/** Does a segment intersect an axis-aligned rectangle (inclusive)? */
export function segmentIntersectsBBox(a: Segment, bbox: BBox): boolean {
  // Liang-Barsky style rejection for each axis.
  let t0 = 0;
  let t1 = 1;
  const dx = a.to.x - a.from.x;
  const dy = a.to.y - a.from.y;

  const p = [-dx, dx, -dy, dy];
  const q = [
    a.from.x - bbox.x,
    bbox.x + bbox.width - a.from.x,
    a.from.y - bbox.y,
    bbox.y + bbox.height - a.from.y,
  ];

  for (let index = 0; index < 4; index += 1) {
    if (Math.abs(p[index]) < 1e-12) {
      if (q[index] < 0) return false;
    } else {
      const ratio = q[index] / p[index];
      if (p[index] < 0) {
        if (ratio > t1) return false;
        if (ratio > t0) t0 = ratio;
      } else {
        if (ratio < t0) return false;
        if (ratio < t1) t1 = ratio;
      }
    }
  }

  return true;
}

export function pointInsideBBox(point: Point, bbox: BBox): boolean {
  return (
    point.x >= bbox.x &&
    point.x <= bbox.x + bbox.width &&
    point.y >= bbox.y &&
    point.y <= bbox.y + bbox.height
  );
}

export function distancePointToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
    ),
  );
  const projection = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function distancePointToBBox(point: Point, bbox: BBox): number {
  const dx = Math.max(bbox.x - point.x, 0, point.x - (bbox.x + bbox.width));
  const dy = Math.max(bbox.y - point.y, 0, point.y - (bbox.y + bbox.height));
  return Math.hypot(dx, dy);
}

// ---------------------------------------------------------------------------
// Edge ↔ node
// ---------------------------------------------------------------------------

export function countEdgeNodeCollisions(
  edgeId: string,
  points: readonly Point[],
  nodeBBoxes: readonly { nodeId: string; bbox: BBox }[],
  excludedNodeIds: readonly string[],
  clearance: number,
): EdgeNodeCollision[] {
  const excluded = new Set(excludedNodeIds);
  const collisions: EdgeNodeCollision[] = [];

  for (const segment of pointsToSegments(points)) {
    for (const entry of nodeBBoxes) {
      if (excluded.has(entry.nodeId)) continue;
      if (segmentIntersectsBBox(segment, expandBBox(entry.bbox, clearance))) {
        collisions.push({ type: 'edge-node', edgeId, nodeId: entry.nodeId });
      }
    }
  }

  return collisions;
}

/** Smallest clearance between a path and all non-terminal node bboxes. */
export function minEdgeNodeClearance(
  points: readonly Point[],
  nodeBBoxes: readonly { nodeId: string; bbox: BBox }[],
  excludedNodeIds: readonly string[],
): number {
  const excluded = new Set(excludedNodeIds);
  let min = Number.POSITIVE_INFINITY;

  for (const segment of pointsToSegments(points)) {
    for (const entry of nodeBBoxes) {
      if (excluded.has(entry.nodeId)) continue;

      // Sample the segment so diagonal segments are handled too.
      const length = Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
      const steps = Math.max(1, Math.ceil(length / 4));
      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const sample: Point = {
          x: segment.from.x + (segment.to.x - segment.from.x) * t,
          y: segment.from.y + (segment.to.y - segment.from.y) * t,
        };
        min = Math.min(min, distancePointToBBox(sample, entry.bbox));
      }
    }
  }

  return min;
}

// ---------------------------------------------------------------------------
// Edge ↔ edge
// ---------------------------------------------------------------------------

export type EdgeEdgeIntersectionCategory = {
  readonly crossings: EdgeEdgeCollision[];
  readonly overlaps: EdgeEdgeCollision[];
};

/** Classifies intersections between two paths into crossings and overlaps. */
export function classifyEdgeEdgeIntersections(
  edgeA: string,
  pointsA: readonly Point[],
  edgeB: string,
  pointsB: readonly Point[],
): EdgeEdgeIntersectionCategory {
  return classifySegments(edgeA, pointsToSegments(pointsA), edgeB, pointsToSegments(pointsB));
}

/**
 * Segment-level classification used by the hot scoring path. Both segment sets
 * are resolved once by the caller, so repeated candidate-vs-routed comparisons
 * do not re-split polylines on every iteration.
 */
export function classifySegments(
  edgeA: string,
  segmentsA: readonly Segment[],
  edgeB: string,
  segmentsB: readonly Segment[],
): EdgeEdgeIntersectionCategory {
  const crossings: EdgeEdgeCollision[] = [];
  const overlaps: EdgeEdgeCollision[] = [];

  for (const a of segmentsA) {
    for (const b of segmentsB) {
      const intersection = segmentsIntersect(a, b);
      if (!intersection) continue;
      if (isSharedEndpoint(a, b, intersection.point)) continue;
      const collision: EdgeEdgeCollision = {
        type: 'edge-edge',
        edgeA,
        edgeB,
        point: intersection.point,
      };
      if (intersection.overlap) {
        overlaps.push(collision);
      } else {
        crossings.push(collision);
      }
    }
  }

  return { crossings, overlaps };
}

export function countEdgeEdgeOverlaps(
  edgeA: string,
  pointsA: readonly Point[],
  edgeB: string,
  pointsB: readonly Point[],
): EdgeEdgeCollision[] {
  const classified = classifyEdgeEdgeIntersections(edgeA, pointsA, edgeB, pointsB);
  return [...classified.overlaps, ...classified.crossings];
}

/** Coincident (collinear) overlaps only. These are hard collisions for gates. */
export function countCoincidentOverlaps(
  edgeA: string,
  pointsA: readonly Point[],
  edgeB: string,
  pointsB: readonly Point[],
): EdgeEdgeCollision[] {
  return classifyEdgeEdgeIntersections(edgeA, pointsA, edgeB, pointsB).overlaps;
}

/** Non-overlap edge crossings only (used by the hop metric). */
export function countCrossings(
  edgeA: string,
  pointsA: readonly Point[],
  edgeB: string,
  pointsB: readonly Point[],
): EdgeEdgeCollision[] {
  return classifyEdgeEdgeIntersections(edgeA, pointsA, edgeB, pointsB).crossings;
}

function isSharedEndpoint(a: Segment, b: Segment, point: Point): boolean {
  const aEndpoints = [a.from, a.to];
  const bEndpoints = [b.from, b.to];
  for (const ap of aEndpoints) {
    for (const bp of bEndpoints) {
      if (samePoint(ap, point) && samePoint(bp, point)) return true;
    }
  }
  return false;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}
