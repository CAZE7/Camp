import { Node, Position } from 'reactflow';
import {
  findCablePath,
  nodesToObstacles,
  edgesToCrossingSegments,
  inflateRect,
  pathLength,
  countBends,
  countCrossings,
  OBSTACLE_MARGIN,
  ROUTE_BORDER_RADIUS,
  type Point,
  type PathResult,
  type Rect,
} from './pathfinding';
import { polylineMidpoint, waypointsToPath, polarityPathOffset, parallelLaneOffset } from './pathUtils';
import { nudgeOrthogonalPaths } from './nudge';

export type RouteEdgeRef = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

type HandleBounds = {
  id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  position: Position;
};

type NodeWithHandles = Node & {
  handleBounds?: { source?: HandleBounds[]; target?: HandleBounds[] };
};

const NODE_W = 192;
const NODE_H = 120;

export function resolveHandlePoint(
  node: NodeWithHandles | undefined,
  handleId: string | null | undefined,
  kind: 'source' | 'target'
): { x: number; y: number; position: Position } {
  if (!node) {
    return { x: 0, y: 0, position: kind === 'source' ? Position.Right : Position.Left };
  }
  const originX = node.positionAbsolute?.x ?? node.position.x;
  const originY = node.positionAbsolute?.y ?? node.position.y;
  const group = node.handleBounds?.[kind] ?? node.handleBounds?.[kind === 'source' ? 'target' : 'source'];
  const wanted = handleId ?? null;
  const hb = group?.find((h) => (h.id ?? null) === wanted) ?? group?.[0];
  if (hb) {
    return {
      x: originX + hb.x + hb.width / 2,
      y: originY + hb.y + hb.height / 2,
      position: hb.position,
    };
  }
  const w = node.width || NODE_W;
  const h = node.height || NODE_H;
  const t = handleId?.includes('minus') ? 0.7 : handleId?.includes('plus') ? 0.3 : 0.5;
  if (kind === 'source') {
    return { x: originX + w, y: originY + h * t, position: Position.Right };
  }
  return { x: originX, y: originY + h * t, position: Position.Left };
}

const rebuild = (waypoints: Point[], crossings: number, usedSearch: PathResult['usedSearch']): PathResult => {
  const mid = polylineMidpoint(waypoints);
  return {
    path: waypointsToPath(waypoints, ROUTE_BORDER_RADIUS),
    waypoints,
    labelX: mid.x,
    labelY: mid.y,
    offsetX: 0,
    offsetY: 0,
    length: pathLength(waypoints),
    bends: countBends(waypoints),
    crossings,
    usedSearch,
  };
};

/**
 * Routet alle Kanten in einem Durchgang und schiebt parallele Trassen global.
 */
export function routeAllCables(nodes: Node[], edges: RouteEdgeRef[]): Map<string, PathResult> {
  const out = new Map<string, PathResult>();
  if (edges.length === 0) return out;

  const nodeById = new Map<string, Node>();
  for (let i = 0; i < nodes.length; i++) nodeById.set(nodes[i].id, nodes[i]);

  const allObstacles = nodesToObstacles(nodes, new Set());
  const crossingAll = edges.length > 120 ? [] : edgesToCrossingSegments(edges, nodes, () => false);

  const siblingEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
  }));

  const raw: { id: string; waypoints: Point[]; result: PathResult }[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const src = resolveHandlePoint(srcNode, edge.sourceHandle, 'source');
    const tgt = resolveHandlePoint(tgtNode, edge.targetHandle, 'target');
    const exclude = new Set([edge.source, edge.target]);
    const obstacles = nodesToObstacles(nodes, exclude);
    const lane = parallelLaneOffset({
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      siblingEdges,
    });
    const result = findCablePath({
      sourceX: src.x,
      sourceY: src.y,
      sourcePosition: src.position,
      targetX: tgt.x,
      targetY: tgt.y,
      targetPosition: tgt.position,
      offset: polarityPathOffset(edge.sourceHandle) + lane,
      obstacles,
      crossingSegments:
        edges.length > 120 ? [] : edgesToCrossingSegments(edges, nodes, (other) => other.id === edge.id),
    });
    raw.push({ id: edge.id, waypoints: result.waypoints, result });
  }

  const inflated: Rect[] = allObstacles.map((r) => inflateRect(r, OBSTACLE_MARGIN));
  const nudged = nudgeOrthogonalPaths(
    raw.map((r) => ({ id: r.id, waypoints: r.waypoints })),
    { obstacles: inflated }
  );

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const wp = nudged.get(item.id) ?? item.waypoints;
    const crossings = countCrossings(wp, crossingAll);
    out.set(item.id, rebuild(wp, crossings, item.result.usedSearch));
  }
  return out;
}
