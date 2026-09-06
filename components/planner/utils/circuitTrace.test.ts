import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { applyCircuitTrace, circuitTraceLabel, traceCircuit } from './circuitTrace';

const nodes: Node[] = [
  { id: 'battery', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
  { id: 'shunt', type: 'shunt', position: { x: 0, y: 0 }, data: { label: 'Shunt' } },
  { id: 'fuse', type: 'fuse', position: { x: 0, y: 0 }, data: { label: 'Sicherung' } },
  { id: 'fridge', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'Kühlbox', watts: 60 } },
  { id: 'lamp', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'Lampe', watts: 12 } },
  { id: 'unrelated', type: 'solar', position: { x: 0, y: 0 }, data: { label: 'Insel' } },
];
const edges: Edge[] = [
  { id: 'e1', source: 'battery', target: 'shunt', data: { crossSection: 10 } },
  { id: 'e2', source: 'shunt', target: 'fuse', data: { crossSection: 6 } },
  { id: 'e3', source: 'fuse', target: 'fridge', data: { crossSection: 2.5 } },
  { id: 'e4', source: 'fuse', target: 'lamp', data: { crossSection: 1.5 } },
];

describe('circuit tracing', () => {
  it('traces the complete source-to-consumer branch through a selected edge', () => {
    const trace = traceCircuit(nodes, edges, { edgeId: 'e3' })!;
    expect(Array.from(trace.nodeIds).sort()).toEqual(['battery', 'fridge', 'fuse', 'shunt']);
    expect(Array.from(trace.edgeIds).sort()).toEqual(['e1', 'e2', 'e3']);
    expect(trace.pathNodeIds).toEqual(['battery', 'shunt', 'fuse', 'fridge']);
  });

  it('includes all downstream branches when a distributor is selected', () => {
    const trace = traceCircuit(nodes, edges, { nodeId: 'fuse' })!;
    expect(trace.nodeIds).toEqual(new Set(['fuse', 'shunt', 'battery', 'fridge', 'lamp']));
    expect(trace.edgeIds).toEqual(new Set(['e2', 'e1', 'e3', 'e4']));
  });

  it('dims unrelated elements to 0.2 via presentation classes', () => {
    const trace = traceCircuit(nodes, edges, { edgeId: 'e3' })!;
    const displayed = applyCircuitTrace(nodes, edges, trace);
    expect(displayed.nodes.find((node) => node.id === 'battery')?.className).toContain(
      'planner-trace-active'
    );
    expect(displayed.nodes.find((node) => node.id === 'unrelated')?.className).toContain('planner-trace-dim');
    expect(displayed.edges.find((edge) => edge.id === 'e4')?.className).toContain('planner-trace-dim');
  });

  it('builds a readable path overlay with electrical values', () => {
    const trace = traceCircuit(nodes, edges, { edgeId: 'e3' })!;
    expect(circuitTraceLabel(nodes, trace)).toBe(
      'Batterie → Shunt → Sicherung → Kühlbox (12 V, 5 A, 2.5 mm²)'
    );
  });

  it('supports AC topology and rejects missing seeds', () => {
    const acNodes: Node[] = [
      { id: 'shore', type: 'shorePower', position: { x: 0, y: 0 }, data: { label: 'Landstrom' } },
      {
        id: 'socket',
        type: 'consumer230v',
        position: { x: 0, y: 0 },
        data: { label: 'Steckdose', watts: 2300 },
      },
    ];
    const acEdges: Edge[] = [
      { id: 'ac', source: 'shore', target: 'socket', data: { edgeDomain: 'AC_230V', crossSection: 1.5 } },
    ];
    const trace = traceCircuit(acNodes, acEdges, { edgeId: 'ac' })!;
    expect(circuitTraceLabel(acNodes, trace)).toContain('(230 V, 10 A, 1.5 mm²)');
    expect(traceCircuit(nodes, edges, { nodeId: 'missing' })).toBeNull();
  });
});
