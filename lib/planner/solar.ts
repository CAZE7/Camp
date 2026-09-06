import type { PlannerEdge, PlannerNode } from './domain';
import { buildNodeLookup } from './graph';
import { getHandlePolarity } from './handles';

export function checkHasSeriesConnection(
  nodes: PlannerNode[],
  edges: PlannerEdge[]
): boolean {
  const nodeMap = buildNodeLookup(nodes);

  return edges.some((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const sourcePolarity = getHandlePolarity(edge.sourceHandle);
    const targetPolarity = getHandlePolarity(edge.targetHandle);

    return (
      source?.type === 'solar' &&
      target?.type === 'solar' &&
      sourcePolarity !== null &&
      targetPolarity !== null &&
      sourcePolarity !== targetPolarity
    );
  });
}
