/** Preview-Routing (L-Stub-Vorschau) für betroffene Kanten während des Drags.
 *
 * Im Gegensatz zu `routeAllCables` wird hier:
 *   - KEIN A* durchgeführt (nur Katalog-Kandidaten)
 *   - KEIN Nudging angewendet
 *   - KEIN Alignment von gemeinsamen Korridoren
 *   - KEINE Kreuzungsminimierung (kein parallel lane offset search)
 *
 * Das ergibt eine schnelle Vorschau, die die grobe Richtung der Trasse zeigt.
 * Die volle Qualität wird beim Drag-Ende (debounced) nachgerüstet.
 *
 * Rein: Eingaben werden nicht verändert.
 */

import { type Node, Position } from 'reactflow';
import {
  findCablePath,
  nodesToObstacles,
  pathLength,
  countBends,
  type PathResult,
  type Rect,
} from './pathfinding';
import { polylineMidpoint, waypointsToPath, polarityPathOffset, parallelLaneOffset } from './pathUtils';
import { crossingSegmentsNear } from './routingCache';
import type { RouteEdgeRef } from './routeAll';
import { PARALLEL_LANE_SPREAD } from './pathUtils';

export const ROUTE_BORDER_RADIUS = 10;

/** Minimale Stub-Länge für Preview-Pfade (kürzer als volle 24px, dafür schneller). */
const _PREVIEW_STUB = 16;

function nodeCenter(node: Node): { x: number; y: number } {
  return {
    x: (node.positionAbsolute?.x ?? node.position.x) + (node.width || 192) / 2,
    y: (node.positionAbsolute?.y ?? node.position.y) + (node.height || 120) / 2,
  };
}

function centerDelta(from: Node | undefined, to: Node | undefined): { x: number; y: number } | undefined {
  if (!from || !to) return undefined;
  const fc = nodeCenter(from);
  const tc = nodeCenter(to);
  return { x: tc.x - fc.x, y: tc.y - fc.y };
}

function resolveHandlePointPreview(
  node: Node | undefined,
  handleId: string | null | undefined,
  kind: 'source' | 'target',
  flow?: { x: number; y: number }
): { x: number; y: number; position: Position } {
  if (!node) {
    return {
      x: 0,
      y: 0,
      position: kind === 'source' ? Position.Right : Position.Left,
    };
  }
  const originX = node.positionAbsolute?.x ?? node.position.x;
  const originY = node.positionAbsolute?.y ?? node.position.y;
  const w = node.width || 192;
  const h = node.height || 120;
  const t = handleId?.includes('minus') ? 0.7 : handleId?.includes('plus') ? 0.3 : 0.5;
  const horizontal = !flow || Math.abs(flow.x) >= Math.abs(flow.y);
  if (horizontal) {
    const right = flow ? flow.x > 0 : kind === 'source';
    return right
      ? { x: originX + w, y: originY + h * t, position: Position.Right }
      : { x: originX, y: originY + h * t, position: Position.Left };
  }
  const down = flow?.y ? flow.y > 0 : kind === 'target';
  return down
    ? { x: originX + w * t, y: originY + h, position: Position.Bottom }
    : { x: originX + w * t, y: originY, position: Position.Top };
}

/** Port-Reihenfolge für Preview — deterministisch, ohne komplexe Sortierung. */
function previewPortOrderedLaneOffsets(
  edges: RouteEdgeRef[],
  resolve: (edge: RouteEdgeRef, kind: 'source' | 'target') => { x: number; y: number; position: Position }
): Map<string, number> {
  const offsets = new Map<string, number>();
  const groups = new Map<string, { id: string; order: number }[]>();
  for (const edge of edges) {
    for (const kind of ['source', 'target'] as const) {
      const point = resolve(edge, kind);
      const far = resolve(edge, kind === 'source' ? 'target' : 'source');
      const horizontal = point.position === Position.Left || point.position === Position.Right;
      const key = `${kind}|${Math.round(point.x)}:${Math.round(point.y)}`;
      const group = groups.get(key) ?? [];
      group.push({ id: edge.id, order: horizontal ? far.y : far.x });
      groups.set(key, group);
    }
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    sorted.forEach((item, idx) => {
      offsets.set(item.id, (idx - (sorted.length - 1) / 2) * PARALLEL_LANE_SPREAD);
    });
  }
  return offsets;
}

export function routePreviewCables(nodes: Node[], edges: RouteEdgeRef[]): Map<string, PathResult> {
  const out = new Map<string, PathResult>();
  if (edges.length === 0) return out;

  const nodeById = new Map<string, Node>();
  for (const node of nodes) {
    if (node) nodeById.set(node.id, node);
  }

  const _allObstacles = nodesToObstacles(nodes, new Set());
  const edgeRefs = edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
  const _crossingAll =
    edgeRefs.length > 0
      ? crossingSegmentsNear(
          nodes,
          edgeRefs,
          { id: '\u0000-none', source: '', target: '' },
          planBounds(nodes)
        )
      : [];
  function planBounds(nodeList: Node[]): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeList) {
      const x = node.positionAbsolute?.x ?? node.position.x;
      const y = node.positionAbsolute?.y ?? node.position.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + (node.width || 192));
      maxY = Math.max(maxY, y + (node.height || 120));
    }
    return {
      x: minX - 200,
      y: minY - 200,
      width: maxX - minX + 400,
      height: maxY - minY + 400,
    };
  }

  const siblingEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
  }));

  const portOffsets = previewPortOrderedLaneOffsets(edges, (edge, kind) => {
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const flow = centerDelta(srcNode, tgtNode);
    return kind === 'source'
      ? resolveHandlePointPreview(srcNode, edge.sourceHandle, 'source', flow)
      : resolveHandlePointPreview(
          tgtNode,
          edge.targetHandle,
          'target',
          flow ? { x: -flow.x, y: -flow.y } : undefined
        );
  });

  for (const edge of edges) {
    if (!edge) continue;
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const flow = centerDelta(srcNode, tgtNode);
    const src = resolveHandlePointPreview(srcNode, edge.sourceHandle, 'source', flow);
    const tgt = resolveHandlePointPreview(
      tgtNode,
      edge.targetHandle,
      'target',
      flow ? { x: -flow.x, y: -flow.y } : undefined
    );
    const exclude = new Set([edge.source, edge.target]);
    const obstacles = nodesToObstacles(nodes, exclude);
    const lane =
      portOffsets.get(edge.id) ??
      parallelLaneOffset({
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        siblingEdges,
      });

    // Nur Katalog-Versuch — kein A*, kein Nudge, kein Alignment
    const result = findCablePath({
      sourceX: src.x,
      sourceY: src.y,
      sourcePosition: src.position,
      targetX: tgt.x,
      targetY: tgt.y,
      targetPosition: tgt.position,
      offset: polarityPathOffset(edge.sourceHandle) + lane,
      obstacles,
      crossingSegments: crossingSegmentsNear(
        nodes,
        edgeRefs,
        { id: edge.id, source: edge.source, target: edge.target },
        {
          x: Math.min(src.x, tgt.x) - 120,
          y: Math.min(src.y, tgt.y) - 120,
          width: Math.abs(src.x - tgt.x) + 240,
          height: Math.abs(src.y - tgt.y) + 240,
        }
      ),
    });

    const mid = polylineMidpoint(result.waypoints);
    out.set(edge.id, {
      path: waypointsToPath(result.waypoints, ROUTE_BORDER_RADIUS),
      waypoints: result.waypoints,
      labelX: mid.x,
      labelY: mid.y,
      offsetX: 0,
      offsetY: 0,
      length: pathLength(result.waypoints),
      bends: countBends(result.waypoints),
      crossings: 0, // Preview: keine zuverlässige Kreuzungszählung
      usedSearch: result.usedSearch,
    });
  }

  return out;
}

/** Reroute nur betroffene Kanten mit Preview-Qualität.
 *
 * Unbetroffene Kanten behalten ihre gecachten Pfade.
 */
export function reroutePreviewAffected(
  nodes: Node[],
  edges: RouteEdgeRef[],
  affectedIds: ReadonlySet<string>,
  cachedRoutes: Map<string, PathResult>
): Map<string, PathResult> {
  // Return a defensive copy of all cached routes, then overlay preview routes.
  const result = new Map<string, PathResult>();
  for (const [id, route] of cachedRoutes) {
    result.set(id, { ...route });
  }

  const affectedEdges = edges.filter((e) => affectedIds.has(e.id));
  if (affectedEdges.length === 0) {
    return result;
  }

  const previewRoutes = routePreviewCables(nodes, affectedEdges);
  for (const [id, route] of previewRoutes) {
    result.set(id, route);
  }
  return result;
}
