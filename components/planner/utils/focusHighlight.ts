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
  return applyFocusHighlight(nodes, edges, focusedNodeId ? [focusedNodeId] : null);
}

/**
 * Generalisierte Fokus-Hervorhebung für einen oder mehrere Seed-Nodes
 * (Selektion oder Hover). Alle Kanten, die einen Seed-Node berühren, bleiben
 * aktiv; alles andere wird gedimmt. Pure Darstellung ohne Store-Mutation.
 */
export function applyFocusHighlight<N extends FocusableNode, E extends FocusableEdge>(
  nodes: N[],
  edges: E[],
  seedNodeIds: string[] | null | undefined
): { nodes: N[]; edges: E[] } {
  if (!seedNodeIds || seedNodeIds.length === 0) return { nodes, edges };

  const seeds = new Set<string>(seedNodeIds);
  const keep = new Set<string>(seeds);
  for (const edge of edges) {
    if (seeds.has(edge.source) || seeds.has(edge.target)) {
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
        seeds.has(edge.source) || seeds.has(edge.target) ? ACTIVE : DIM
      ),
    })),
  };
}
