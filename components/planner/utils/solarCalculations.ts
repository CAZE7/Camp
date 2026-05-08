import { Node, Edge } from 'reactflow';

export function checkHasSeriesConnection(nodes: Node[], edges: Edge[]): boolean {
  const nodeMap = new Map<string, Node>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    nodeMap.set(n.id, n);
  }

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];

    const hasCorrectHandles =
      (e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
      (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus'));

    if (hasCorrectHandles) {
      const s = nodeMap.get(e.source);
      if (s?.type === 'solar') {
        const t = nodeMap.get(e.target);
        if (t?.type === 'solar') {
          return true;
        }
      }
    }
  }

  return false;
}
