const { performance } = require('perf_hooks');

const numNodes = 10000;
const numDevices = 500;

const nodes = Array.from({ length: numNodes }, (_, i) => ({
  id: `node-${i}`,
  type: i % 10 === 0 ? 'consumer230v' : 'other',
  data: { watts: 100 },
}));

const concurrentDevices = Array.from({ length: numDevices }, (_, i) => `node-${i * 20}`);

// Baseline
const startBaseline = performance.now();
for (let j = 0; j < 1000; j++) {
  let totalWatts = 0;
  nodes.forEach((n) => {
    if (n.type === 'consumer230v' && concurrentDevices.includes(n.id)) {
      totalWatts += n.data?.watts || 0;
    }
  });
}
const endBaseline = performance.now();

// Optimized
const startOptimized = performance.now();
for (let j = 0; j < 1000; j++) {
  const deviceSet = new Set(concurrentDevices);
  let totalWatts = 0;
  // Use a standard for loop to avoid forEach overhead, but even with forEach it's faster
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'consumer230v' && deviceSet.has(n.id)) {
      totalWatts += n.data?.watts || 0;
    }
  }
}
const endOptimized = performance.now();

console.log(`Baseline: ${endBaseline - startBaseline} ms`);
console.log(`Optimized: ${endOptimized - startOptimized} ms`);
