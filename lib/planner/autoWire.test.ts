import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  AUTO_WIRE_MISSING_BATTERY_MESSAGE,
  AUTO_WIRE_MULTIPLE_BATTERIES_MESSAGE,
  AUTO_WIRE_MANAGED_TYPES,
  planAutoWiring,
} from './autoWire';
import type { CablePlannerEdge, PlannerNode } from './domain';

describe('planAutoWiring', () => {
  it('returns a domain error instead of touching UI APIs when no battery exists', () => {
    const result = planAutoWiring([
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(AUTO_WIRE_MISSING_BATTERY_MESSAGE);
    }
    expect(result.edges).toEqual([]);
  });

  it('fails closed for multiple batteries instead of silently leaving one unconnected', () => {
    const battery = (id: string) => ({ id, type: 'battery', position: { x: 0, y: 0 }, data: {} });
    const result = planAutoWiring([battery('b1'), battery('b2')]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(AUTO_WIRE_MULTIPLE_BATTERIES_MESSAGE);
    expect(result.edges).toEqual([]);
  });

  it('uses a safe origin for malformed imported battery positions', () => {
    const result = planAutoWiring([
      { id: 'b1', type: 'battery', position: undefined as never, data: {} },
    ], { idFactory: () => 'generated' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nodes.find((node) => node.type === 'busbar')?.position).toEqual({ x: 300, y: 0 });
  });

  it('plans busbar, shunt, fuse box and paired plus/minus edges from domain nodes only', () => {
    let idCounter = 0;
    const nodes: PlannerNode[] = [
      { id: 'b1', type: 'battery', position: { x: 10, y: 20 }, data: { capacity: 100 } },
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
    ];

    const result = planAutoWiring(nodes, { idFactory: () => `generated-${idCounter++}` });

    expect(result.ok).toBe(true);
    expect(result.nodes.map((node) => node.type)).toEqual([
      'battery',
      'consumer',
      'busbar',
      'fuse',
      'shunt',
    ]);
    expect(result.edges.filter((edge) => edge.sourceHandle === 'plus')).toHaveLength(4);
    expect(result.edges.filter((edge) => edge.sourceHandle === 'minus')).toHaveLength(4);
  });

  it('keeps the AutoWire domain module free of React Flow imports', () => {
    const source = fs.readFileSync(path.join(__dirname, 'autoWire.ts'), 'utf-8');
    expect(source).not.toMatch(/from ['"]reactflow['"]/);
  });

  it('preserves the user-set cable length and edge id when re-wiring an existing connection', () => {
    const nodes: PlannerNode[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } },
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
    ];

    const first = planAutoWiring(nodes, { idFactory: (() => { let i = 0; return () => `gen-${i++}`; })() });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Nutzer passt die Batterie->Shunt-Leitung auf 4.2 m / 10 mm² an.
    const batteryShunt = first.edges.find(
      (e) => e.source === 'b1' && e.target === first.nodes.find((n) => n.type === 'shunt')!.id && e.sourceHandle === 'plus'
    )!;
    const customEdges: CablePlannerEdge[] = first.edges.map((e) =>
      e.id === batteryShunt.id
        ? { ...e, data: { ...e.data, length: 4.2, crossSection: 10 } }
        : e
    );

    // Erneuter Auto-Wire-Lauf: Knoten (inkl. Struktur) bleiben bestehen, nur
    // die bestehenden, angepassten Kanten werden mitgegeben.
    const second = planAutoWiring(first.nodes, {
      idFactory: (() => { let i = 100; return () => `gen2-${i++}`; })(),
      existingEdges: customEdges,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const preserved = second.edges.find((e) => e.id === batteryShunt.id);
    expect(preserved).toBeDefined();
    expect(preserved!.data?.length).toBe(4.2);
    expect(preserved!.data?.crossSection).toBe(10);
    // Alle Kanten-IDs bleiben eindeutig.
    const ids = second.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not re-create a removed shunt/fuse, wiring around them instead', () => {
    const nodes: PlannerNode[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } },
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
    ];

    // Nutzer hat Shunt + Sicherungskasten entfernt.
    const result = planAutoWiring(nodes, {
      idFactory: () => `gen-x`,
      skipTypes: ['fuse', 'shunt'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Sammelschiene wird weiterhin angelegt, Shunt & Sicherungskasten NICHT.
    expect(result.nodes.some((n) => n.type === 'busbar')).toBe(true);
    expect(result.nodes.some((n) => n.type === 'fuse')).toBe(false);
    expect(result.nodes.some((n) => n.type === 'shunt')).toBe(false);

    const busbar = result.nodes.find((n) => n.type === 'busbar')!;
    // Batterie haengt direkt an der Sammelschiene (Shunt uebersprungen).
    expect(result.edges.some((e) => e.source === 'b1' && e.target === busbar.id)).toBe(true);
    // Verbraucher haengt direkt an der Sammelschiene (Sicherungskasten uebersprungen).
    const consumerPlus = result.edges.find((e) => e.target === 'c1' && e.sourceHandle === 'plus');
    expect(consumerPlus?.source).toBe(busbar.id);
  });

  it('exports the managed component types tracked for user removal', () => {
    expect(AUTO_WIRE_MANAGED_TYPES).toEqual(['busbar', 'fuse', 'shunt']);
  });
});
