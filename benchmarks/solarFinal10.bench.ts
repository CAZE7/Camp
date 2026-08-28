import { performance } from 'perf_hooks';

type Node = { id: string; type: string };
type Edge = { source: string; target: string; sourceHandle?: string; targetHandle?: string };

function checkHasSeriesConnectionSet(nodes: Node[], edges: Edge[]): boolean {
  let solarNodeIds: Set<string> | null = null;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!; // Benchmark: Indexform ist Messgegenstand
    const hasCorrectHandles =
      (e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
      (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus'));

    if (hasCorrectHandles) {
      if (solarNodeIds === null) {
        solarNodeIds = new Set<string>();
        for (let j = 0; j < nodes.length; j++) {
          const n = nodes[j]!; // Benchmark: Indexform ist Messgegenstand
          if (n.type === 'solar') {
            solarNodeIds.add(n.id);
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

// 0 Allocation Direct Search
function checkHasSeriesConnectionArrayFind(nodes: Node[], edges: Edge[]): boolean {
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!; // Benchmark: Indexform ist Messgegenstand

    const hasCorrectHandles =
      (e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
      (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus'));

    if (hasCorrectHandles) {
      // Find source and target nodes using array methods as suggested
      const s = nodes.find((n) => n.id === e.source);
      if (s && s.type === 'solar') {
        const t = nodes.find((n) => n.id === e.target);
        if (t && t.type === 'solar') {
          return true;
        }
      }
    }
  }

  return false;
}

const numNodes = 1000;
const numEdges = 1000;

function runTestReal(fn: (n: Node[], e: Edge[]) => boolean) {
  let start = performance.now();

  for (let i = 0; i < 1000; i++) {
    const nodes: Node[] = [];
    for (let j = 0; j < numNodes; j++) {
      nodes.push({ id: `node_${j}_${i}`, type: 'solar' });
    }

    const edges: Edge[] = [];
    for (let j = 0; j < numEdges; j++) {
      edges.push({
        source: `node_${j}_${i}`,
        target: `node_${(j + 1) % numNodes}_${i}`,
        sourceHandle: 'plus',
        targetHandle: 'plus',
      });
    }

    // add many failing candidate edges
    for (let j = 0; j < 100; j++) {
      edges.push({
        source: `node_${j}_${i}`,
        target: `node_${j % 2 === 0 ? j + 1 : j + 2}_${i}`, // target is not solar
        sourceHandle: 'plus',
        targetHandle: 'minus',
      });
    }

    fn(nodes, edges);
  }
  return performance.now() - start;
}

console.log(`Original Logic: ${runTestReal(checkHasSeriesConnectionSet)} ms`);
console.log(`Direct Find (no map): ${runTestReal(checkHasSeriesConnectionArrayFind)} ms`);
