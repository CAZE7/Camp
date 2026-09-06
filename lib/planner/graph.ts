import type { PlannerNode } from './domain';

export type NodeLookup = Map<string, PlannerNode>;

export function buildNodeLookup(nodes: PlannerNode[]): NodeLookup {
  const lookup = new Map<string, PlannerNode>();
  for (const node of nodes) {
    lookup.set(node.id, node);
  }
  return lookup;
}
