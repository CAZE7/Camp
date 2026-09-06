import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow';
import type {
  Connection,
  EdgeChange,
  NodeChange,
  OnSelectionChangeParams,
} from 'reactflow';
import type { PlannerConnection, PlannerEdge, PlannerNode } from './domain';

export type FlowNodeChange = NodeChange;
export type FlowEdgeChange = EdgeChange;
export type FlowSelectionChangeParams = OnSelectionChangeParams;

export function applyPlannerNodeChanges<N extends PlannerNode>(
  changes: FlowNodeChange[],
  nodes: N[]
): N[] {
  return applyNodeChanges(changes, nodes as any) as N[];
}

export function applyPlannerEdgeChanges<E extends PlannerEdge>(
  changes: FlowEdgeChange[],
  edges: E[]
): E[] {
  return applyEdgeChanges(changes, edges as any) as E[];
}

export function addPlannerEdge<E extends PlannerEdge>(edge: E, edges: E[]): E[] {
  return addEdge(edge as any, edges as any) as E[];
}

export function toPlannerConnection(connection: Connection): PlannerConnection {
  return connection;
}
