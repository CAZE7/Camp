/**
 * P0-3 Integration: Verlegebedingungen wirken auf DIESELBEN Stellen wie
 * bisher die Pauschale — Querschnitt, Sicherung und Infeasibility-Marker.
 */
import { describe, expect, it } from 'vitest';
import { sizeDcEdges, sizeAcEdges, applyFuseSizes, markInfeasibleSizing } from './sizing';
import { performAutoWiring } from '../autoWire';
import { cableSizingFor } from '../cableConditions';
import type { CableEdge } from './primitives';
import type { Node } from '../domain/graph';
import type { Volts } from '../units';

const SYS = 12.8 as Volts;

const plan = (condition?: Record<string, unknown>) => {
  const nodes: Node[] = [
    {
      id: 'bat',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8 },
    },
    { id: 'bus', type: 'busbar', position: { x: 300, y: 0 }, data: { rating: 200 } },
    { id: 'load', type: 'consumer', position: { x: 600, y: 0 }, data: { watts: 360 } }, // 30 A bei 12 V
  ];
  const cable = (
    id: string,
    source: string,
    target: string,
    handle: string,
    extra: Record<string, unknown> = {}
  ): CableEdge => ({
    id,
    source,
    target,
    sourceHandle: handle,
    targetHandle: handle,
    data: { edgeDomain: 'DC_12V', length: 1, crossSection: 10, ...extra },
  });
  const edges: CableEdge[] = [
    cable('e-plus', 'bat', 'bus', 'plus', condition),
    cable('e-minus', 'bus', 'bat', 'minus'),
    cable('e-load-plus', 'bus', 'load', 'plus'),
    cable('e-load-minus', 'bus', 'load', 'minus'),
  ];
  return { nodes, edges };
};

const dimension = (condition?: Record<string, unknown>) => {
  const { nodes, edges } = plan(condition);
  const dc = edges.filter((edge) => edge.data?.edgeDomain !== 'AC_230V');
  sizeDcEdges(dc, nodes, edges, SYS);
  applyFuseSizes(dc, nodes, SYS, undefined, edges);
  markInfeasibleSizing(dc, nodes, SYS, edges);
  return edges.find((edge) => edge.id === 'e-plus')!.data!;
};

describe('AutoWire-Sizing mit Verlegebedingungen', () => {
  it('Referenzplan bleibt beim eingefrorenen 25-mm²-/50-A-Ergebnis', () => {
    const data = dimension();
    expect(data.crossSection).toBe(25);
    expect(data.fuseSize).toBe(50);
    expect(data.fuseWarning).toBe(false);
  });

  it('Motorraum 60 °C ⇒ dickeres Kabel, Sicherung bleibt unter I_z', () => {
    const data = dimension({ installationCondition: 'engine-bay' });
    const sizing = cableSizingFor({ installationCondition: 'engine-bay' });
    expect(data.crossSection).toBeGreaterThan(25);
    expect(data.fuseSize).toBeLessThanOrEqual(sizing.maxFuse(data.crossSection!));
    expect(data.fuseSize).toBeLessThanOrEqual(sizing.iz(data.crossSection!));
    expect(data.fuseWarning).toBe(false);
  });

  it('Herstellerangabe I_z = 25 A ⇒ kein 50-A-Schutzorgan, Plan wird als nicht ausführbar markiert', () => {
    const data = dimension({ installationCondition: 'datasheet', manufacturerIzA: 25 });
    expect(data.fuseSize).toBeLessThanOrEqual(25);
    // Der Laststrom (30 A) ist mit diesem Datenblatt nicht mehr absicherbar:
    // der Marker bleibt sichtbar, statt den Plan „geeignet" zu nennen.
    expect(data.fuseWarning).toBe(true);
  });

  it('Golden-Master-Pfad ohne Verlegebedingungen bleibt unverändert', () => {
    const result = performAutoWiring(
      [
        {
          id: 'bat',
          type: 'battery',
          position: { x: 0, y: 0 },
          data: { capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8, bmsContinuousDischarge: 300 },
        },
        {
          id: 'inv',
          type: 'inverter',
          position: { x: 400, y: 0 },
          data: { continuousPower: 1500, watts: 1500 },
        },
      ] as Node[],
      []
    );
    expect(result).not.toBeNull();
    expect(result!.edges.every((edge) => edge.data?.installationCondition === undefined)).toBe(true);
    expect(result!.edges.some((edge) => Number(edge.data?.crossSection) > 0)).toBe(true);
  });
});

/** Review-Korrektur: ungültige Plandaten dürfen AutoWire nicht abstürzen lassen. */
describe('Ungültige Verlegebedingungen im Produktpfad', () => {
  it('markieren die Leitung als nicht ausführbar, statt den Lauf abzubrechen', () => {
    expect(() => dimension({ installationCondition: 'custom', ambientC: 95 })).not.toThrow();
    const data = dimension({ installationCondition: 'custom', ambientC: 95 });
    expect(data.fuseWarning).toBe(true);
  });

  it('eigene Werte ohne Preset wirken auch im Sizing (nicht nur im Inspektor)', () => {
    const reference = dimension();
    const custom = dimension({ ambientC: 60 });
    expect(custom.crossSection).toBeGreaterThan(reference.crossSection!);
  });
});

describe('AC-Pfad nutzt dieselbe Bedingung wie der DC-Pfad', () => {
  const acPlan = (extra: Record<string, unknown> = {}) => {
    const nodes = [
      { id: 'shore', type: 'shorePower', position: { x: 0, y: 0 }, data: { rating: 100 } },
      { id: 'load', type: 'consumer', position: { x: 400, y: 0 }, data: { watts: 3000 } },
    ];
    const edge: CableEdge = {
      id: 'ac1',
      source: 'shore',
      target: 'load',
      sourceHandle: 'ac',
      targetHandle: 'ac',
      data: { edgeDomain: 'AC_230V', length: 2, crossSection: 95, ...extra },
    };
    return { nodes, edge };
  };

  it('>70-mm²-Zweig: Referenz akzeptiert 100 A, Motorraum nicht', () => {
    const reference = acPlan();
    sizeAcEdges([reference.edge], reference.nodes);
    expect(reference.edge.data!.fuseSize).toBe(100);

    const engine = acPlan({ installationCondition: 'engine-bay' });
    sizeAcEdges([engine.edge], engine.nodes);
    expect(engine.edge.data!.fuseSize).toBeLessThan(100);
  });

  it('ungültige AC-Bedingung ⇒ Warnmarke, kein Absturz', () => {
    const plan = acPlan({ installationCondition: 'custom', ambientC: 95 });
    expect(() => sizeAcEdges([plan.edge], plan.nodes)).not.toThrow();
    expect(plan.edge.data!.fuseWarning).toBe(true);
  });
});
