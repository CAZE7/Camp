import { Node, Edge } from 'reactflow';

export function checkHasSeriesConnection(nodes: Node[], edges: Edge[]): boolean {
  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  return edges.some((e) => {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    return (
      s?.type === 'solar' &&
      t?.type === 'solar' &&
      ((e.sourceHandle?.includes('plus') &&
        e.targetHandle?.includes('minus')) ||
        (e.sourceHandle?.includes('minus') &&
          e.targetHandle?.includes('plus')))
    );
  });
}
