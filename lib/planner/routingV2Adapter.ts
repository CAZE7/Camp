/**
 * lib/planner/routingV2Adapter.ts
 *
 * Adapter between the React Flow types used by the UI/store and the pure
 * Routing V2 engine. This is the only place that translates between the two
 * type families.
 */

import type { Edge, Node } from 'reactflow';
import type { CableEdgeData } from '../../components/edges/CableEdge';
import {
  type PlannerEdge as DomainEdge,
  type PlannerNode as DomainNode,
  type PlannerNodeData,
} from './domainModel';
import type { LayoutRequest, LayoutResult } from './layout-engine/contract';
import { routeAllEdges } from './routing-v2/orchestrator';

export type V2Node = Node;
export type V2CableEdge = Edge<CableEdgeData>;
export type V2GeometryPoint = { x: number; y: number };

/**
 * Runs Routing V2 on React Flow nodes/edges and returns the same edge array
 * with `data.geometry` attached to every edge that was successfully routed.
 * Edges whose endpoints are not present are preserved unchanged.
 */
export function routeEdgesV2(nodes: readonly V2Node[], edges: readonly V2CableEdge[]): V2CableEdge[] {
  const domainNodes = nodes.map(toDomainNode);
  const domainEdges = edges.map(toDomainEdge);
  const result = routeAllEdges({ nodes: domainNodes, edges: domainEdges });
  const geometryByEdge = new Map(result.edges.map((edge) => [edge.edgeId, edge.points.map(toPosition)]));

  return edges.map((edge) => {
    const points = geometryByEdge.get(edge.id);
    if (!points) return edge;
    return {
      ...edge,
      data: {
        ...(edge.data ?? {}),
        geometry: { points },
      },
    } as V2CableEdge;
  }) as V2CableEdge[];
}

/**
 * Runs the industrial layout pipeline: ELK first, Dagre as a deterministic
 * fallback, then Routing V2 to produce final cable geometry.
 *
 * ELK is loaded lazily only when this function runs. The dependency is a client
 * bundle dependency so the app keeps working as a static export (the repo's
 * deployment mode); the engine still runs live in the user's browser.
 */
export async function applyAdvancedLayout(
  nodes: readonly V2Node[],
  edges: readonly V2CableEdge[],
  direction: 'LR' | 'TB' = 'LR'
): Promise<{ nodes: V2Node[]; edges: V2CableEdge[] }> {
  const { ElkLayoutEngine } = await import('./layout-engine/elk');
  const { DagreLayoutEngine } = await import('./layout-engine/dagre');

  const request: LayoutRequest = {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: typeof node.type === 'string' ? node.type : 'unknown',
      width: typeof node.width === 'number' ? node.width : undefined,
      height: typeof node.height === 'number' ? node.height : undefined,
    })),
    edges: edges
      .filter((edge) => Boolean(edge.source) && Boolean(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.type === 'waterPipe' ? 'waterPipe' : 'cable',
      })),
    direction,
  };

  let layoutResult: LayoutResult;
  try {
    layoutResult = await new ElkLayoutEngine().layout(request);
  } catch {
    layoutResult = await new DagreLayoutEngine().layout(request);
  }

  const positionById = new Map(
    layoutResult.nodes.map((node) => [
      node.id,
      { x: node.x, y: node.y, width: node.width, height: node.height },
    ])
  );

  const layoutedNodes = nodes.map((node) => {
    const position = positionById.get(node.id);
    if (!position) return node;
    return {
      ...node,
      position: { x: position.x, y: position.y },
      width: position.width,
      height: position.height,
    };
  });

  return {
    nodes: layoutedNodes,
    edges: routeEdgesV2(layoutedNodes, edges),
  };
}

// ---------------------------------------------------------------------------
// Private conversions
// ---------------------------------------------------------------------------

function toDomainNode(node: V2Node): DomainNode<PlannerNodeData> {
  return {
    id: node.id,
    type: typeof node.type === 'string' ? node.type : 'unknown',
    position: { x: node.position.x, y: node.position.y },
    data: node.data as PlannerNodeData,
    width: typeof node.width === 'number' ? node.width : undefined,
    height: typeof node.height === 'number' ? node.height : undefined,
  };
}

function toDomainEdge(edge: V2CableEdge): DomainEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: edge.type,
    data: edge.data,
  };
}

function toPosition(point: { x: number; y: number }): V2GeometryPoint {
  return { x: point.x, y: point.y };
}
