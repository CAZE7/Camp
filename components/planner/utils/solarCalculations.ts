import { Node, Edge } from 'reactflow';

export function checkHasSeriesConnection(nodes: Node[], edges: Edge[]): boolean {
  let solarNodeIds: Set<string> | null = null;

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];

    const hasCorrectHandles =
      (e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
      (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus'));

    if (hasCorrectHandles) {
      if (solarNodeIds === null) {
        solarNodeIds = new Set<string>();
        for (let j = 0; j < nodes.length; j++) {
          if (nodes[j].type === 'solar') {
            solarNodeIds.add(nodes[j].id);
          }
        }
      }

      if (solarNodeIds.has(e.source) && solarNodeIds.has(e.target)) {
        return true;
      }
    }
  }

  return false;
}
