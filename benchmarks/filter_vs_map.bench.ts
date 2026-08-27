import { Node } from 'reactflow';

const generateNodes = (count: number): Node[] => {
  const nodes: Node[] = [];
  for(let i=0; i<count; i++) {
    nodes.push({ id: `inv-${i}`, type: 'inverter', position: { x: 0, y: 0 }, data: { watts: 1000 } });
    nodes.push({ id: `sol-${i}`, type: 'solar', position: { x: 0, y: 0 }, data: { watts: 100 } });
    nodes.push({ id: `mppt-${i}`, type: 'mpptController', position: { x: 0, y: 0 }, data: { amps: 30 } });
    nodes.push({ id: `dcdc-${i}`, type: 'dcdcCharger', position: { x: 0, y: 0 }, data: { amps: 30 } });
    nodes.push({ id: `con-${i}`, type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 50 } });
    nodes.push({ id: `bat-${i}`, type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } });
  }
  return nodes;
};

const currentNodes = generateNodes(20000); // 120,000 nodes

const start1 = performance.now();
for (let i = 0; i < 100; i++) {
    const inverters = currentNodes.filter((n) => n.type === 'inverter');
    const solars = currentNodes.filter((n) => n.type === 'solar' || n.type === 'roofsolar');
    const mppts = currentNodes.filter((n) => n.type === 'mpptController');
    const dcdcs = currentNodes.filter((n) => n.type === 'dcdcCharger');
    const consumers = currentNodes.filter((n) => n.type === 'consumer');
}
const end1 = performance.now();
console.log(`Multiple filters: ${(end1 - start1).toFixed(2)} ms`);

const start2 = performance.now();
for (let i = 0; i < 100; i++) {
    const nodesByType = new Map<string, Node[]>();
    for (const node of currentNodes) {
        const arr = nodesByType.get(node.type!);
        if (arr) arr.push(node);
        else nodesByType.set(node.type!, [node]);
    }
    const inverters = nodesByType.get('inverter') || [];
    const solars = [...(nodesByType.get('solar') || []), ...(nodesByType.get('roofsolar') || [])];
    const mppts = nodesByType.get('mpptController') || [];
    const dcdcs = nodesByType.get('dcdcCharger') || [];
    const consumers = nodesByType.get('consumer') || [];
}
const end2 = performance.now();
console.log(`Map grouping: ${(end2 - start2).toFixed(2)} ms`);
