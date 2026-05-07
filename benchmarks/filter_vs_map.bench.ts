import { Node } from 'reactflow';

const generateNodes = (count: number): Node[] => {
  const nodes: Node[] = [];
  for(let i=0; i<count; i++) {
    nodes.push({ id: `inv-${i}`, type: 'inverter', position: { x: 0, y: 0 }, data: { watts: 1000 } });
    nodes.push({ id: `sol-${i}`, type: 'solar', position: { x: 0, y: 0 }, data: { watts: 100 } });
    nodes.push({ id: `chr-${i}`, type: 'charger', position: { x: 0, y: 0 }, data: { amps: 30, label: 'Ladequelle' } });
    nodes.push({ id: `con-${i}`, type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 50 } });
    nodes.push({ id: `bat-${i}`, type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } });
  }
  return nodes;
};

const currentNodes = generateNodes(20000); // 100,000 nodes

const start1 = performance.now();
for (let i = 0; i < 100; i++) {
    const inverters = currentNodes.filter((n) => n.type === 'inverter');
    const solars = currentNodes.filter((n) => n.type === 'solar' || n.type === 'roofsolar');
    const boosters = currentNodes.filter((n) => n.type === 'charger' && (n.data.label as string)?.toLowerCase().includes('ladequelle'));
    const plainChargers = currentNodes.filter((n) => n.type === 'charger' && !(n.data.label as string)?.toLowerCase().includes('mppt') && !(n.data.label as string)?.toLowerCase().includes('ladequelle'));
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

    const chargers = nodesByType.get('charger') || [];
    const boosters: Node[] = [];
    const plainChargers: Node[] = [];
    for (const c of chargers) {
        const lbl = (c.data?.label as string)?.toLowerCase() || '';
        if (lbl.includes('ladequelle')) {
            boosters.push(c);
        } else if (!lbl.includes('mppt')) {
            plainChargers.push(c);
        }
    }
    const consumers = nodesByType.get('consumer') || [];
}
const end2 = performance.now();
console.log(`Map grouping: ${(end2 - start2).toFixed(2)} ms`);
