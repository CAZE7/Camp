/**
 * lib/planner/graph/nodeLookup.ts
 *
 * Typed node lookup used by routing and validation. No `any`.
 */

import type { PlannerNode, PlannerNodeData } from '../domainModel';

export type NodeLookup = ReadonlyMap<string, PlannerNode>;

export function buildNodeLookup(nodes: readonly PlannerNode<PlannerNodeData>[]): NodeLookup {
  const lookup = new Map<string, PlannerNode>();
  for (const node of nodes) {
    lookup.set(node.id, node);
  }
  return lookup;
}
