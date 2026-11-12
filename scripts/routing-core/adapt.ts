/**
 * Adapter: Produktiv-Datenmodell → Eingabe des Routing-Kerns.
 *
 * Lebt bewusst in der App-Schicht (Regel A): `lib/routing-core/` darf nichts
 * aus `components/` importieren. Der Adapter ist die **einzige** Stelle, die
 * beide Welten kennt — dadurch ist der Kern ohne React Flow testbar und der
 * A/B-Vergleich benutzt für beide Engines dieselben Port-Punkte
 * (`resolveHandlePoint`, dieselbe R-7-Flussrichtung wie `routeAllCables`).
 */

import { Position } from '@xyflow/react';
import {
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type RoutableNode,
} from '../../components/edges/utils/nodeGeometry';
import { resolveHandlePoint, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import type { CoreEdge, CoreHandle, CoreInput, CoreNode, CoreSide } from '../../lib/routing-core';

const NODE_W = 192;
const NODE_H = 120;

const sideOf = (position: Position): CoreSide => {
  switch (position) {
    case Position.Left:
      return 'left';
    case Position.Right:
      return 'right';
    case Position.Top:
      return 'top';
    case Position.Bottom:
    default:
      return 'bottom';
  }
};

const centerOf = (node: RoutableNode): { x: number; y: number } => ({
  x: nodeOriginX(node) + nodeWidth(node, NODE_W) / 2,
  y: nodeOriginY(node) + nodeHeight(node, NODE_H) / 2,
});

export type AdaptResult =
  | { readonly ok: true; readonly input: CoreInput }
  | { readonly ok: false; readonly missing: readonly string[] };

/**
 * Übersetzt Knoten und Kanten. Kanten, derenAnschlüsse nicht auflösbar sind,
 * werden **nicht** erfunden (Regel M): sie landen in `missing` und werden vom
 * Aufrufer gemeldet — genau wie `checkRoutingInputs` es für den Bestandsrouter tut.
 */
export function adaptPlan(nodes: readonly RoutableNode[], edges: readonly RouteEdgeRef[]): AdaptResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const coreNodes: CoreNode[] = [];
  const handleCache = new Map<string, CoreHandle>();

  for (const node of [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const rect = {
      x: nodeOriginX(node),
      y: nodeOriginY(node),
      width: nodeWidth(node, NODE_W),
      height: nodeHeight(node, NODE_H),
    };
    coreNodes.push({ id: node.id, rect, handles: [] });
  }
  const index = new Map(coreNodes.map((node, i) => [node.id, i]));

  const missing: string[] = [];
  const coreEdges: CoreEdge[] = [];
  const sortedEdges = [...edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const edge of sortedEdges) {
    const sourceNode = byId.get(edge.source);
    const targetNode = byId.get(edge.target);
    if (!sourceNode || !targetNode) {
      missing.push(`${edge.id}: Bauteil fehlt`);
      continue;
    }
    const srcCenter = centerOf(sourceNode);
    const tgtCenter = centerOf(targetNode);
    const flow = { x: tgtCenter.x - srcCenter.x, y: tgtCenter.y - srcCenter.y };
    const source = resolveHandlePoint(sourceNode, edge.sourceHandle, 'source', flow);
    const target = resolveHandlePoint(targetNode, edge.targetHandle, 'target', {
      x: -flow.x,
      y: -flow.y,
    });
    if (!source || !target) {
      missing.push(`${edge.id}: Anschluss nicht messbar`);
      continue;
    }
    const pushHandle = (nodeId: string, handleId: string, point: { x: number; y: number; position: Position }) => {
      const key = `${nodeId}\u0000${handleId}`;
      const cached = handleCache.get(key);
      if (cached) return cached;
      const handle: CoreHandle = { id: handleId, x: point.x, y: point.y, side: sideOf(point.position) };
      handleCache.set(key, handle);
      const nodeIndex = index.get(nodeId);
      if (nodeIndex !== undefined) {
        const node = coreNodes[nodeIndex] as CoreNode;
        coreNodes[nodeIndex] = { ...node, handles: [...node.handles, handle] };
      }
      return handle;
    };
    pushHandle(edge.source, edge.sourceHandle ?? '', source);
    pushHandle(edge.target, edge.targetHandle ?? '', target);
    coreEdges.push({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? '',
      target: edge.target,
      targetHandle: edge.targetHandle ?? '',
    });
  }

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, input: { nodes: coreNodes, edges: coreEdges } };
}
