import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { performAutoWiring, isStarterBatteryLabel } from './autoWire';
import type { CableEdgeData } from '../components/edges/CableEdge';
import { FUSE_MAP } from './electrical';

type TestNode = Partial<Node> & { id: string; type: string; data: Record<string, unknown>; position?: { x: number; y: number } };

function n(id: string, type: string, data: Record<string, unknown> = {}, position = { x: 0, y: 0 }): Node {
  return { id, type, position, data } as Node;
}

function e(over: Partial<Edge<CableEdgeData>> & { source: string; target: string }): Edge<CableEdgeData> {
  return { id: over.id || `e-${over.source}-${over.target}`, sourceHandle: 'plus', targetHandle: 'plus', ...over } as Edge<CableEdgeData>;
}

describe('autoWire — performAutoWiring', () => {
  it('returns null without a battery', () => {
    expect(performAutoWiring([n('c1', 'consumer', { watts: 50 })])).toBeNull();
  });

  it('erzeugt einen Sicherungskasten, Shunt und Busbars für eine Batterie + Verbraucher', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4' }),
      n('c1', 'consumer', { label: 'LED', watts: 20 }),
    ];
    const out = performAutoWiring(nodes);
    expect(out).not.toBeNull();
    const types = out!.nodes.map((x) => x.type);
    expect(types).toContain('fuse');
    expect(types).toContain('shunt');
    expect(types).toContain('busbar');
  });

  it('ist idempotent: zweiter Lauf erzeugt keine zusätzlichen Kanten/Nodes', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      n('c1', 'consumer', { label: 'Kühlbox', watts: 60 }),
      n('s1', 'solar', { label: 'Panel', watts: 200 }),
    ];
    const first = performAutoWiring(nodes)!;
    const second = performAutoWiring(first.nodes, first.edges)!;
    expect(second.nodes.length).toBe(first.nodes.length);
    const keys = (edges: Edge[]) => new Set(edges.map((x) => `${x.source}|${x.target}|${x.sourceHandle}|${x.targetHandle}`));
    expect(keys(second.edges)).toEqual(keys(first.edges));
  });

  it('erhält Nutzer-Kanten mit eigener ID', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4' }),
      n('c1', 'consumer', { label: 'LED', watts: 20 }),
    ];
    const user = e({ id: 'user-keep', source: 'b1', target: 'c1', data: { length: 2, crossSection: 2.5, edgeDomain: 'DC_12V' } });
    const out = performAutoWiring(nodes, [user])!;
    expect(out.edges.some((x) => x.id === 'user-keep')).toBe(true);
  });

  it('setzt keine Sicherung über dem Kabel-Maximalwert (FUSE_MAP)', () => {
    // Hoher Strom (100 A Wechselrichter) auf kurzer Strecke — Querschnitt und
    // Sicherung müssen hochdimensioniert werden, die Sicherung darf das Kabel
    // nie übersteigen.
    const nodes = [
      n('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      n('i1', 'inverter', { label: 'Inverter', watts: 1200 }),
    ];
    const out = performAutoWiring(nodes)!;
    for (const edge of out.edges) {
      if (!edge.sourceHandle?.includes('plus')) continue;
      const cs = edge.data?.crossSection;
      const fuse = edge.data?.fuseSize;
      if (cs && fuse !== undefined) {
        expect(fuse).toBeLessThanOrEqual(FUSE_MAP[cs] ?? Infinity);
      }
    }
  });

  it('kennzeichnet AC-Kanten zwischen Landstrom und 230V-Verbraucher als AC_230V', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4' }),
      n('sp1', 'shorePower', { label: 'Landstrom' }),
      n('a1', 'consumer230v', { label: 'Steckdose', watts: 300 }),
    ];
    const out = performAutoWiring(nodes)!;
    const acEdges = out.edges.filter((x) => x.data?.edgeDomain === 'AC_230V');
    expect(acEdges.length).toBeGreaterThan(0);
  });

  it('stempelt NICHT pauschal hasRcd=true auf Landstrom (VDE 0100-721)', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4' }),
      n('sp1', 'shorePower', { label: 'Landstrom', hasRcd: false }),
    ];
    const out = performAutoWiring(nodes)!;
    const sp = out.nodes.find((x) => x.type === 'shorePower');
    expect(sp?.data?.hasRcd).toBe(false);
  });

  it('erkennt Starterbatterien am Label', () => {
    expect(isStarterBatteryLabel('Starterbatterie')).toBe(true);
    expect(isStarterBatteryLabel('Starter Battery')).toBe(true);
    expect(isStarterBatteryLabel('Aufbaubatterie')).toBe(false);
  });

  it('verteilt Solarladung über einen MPPT-Laderegler', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      n('s1', 'solar', { label: 'Panel', watts: 300 }),
    ];
    const out = performAutoWiring(nodes)!;
    const types = out.nodes.map((x) => x.type);
    expect(types.some((t) => t === 'mpptController' || t === 'charger')).toBe(true);
  });
});
