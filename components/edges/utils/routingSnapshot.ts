import { type Position } from '@xyflow/react';
import type { RoutingSnapshot } from '../../../lib/routing/model';
import {
  nodeHandleBounds,
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type RoutableNode,
} from './nodeGeometry';
import { NODE_FALLBACK_HEIGHT, NODE_FALLBACK_WIDTH } from './pathfinding';
import { collectRoutableNodes } from './routableNodes';
import type { RouteEdgeRef } from './routeAll';
import { compareIds } from '../../../lib/sortOrder';

export function routingSnapshot(nodes: RoutableNode[], edges: RouteEdgeRef[]): RoutingSnapshot {
  return {
    nodes: collectRoutableNodes(nodes)
      .routable.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: nodeOriginX(node), y: nodeOriginY(node) },
        width: nodeWidth(node, NODE_FALLBACK_WIDTH),
        height: nodeHeight(node, NODE_FALLBACK_HEIGHT),
        handles: structuredClone(nodeHandleBounds(node)),
      }))
      .sort((a, b) => compareIds(a.id, b.id)),
    edges: edges
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        data: edge.data
          ? {
              edgeDomain: edge.data.edgeDomain,
              crossSection: edge.data.crossSection,
              locked: edge.data.locked,
              intent: edge.data.intent,
              lockedWaypoints: structuredClone(edge.data.lockedWaypoints),
            }
          : edge.data,
      }))
      .sort((a, b) => compareIds(a.id, b.id)),
  };
}

/** Transitional adapter for the established local solver; no UI state crosses the worker boundary. */
export function routingSnapshotNodes(snapshot: RoutingSnapshot): RoutableNode[] {
  const handles = (values: NonNullable<RoutingSnapshot['nodes'][number]['handles']>['source']) =>
    values == null ? values : values.map((handle) => ({ ...handle, position: handle.position as Position }));
  return snapshot.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: {},
    position: { ...node.position },
    width: nodeWidth(node, NODE_FALLBACK_WIDTH),
    height: nodeHeight(node, NODE_FALLBACK_HEIGHT),
    handleBounds: node.handles
      ? { source: handles(node.handles.source), target: handles(node.handles.target) }
      : undefined,
  }));
}
