import { performance } from 'perf_hooks';

// Mock types
type Node = { id: string; type: string };
type Edge = { source: string; target: string; sourceHandle?: string; targetHandle?: string };

function checkHasSeriesConnectionOriginal(nodes: Node[], edges: Edge[]): boolean {
  return edges.some((e) => {
    const s = nodes.find((n) => n.id === e.source);
    const t = nodes.find((n) => n.id === e.target);
    return (
      s?.type === 'solar' &&
      t?.type === 'solar' &&
      ((e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
        (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus')))
    );
  });
}

function checkHasSeriesConnectionOptimized(nodes: Node[], edges: Edge[]): boolean {
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  return edges.some((e) => {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    return (
      s?.type === 'solar' &&
      t?.type === 'solar' &&
      ((e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
        (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus')))
    );
  });
}

const numNodes = 10000;
const numEdges = 10000;

const nodes: Node[] = [];
for (let i = 0; i < numNodes; i++) {
  nodes.push({ id: `node_${i}`, type: 'solar' });
}

const edges: Edge[] = [];
for (let i = 0; i < numEdges; i++) {
  // Add some random edges, but avoid series connection to force full iteration
  edges.push({
    source: `node_${i}`,
    target: `node_${(i + 1) % numNodes}`,
    sourceHandle: 'plus',
    targetHandle: 'plus', // Prevents returning true
  });
}

console.log(`Running benchmark with ${numNodes} nodes and ${numEdges} edges...`);

const startOriginal = performance.now();
const resOriginal = checkHasSeriesConnectionOriginal(nodes, edges);
const endOriginal = performance.now();

const startOptimized = performance.now();
const resOptimized = checkHasSeriesConnectionOptimized(nodes, edges);
const endOptimized = performance.now();

console.log(`Original implementation: ${endOriginal - startOriginal} ms (result: ${resOriginal})`);
console.log(`Optimized implementation: ${endOptimized - startOptimized} ms (result: ${resOptimized})`);
