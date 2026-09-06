/**
 * lib/planner/graph/topology.ts
 *
 * Stable graph operations used by the deterministic LaneRegistry and routing
 * orchestrator. All ordering is derived from node ids, never from insertion order.
 */

import type { PlannerNode, PlannerEdge } from '../domainModel';

export type TopologyResult = {
  /** Stable rank per node id. Lower rank => earlier in the canonical order. */
  rankById: ReadonlyMap<string, number>;
  /** Nodes in canonical topological order (cycles fall back to id order). */
  order: readonly string[];
};

function canonicalNodeId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Returns a stable topological order using Kahn's algorithm. When the graph
 * contains a cycle (which should not happen for a valid schematic), the cycle is
 * broken deterministically by node id.
 */
export function topologicalRank(
  nodes: readonly PlannerNode[],
  edges: readonly PlannerEdge[],
): TopologyResult {
  const nodeIds = nodes.map((node) => node.id).sort(canonicalNodeId);

  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    indegree.set(nodeId, 0);
    adjacency.set(nodeId, []);
  }

  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  for (const targets of Array.from(adjacency.values())) {
    targets.sort(canonicalNodeId);
  }

  const ready = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (ready.length > 0) {
    ready.sort(canonicalNodeId);
    const nodeId = ready.shift() as string;
    order.push(nodeId);

    const targets = adjacency.get(nodeId) ?? [];
    for (const target of targets) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        ready.push(target);
      }
    }
  }

  if (order.length === nodeIds.length) {
    return { rankById: buildRanks(order), order };
  }

  // Deterministic cycle fallback: append remaining ids in lexicographic order.
  const visited = new Set(order);
  const remaining = nodeIds.filter((id) => !visited.has(id));
  const withFallback = [...order, ...remaining];
  return { rankById: buildRanks(withFallback), order: withFallback };
}

function buildRanks(order: readonly string[]): ReadonlyMap<string, number> {
  const rankById = new Map<string, number>();
  order.forEach((id, index) => rankById.set(id, index));
  return rankById;
}
