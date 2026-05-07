import { usePlannerStore } from '../store/usePlannerStore';
import { Node } from 'reactflow';

const generateNodes = (count: number): Node[] => {
  const nodes: Node[] = [];
  nodes.push({
    id: 'battery-1',
    type: 'battery',
    position: { x: 0, y: 0 },
    data: { capacity: 100 }
  });

  for(let i=0; i<count; i++) {
    nodes.push({ id: `inv-${i}`, type: 'inverter', position: { x: 0, y: 0 }, data: { watts: 1000 } });
    nodes.push({ id: `sol-${i}`, type: 'solar', position: { x: 0, y: 0 }, data: { watts: 100 } });
    nodes.push({ id: `chr-${i}`, type: 'charger', position: { x: 0, y: 0 }, data: { amps: 30, label: 'Ladequelle' } });
    nodes.push({ id: `con-${i}`, type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 50 } });
  }

  return nodes;
};

async function run() {
  const store = usePlannerStore.getState();
  (global as any).window = { requestAnimationFrame: (cb: any) => cb() };

  const largeNodes = generateNodes(2000); // reduced to 2k for faster profiling
  store.setNodes(largeNodes);

  const origAutoWire = store.autoWireSystem;

  const start = performance.now();
  store.autoWireSystem();
  const end = performance.now();

  console.log(`Execution time for 8000 nodes: ${(end - start).toFixed(2)} ms`);
}

run().catch(console.error);
