import { Node, Edge } from 'reactflow';

export function checkHasSeriesConnection(nodes: Node[], edges: Edge[]): boolean {
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];

    const hasCorrectHandles =
      (e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
      (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus'));

    if (hasCorrectHandles) {
      const s = nodes.find((n) => n.id === e.source);
      if (s?.type === 'solar') {
        const t = nodes.find((n) => n.id === e.target);
        if (t?.type === 'solar') {
          return true;
        }
      }
    }
  }

  return false;
}
