/**
 * lib/planner/routingV2Adapter.ts
 *
 * Adapter between the React Flow types used by the UI/store and the ELK/Dagre
 * layout engines. This is the only place that translates between the two type
 * families.
 *
 * Scope note: this module produces NODE POSITIONS only. Cable geometry is owned
 * exclusively by the global routing pass in `lib/routing/rules` (driven by
 * `components/edges/utils/cableRouteStore`). A second, parallel router used to
 * live under `lib/planner/routing-v2` and wrote `data.geometry` here; it
 * decided crossing hops by comparing edge IDs and priced overlaps as merely
 * expensive instead of forbidden, silently overriding the mature pass. It was
 * removed — see the consolidation note in `docs/`.
 */

import type { Edge, Node } from '@xyflow/react';
import type { CableEdgeData } from '../../components/edges/CableEdge';
import type { LayoutRequest, LayoutResult } from './layout-engine/contract';

export type V2Node = Node;
export type V2CableEdge = Edge<CableEdgeData>;

/**
 * Runs the industrial layout pipeline: ELK first, Dagre as a deterministic
 * fallback. Returns repositioned nodes; edges are passed through untouched.
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
    edges: [...edges],
  };
}
