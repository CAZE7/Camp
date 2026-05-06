const { performance } = require('perf_hooks');

const NUM_NODES = 500;
const NUM_EDGES = 500;
const nodes = [];
for (let i = 0; i < NUM_NODES; i++) {
  nodes.push({
    id: `node_${i}`,
    type: i % 2 === 0 ? 'consumer' : 'charger',
    data: {
      watts: 100,
      amps: 10
    }
  });
}

const edges = [];
for (let i = 0; i < NUM_EDGES; i++) {
  edges.push({
    source: `node_${Math.floor(Math.random() * NUM_NODES)}`,
    target: `node_${Math.floor(Math.random() * NUM_NODES)}`
  });
}

function unoptimized(source, target) {
  const sourceNode = nodes.find(n => n.id === source);
  const targetNode = nodes.find(n => n.id === target);
  return sourceNode && targetNode ? 1 : 0;
}

let nodeMap;
function optimized(source, target) {
  if (!nodeMap) nodeMap = new Map(nodes.map(n => [n.id, n]));
  const sourceNode = nodeMap.get(source);
  const targetNode = nodeMap.get(target);
  return sourceNode && targetNode ? 1 : 0;
}

const ITERATIONS = 100;

let start = performance.now();
for (let iter = 0; iter < ITERATIONS; iter++) {
  for (const edge of edges) {
    unoptimized(edge.source, edge.target);
  }
}
let end = performance.now();
console.log(`Unoptimized: ${end - start} ms`);

start = performance.now();
for (let iter = 0; iter < ITERATIONS; iter++) {
  // Assume nodes array changed, we recreate the map ONCE per render, not per edge.
  // Wait, if it's in a hook it's created per edge render unless we put it in a store?
  // Let's assume we create the map ONCE for all edges being rendered.
  nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const edge of edges) {
    optimized(edge.source, edge.target);
  }
}
end = performance.now();
console.log(`Optimized (map created per render): ${end - start} ms`);

start = performance.now();
for (let iter = 0; iter < ITERATIONS; iter++) {
  // Using getNode simulation (if available via ReactFlow)
  const getNode = (id) => nodes.find(n => n.id === id); // O(N) internally in ReactFlow?
  // Actually, React Flow's useReactFlow().getNode() is O(1) in recent versions.
}
