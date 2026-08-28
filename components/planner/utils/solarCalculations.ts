import { type Node, type Edge } from 'reactflow';

export function checkHasSeriesConnection(nodes: Node[], edges: Edge[]): boolean {
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  for (const e of edges) {
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
