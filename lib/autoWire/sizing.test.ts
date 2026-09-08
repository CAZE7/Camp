import { describe, it, expect } from 'vitest';
import { applyFuseTypes, sizeDcEdges } from './sizing';
import { type CableEdge } from './primitives';
import { volts } from '../units';
import type { Node } from '../domain/graph';

const n = (id: string, type: string, data: Record<string, unknown>): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const solarEdge = (id: string, length: number): CableEdge => ({
  id,
  source: 's1',
  target: 'm1',
  sourceHandle: 'plus',
  targetHandle: 'plus',
  data: { length, edgeDomain: 'Solar' },
});

/**
 * sizeDcEdges dimensioniert Solar-Zuleitungen (Panel → MPPT) gegen das
 * MPP-Spannungsbudget (18 V, AUDIT ELE-007) statt gegen 12,8 V — diese Tests
 * pinnen das Budget an Kanten, deren Querschnitt je nach Basis unterschiedlich
 * ausfällt.
 */
describe('AUDIT ELE-007 — Solar-Dimensionierung auf MPP-Basis', () => {
  it('8 m Panelleitung 200 W: 16 mm² auf 18-V-Basis (12,8 V hätte 25 mm² erzwungen)', () => {
    const nodes = [n('s1', 'solar', { watts: 200 }), n('m1', 'mpptController', { amps: 30 })];
    const edges = [solarEdge('e1', 8)];
    // Auslegungsstrom 1,56 × Isc ≈ 17,4 A; erlaubter Kanten-Drop
    // 2 % × 18 V = 0,36 V → A = 17,4 × 16 m / (58 × 0,36) ≈ 13,3 mm² → 16 mm².
    sizeDcEdges(edges, nodes, edges, volts(12.8));
    expect(edges[0]!.data?.crossSection).toBe(16);
    expect(edges[0]!.data?.dropWarning).toBe(false);
  });

  it('30 m Panelleitung: 50 mm² auf 18-V-Basis (12,8 V läge über der 70-mm²-Decke)', () => {
    const nodes = [n('s1', 'solar', { watts: 200 }), n('m1', 'mpptController', { amps: 30 })];
    const edges = [solarEdge('e1', 30)];
    // A = 17,4 × 60 m / (58 × 0,36 V) ≈ 49,9 mm² → 50 mm².
    // Auf 12,8-V-Basis wäre A ≈ 70,2 mm² → Deckel gerissen: dieser Fall
    // diskriminiert also direkt die Bewertungsbasis.
    sizeDcEdges(edges, nodes, edges, volts(12.8));
    expect(edges[0]!.data?.crossSection).toBe(50);
    // dropWarning markiert nur Lastketten (Verbraucher/Wechselrichter) — ein
    // reiner Panel-Plan setzt das Flag zurück statt es zu missbrauchen.
    expect(edges[0]!.data?.dropWarning).toBe(false);
  });
});

describe('AUDIT DOM-002 — applyFuseTypes: Bauform nach Abschaltvermögen', () => {
  const battery = (data: Record<string, unknown>): Node => ({
    id: 'b1',
    type: 'battery',
    position: { x: 0, y: 0 },
    data: { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4', ...data },
  });
  const fusedEdge = (fuseSize: number, extra: Record<string, unknown> = {}): CableEdge => ({
    id: 'e1',
    source: 'b1',
    target: 'bus1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data: { fuseSize, crossSection: 35, edgeDomain: 'DC_12V', ...extra },
  });
  const nodes = [battery({}), n('bus1', 'busbar', {})];

  it('100-Ah-LiFePO4 (Ik ≈ 4,3 kA) → Class T, einzige Bauform über dem Bank-Ik', () => {
    const edges = [fusedEdge(100)];
    applyFuseTypes(edges, nodes, 12.8);
    // MEGA 2 kA, ANL 2,5 kA, MRBF 3 kA — alle unterhalb 4,27 kA: Class T.
    expect(edges[0]!.data?.fuseType).toBe('classT');
  });

  it('geringe Bank (kleine AGM, Ik < 2 kA) → MEGA als kleinste tragende Bauform ab 31 A', () => {
    const small = [battery({ capacity: 30, chemistry: 'AGM' }), n('bus1', 'busbar', {})];
    // Ri = 5 mΩ × 100/30 = 16,7 mΩ → Ik ≈ 12,8/0,0167 ≈ 768 A (< 1 kA)
    const edges = [fusedEdge(60)];
    applyFuseTypes(edges, small, 12.8);
    expect(edges[0]!.data?.fuseType).toBe('mega'); // über 30 A Nennstrom kein ATO
  });

  it('Zweig ≤ 30 A darf ATO bekommen, wenn die Bank-Ik klein genug ist', () => {
    const small = [battery({ capacity: 30, chemistry: 'AGM' }), n('bus1', 'busbar', {})];
    const edges = [fusedEdge(10)];
    applyFuseTypes(edges, small, 12.8);
    expect(edges[0]!.data?.fuseType).toBe('ato');
  });

  it('Nutzer-Einträge bleiben unangetastet; AC-Kanten bekommen keine DC-Bauform', () => {
    const keep: CableEdge = {
      id: 'e2',
      source: 'b1',
      target: 'bus1',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      data: { fuseSize: 100, crossSection: 35, edgeDomain: 'DC_12V', fuseType: 'anl' },
    };
    const ac: CableEdge = {
      id: 'e3',
      source: 'sp',
      target: 'i1',
      sourceHandle: 'acIn',
      targetHandle: 'acIn',
      data: { fuseSize: 16, crossSection: 2.5, edgeDomain: 'AC_230V' },
    };
    applyFuseTypes([keep, ac], nodes, 12.8);
    expect(keep.data?.fuseType).toBe('anl');
    expect(ac.data?.fuseType).toBeUndefined();
  });

  it('ohne schätzbare Bank wird die Bauform ehrlich nicht erfunden', () => {
    const weak = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} } as Node,
      n('bus1', 'busbar', {}),
    ];
    const edges = [fusedEdge(100)];
    applyFuseTypes(edges, weak, 12.8);
    expect(edges[0]!.data?.fuseType).toBeUndefined();
  });
});
