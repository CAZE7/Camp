import { Node, Edge } from 'reactflow';

export function checkHasSeriesConnection(nodes: Node[], edges: Edge[]): boolean {
  return edges.some((e) => {
    const s = nodes.find((n) => n.id === e.source);
    const t = nodes.find((n) => n.id === e.target);
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
