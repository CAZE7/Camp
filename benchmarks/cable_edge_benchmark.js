const { performance } = require('perf_hooks');

const NUM_NODES = 5000;
const NUM_EDGES = 1000;
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
    target: `node_${Math.floor(Math.random() * NUM_NODES)}`,
    data: { length: 3 }
  });
}

// Unoptimized simulation
function unoptimized() {
  for (const edge of edges) {
    const source = edge.source;
    const target = edge.target;
    const length = edge.data?.length || 3;
    let I = 0;
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);

    if (sourceNode?.type === 'consumer') {
      I = (sourceNode.data.watts || 0) / 12;
    } else if (targetNode?.type === 'consumer') {
      I = (targetNode.data.watts || 0) / 12;
    } else if (sourceNode?.type === 'charger') {
      I = sourceNode.data.amps || 0;
    } else if (targetNode?.type === 'charger') {
      I = targetNode.data.amps || 0;
    } else {
      const allConsumers = nodes.filter(n => n.type === 'consumer');
      I = allConsumers.reduce((acc, n) => acc + ((n.data.watts || 0) / 12), 0);
    }
  }
}

// Optimized simulation
let lastNodesRef = null;
let cachedNodeMap = new Map();
let cachedConsumers = [];

function getCachedData(currentNodes) {
  if (currentNodes !== lastNodesRef) {
    cachedNodeMap.clear();
    cachedConsumers = [];
    for (let i = 0; i < currentNodes.length; i++) {
      const n = currentNodes[i];
      cachedNodeMap.set(n.id, n);
      if (n.type === 'consumer') {
        cachedConsumers.push(n);
      }
    }
    lastNodesRef = currentNodes;
  }
  return { nodeMap: cachedNodeMap, consumers: cachedConsumers };
}

function optimized() {
  // Simulate getNodes()
  const currentNodes = nodes;

  for (const edge of edges) {
    const { nodeMap, consumers } = getCachedData(currentNodes);
    const source = edge.source;
    const target = edge.target;
    const length = edge.data?.length || 3;
    let I = 0;
    const sourceNode = nodeMap.get(source);
    const targetNode = nodeMap.get(target);

    if (sourceNode?.type === 'consumer') {
      I = (sourceNode.data.watts || 0) / 12;
    } else if (targetNode?.type === 'consumer') {
      I = (targetNode.data.watts || 0) / 12;
    } else if (sourceNode?.type === 'charger') {
      I = sourceNode.data.amps || 0;
    } else if (targetNode?.type === 'charger') {
      I = targetNode.data.amps || 0;
    } else {
      I = consumers.reduce((acc, n) => acc + ((n.data.watts || 0) / 12), 0);
    }
  }
}

const ITERATIONS = 10;

let start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  unoptimized();
}
let end = performance.now();
console.log(`Unoptimized: ${(end - start).toFixed(2)} ms`);

start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  optimized();
}
end = performance.now();
console.log(`Optimized: ${(end - start).toFixed(2)} ms`);
