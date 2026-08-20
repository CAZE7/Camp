export type FocusableNode = { id: string; className?: string };
export type FocusableEdge = { id: string; source: string; target: string; className?: string };

const ACTIVE = 'planner-focus-active';
const DIM = 'planner-focus-dim';

const withFlag = (className: string | undefined, flag: string): string =>
  [className, flag].filter(Boolean).join(' ');

/**
 * When a single node is selected, keep it and its neighbours readable and dim the rest.
 * Pure presentation — does not mutate store records in place.
 */
export function applyNeighborhoodFocus<N extends FocusableNode, E extends FocusableEdge>(
  nodes: N[],
  edges: E[],
  focusedNodeId: string | null | undefined
): { nodes: N[]; edges: E[] } {
  if (!focusedNodeId) return { nodes, edges };

  const keep = new Set<string>([focusedNodeId]);
  for (const edge of edges) {
    if (edge.source === focusedNodeId || edge.target === focusedNodeId) {
      keep.add(edge.source);
      keep.add(edge.target);
    }
  }

  return {
    nodes: nodes.map((node) => ({
      ...node,
      className: withFlag(node.className, keep.has(node.id) ? ACTIVE : DIM),
    })),
    edges: edges.map((edge) => ({
      ...edge,
      className: withFlag(
        edge.className,
        edge.source === focusedNodeId || edge.target === focusedNodeId ? ACTIVE : DIM
      ),
    })),
  };
}
