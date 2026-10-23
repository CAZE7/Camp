import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { applyCircuitTrace, circuitTraceLabel, traceCircuit } from './circuitTrace';

const nodes: Node[] = [
  { id: 'battery', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
  { id: 'shunt', type: 'shunt', position: { x: 0, y: 0 }, data: { label: 'Shunt' } },
  { id: 'fuse', type: 'fuse', position: { x: 0, y: 0 }, data: { label: 'Sicherung' } },
  { id: 'fridge', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'Kühlbox', watts: 60 } },
  { id: 'lamp', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'Lampe', watts: 12 } },
  { id: 'unrelated', type: 'solar', position: { x: 0, y: 0 }, data: { label: 'Insel' } },
];
// Plus-Seiten des DC-Kreises (Handle-Polarität bestimmt die Netz-Mitgliedschaft
// im Strommodell — AUDIT §13: Strom kommt aus dem EINEN topologischen Modell,
// das Kanten ohne bestimmbare Polarität als „nicht bestimmbar“ auswies).
const edges: Edge[] = [
  {
    id: 'e1',
    source: 'battery',
    target: 'shunt',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data: { crossSection: 10 },
  },
  {
    id: 'e2',
    source: 'shunt',
    target: 'fuse',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data: { crossSection: 6 },
  },
  {
    id: 'e3',
    source: 'fuse',
    target: 'fridge',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data: { crossSection: 2.5 },
  },
  {
    id: 'e4',
    source: 'fuse',
    target: 'lamp',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data: { crossSection: 1.5 },
  },
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
    // AUDIT ELE-009: Die Beschriftung leitete Spannung/Strom inline ab und
    // las dabei `data.voltage` (ein Feld, das Batterien nie tragen — sie
    // führen `nominalVoltage`) mit Fallback 12 V. Jetzt kommt die Spannung
    // aus derselben Autorität wie überall (getSystemVoltage → 12,8 V).
    expect(circuitTraceLabel(nodes, trace, edges)).toBe(
      'Batterie → Shunt → Sicherung → Kühlbox (12,8 V, 5 A, 2,5 mm²)'
    );
  });

  it('M1: wählt bei Knotenauswahl die unmittelbar speisende Zweigleitung statt des Batterie-Hauptstrangs', () => {
    const trace = traceCircuit(nodes, edges, { nodeId: 'fridge' })!;
    expect(trace.referenceEdge?.id).toBe('e3');
    expect(circuitTraceLabel(nodes, trace, edges)).toBe(
      'Batterie → Shunt → Sicherung → Kühlbox (12,8 V, 5 A, 2,5 mm²)'
    );

    const lampTrace = traceCircuit(nodes, edges, { nodeId: 'lamp' })!;
    expect(lampTrace.referenceEdge?.id).toBe('e4');
    expect(circuitTraceLabel(nodes, lampTrace, edges)).toContain('1,5 mm²');
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
    expect(circuitTraceLabel(acNodes, trace)).toContain('(230 V, 10 A, 1,5 mm²)');
    expect(traceCircuit(nodes, edges, { nodeId: 'missing' })).toBeNull();
  });

  it('M1: trennt Plus-Pfad von Minus-Schiene, endet bei Solar an der Aufbaubatterie und nennt echte Domänenspannung', () => {
    const planNodes: Node[] = [
      {
        id: 'solar',
        type: 'solar',
        position: { x: 0, y: 0 },
        data: { label: '200W Solar', voltage: 18, watts: 200 },
      },
      { id: 'mppt', type: 'mpptController', position: { x: 0, y: 0 }, data: { label: 'MPPT', amps: 20 } },
      {
        id: 'bat',
        type: 'battery',
        position: { x: 0, y: 0 },
        data: { label: '100Ah Lithium', chemistry: 'LiFePO4' },
      },
      { id: 'busbar-plus', type: 'busbar', position: { x: 0, y: 0 }, data: { label: 'Plus Busbar' } },
      { id: 'busbar-minus', type: 'busbar', position: { x: 0, y: 0 }, data: { label: 'Minus Busbar' } },
      {
        id: 'inv',
        type: 'inverter',
        position: { x: 0, y: 0 },
        data: { label: '500W Inverter', continuousPower: 500 },
      },
      {
        id: 'ac230',
        type: 'consumer230v',
        position: { x: 0, y: 0 },
        data: { label: '230V Steckdose', watts: 230 },
      },
    ];
    const planEdges: Edge[] = [
      {
        id: 'e-solar-mppt',
        source: 'solar',
        sourceHandle: 'plus',
        target: 'mppt',
        targetHandle: 'plus',
        data: { crossSection: 6, edgeDomain: 'Solar' },
      },
      {
        id: 'e-mppt-bus',
        source: 'mppt',
        sourceHandle: 'plus',
        target: 'busbar-plus',
        targetHandle: 'plus',
        data: { crossSection: 10 },
      },
      {
        id: 'e-bat-plus',
        source: 'bat',
        sourceHandle: 'plus',
        target: 'busbar-plus',
        targetHandle: 'plus',
        data: { crossSection: 50 },
      },
      // Alphabetisch vor e-busbar-inv-plus: darf den Plus-Pfad zum WR nicht auf Minus umlenken!
      {
        id: 'e-busbar-inv-minus',
        source: 'busbar-minus',
        sourceHandle: 'minus',
        target: 'inv',
        targetHandle: 'minus',
        data: { crossSection: 25 },
      },
      {
        id: 'e-busbar-inv-plus',
        source: 'busbar-plus',
        sourceHandle: 'plus',
        target: 'inv',
        targetHandle: 'plus',
        data: { crossSection: 25 },
      },
      {
        id: 'e-inv-ac',
        source: 'inv',
        sourceHandle: 'plus',
        target: 'ac230',
        targetHandle: 'plus',
        data: { crossSection: 2.5 },
      },
    ];

    const solarTrace = traceCircuit(planNodes, planEdges, { nodeId: 'solar' })!;
    expect(solarTrace.pathNodeIds).toEqual(['solar', 'mppt', 'busbar-plus', 'bat']);
    expect(circuitTraceLabel(planNodes, solarTrace, planEdges)).toContain('(18 V,');

    const acTrace = traceCircuit(planNodes, planEdges, { nodeId: 'ac230' })!;
    expect(acTrace.pathNodeIds).toEqual(['bat', 'busbar-plus', 'inv', 'ac230']);
    expect(circuitTraceLabel(planNodes, acTrace, planEdges)).toContain('(230 V, 1 A, 2,5 mm²)');
  });
});

/**
 * Statische Identitäts-Regression (2026-09-26, „object recreation“):
 * `applyCircuitTrace` soll unveränderte Elemente nicht kopieren. Dieser Test
 * belegt die Objektidentität bei Presentation-Updates, nicht die Ursache der
 * gemeldeten Browser-Oszillation.
 */
describe('applyCircuitTrace — identitätsstabil', () => {
  it('markiert alle Elemente, lässt aber die Objekte unangetastet, die schon passen', () => {
    const trace = traceCircuit(nodes, edges, { nodeId: 'fridge' })!;
    const first = applyCircuitTrace(nodes, edges, trace);
    expect(first.nodes).not.toBe(nodes);

    // Zweiter Durchlauf: alles ist bereits markiert ⇒ dieselben Objekte.
    const second = applyCircuitTrace(first.nodes, first.edges, trace);
    expect(second.nodes.every((node, index) => node === first.nodes[index])).toBe(true);
    expect(second.edges.every((edge, index) => edge === first.edges[index])).toBe(true);
  });

  it('ohne Strompfad kommen dieselben Arrays zurück', () => {
    const result = applyCircuitTrace(nodes, edges, null);
    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
  });
});
