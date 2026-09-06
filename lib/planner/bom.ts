import type { BomData, CableEdgeData, PlannerEdge, PlannerNode } from './domain';

export function calculateBom(
  nodes: PlannerNode[],
  edges: Array<PlannerEdge<CableEdgeData>>
): BomData {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    if (!node.type) continue;
    counts[node.type] = (counts[node.type] || 0) + 1;
  }

  const cableLengths: Record<string, number> = {};
  for (const edge of edges) {
    const crossSection = edge.data?.crossSection ?? 2.5;
    cableLengths[crossSection] = (cableLengths[crossSection] || 0) + (edge.data?.length ?? 3);
  }

  return { counts, cableLengths };
}
