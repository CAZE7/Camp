import { performance } from 'perf_hooks';

const logger = {
  info: (...args: any[]) => process.stdout.write(args.join(' ') + '\n'),
  error: (...args: any[]) => process.stderr.write(args.join(' ') + '\n'),
};

const nodeCount = 100;
const edgeCount = 200;
const iterations = 1000;

const nodes = Array.from({ length: nodeCount }, (_, i) => ({
  id: `node-${i}`,
  type: 'consumer',
  position: { x: Math.random(), y: Math.random() },
  data: { watts: 50, hours: 2 },
}));

const edges = Array.from({ length: edgeCount }, (_, i) => ({
  id: `edge-${i}`,
  source: `node-${Math.floor(Math.random() * nodeCount)}`,
  target: `node-${Math.floor(Math.random() * nodeCount)}`,
  sourceHandle: 'plus',
  targetHandle: 'plus',
  data: { length: 3, crossSection: 2.5 },
}));

function original() {
  const serializedNodes = JSON.stringify(
    nodes.map((n) => ({ id: n.id, type: n.type, data: n.data }))
  );
  const serializedEdges = JSON.stringify(
    edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
  );
  return { serializedNodes, serializedEdges };
}

// A simple deep equality check for the specific structure
function isNodesEqual(a: any[], b: any[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].type !== b[i].type) return false;
    // Data check - assuming data is a flat object or we do a simple check
    if (JSON.stringify(a[i].data) !== JSON.stringify(b[i].data)) return false;
  }
  return true;
}

// But wait, the point is to avoid JSON.stringify altogether.

logger.info(`Running benchmark with ${nodeCount} nodes and ${edgeCount} edges, ${iterations} iterations...`);

const start = performance.now();
for (let i = 0; i < iterations; i++) {
  original();
}
const end = performance.now();
logger.info(`Original (JSON.stringify): ${(end - start).toFixed(2)}ms total, ${((end - start) / iterations).toFixed(4)}ms per call`);
