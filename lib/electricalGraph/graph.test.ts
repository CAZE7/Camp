import { describe, expect, it } from 'vitest';
import { buildElectricalGraph, electricalGraphHash, fnv1a, systemVoltageOf } from './graph';
import type { Edge, Node } from '../domain/graph';
import { volts } from '../units';

const node = (id: string, type: string, data: Record<string, unknown> = {}, x = 0, y = 0): Node => ({
  id,
  type,
  position: { x, y },
  data: { label: id, ...data },
});

const edge = (id: string, source: string, target: string, data: Record<string, unknown> = {}): Edge => ({
  id,
  source,
  target,
  sourceHandle: 'plus',
  targetHandle: 'plus',
  data,
});

/** Kleiner, vollständiger Plan: Batterie → Schiene → Verbraucher + 230 V. */
const PLAN = {
  nodes: [
    node('batt', 'battery', { capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8 }, 0, 0),
    node('rail', 'busbar', { role: 'positive', rating: 150 }, 200, 0),
    node('led', 'consumer', { watts: 24 }, 400, 0),
    node('inv', 'inverter', { continuousPower: 2000 }, 400, 200),
    node('tv', 'consumer230v', { watts: 120 }, 600, 200),
  ],
  edges: [
    edge('e1', 'batt', 'rail'),
    edge('e2', 'rail', 'led'),
    edge('e3', 'rail', 'inv'),
    edge('e4', 'inv', 'tv', { edgeDomain: 'AC_230V' }),
  ],
};

describe('V2-GRAPH — elektrischer Graph (geometriefrei)', () => {
  it('enthält keinerlei Geometrie — Position, Maße, Wegpunkte fehlen bewusst', () => {
    const graph = buildElectricalGraph(PLAN.nodes, PLAN.edges);
    const serialized = JSON.stringify({
      nodes: graph.nodes,
      connections: graph.connections,
      circuits: graph.circuits,
    });
    for (const forbidden of ['position', '"x"', '"y"', 'width', 'height', 'waypoint', 'geometry']) {
      expect(serialized, `Geometrie im Graphen: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('führt Bauteile, Verbindungen und Domänen in stabiler Reihenfolge', () => {
    const graph = buildElectricalGraph(PLAN.nodes, PLAN.edges);
    expect(graph.nodes.map((entry) => entry.id)).toEqual(['batt', 'inv', 'led', 'rail', 'tv']);
    expect(graph.connections.map((entry) => entry.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(graph.domains).toEqual(['DC_12V', 'AC_230V']);
  });

  it('übernimmt Bauteilgrenzen je Knoten', () => {
    const graph = buildElectricalGraph(PLAN.nodes, PLAN.edges);
    expect(graph.constraints.get('rail')?.continuousCurrent).toBe(150);
    expect(graph.constraints.get('inv')?.continuousPower).toBe(2000);
    expect(graph.nodes.find((entry) => entry.id === 'batt')?.constraints.voltageClass).toBe('12V');
  });

  it('trennt DC-Insel und AC-Kreis', () => {
    const graph = buildElectricalGraph(PLAN.nodes, PLAN.edges);
    const dc = graph.circuits.find((circuit) => circuit.domain === 'DC_12V');
    const ac = graph.circuits.find((circuit) => circuit.domain === 'AC_230V');
    expect(dc?.nodeIds).toEqual(['batt', 'inv', 'led', 'rail']);
    expect(ac?.sourceId).toBe('inv');
    expect(ac?.nodeIds).toEqual(['inv', 'tv']);
    expect(ac?.connectionIds).toEqual(['e4']);
  });

  it('verwirft Kanten mit fehlendem Endpunkt statt sie halb zu führen', () => {
    const graph = buildElectricalGraph(PLAN.nodes, [...PLAN.edges, edge('tot', 'batt', 'geloescht')]);
    expect(graph.connections.map((entry) => entry.id)).not.toContain('tot');
  });

  it('übernimmt die Absicht jeder Verbindung', () => {
    const graph = buildElectricalGraph(PLAN.nodes, [
      edge('u1', 'batt', 'rail', { locked: true }),
      edge('a1', 'rail', 'led', { autoWired: true }),
    ]);
    const locked = graph.connections.find((entry) => entry.id === 'u1');
    const auto = graph.connections.find((entry) => entry.id === 'a1');
    expect(locked?.intent).toBe('locked');
    expect(locked?.pinned).toBe(true);
    expect(auto?.intent).toBe('auto');
    expect(auto?.pinned).toBe(false);
  });

  it('kennt die Spannungsebene der Anlage — auch bei erklärter Reihenschaltung', () => {
    const singles = buildElectricalGraph(PLAN.nodes, PLAN.edges);
    expect(systemVoltageOf(singles)).toBe(volts(12.8));

    const series = buildElectricalGraph(
      [
        node('b1', 'battery', { nominalVoltage: 12.8, bankId: 'reihe', bankTopology: 'series' }),
        node('b2', 'battery', { nominalVoltage: 12.8, bankId: 'reihe', bankTopology: 'series' }),
      ],
      []
    );
    expect(systemVoltageOf(series)).toBe(volts(25.6));
    expect(series.powerSystems[0]?.voltageClass).toBe('24V');
    const internalLinks = series.connections.filter((connection) => connection.origin === 'battery-bank');
    expect(internalLinks).toHaveLength(1);
    expect(internalLinks[0]).toMatchObject({
      bankId: 'reihe',
      bankLink: 'series',
      intent: 'required',
      pinned: true,
      from: { nodeId: 'b1', handle: 'minus', polarity: 'minus' },
      to: { nodeId: 'b2', handle: 'plus', polarity: 'plus' },
    });
    expect(series.circuits.find((circuit) => circuit.domain === 'DC_12V')?.nodeIds).toEqual(['b1', 'b2']);
  });

  it('repräsentiert eine gültige 2s2p-Bank mit Reihen- und Parallelverbindungen', () => {
    const graph = buildElectricalGraph(
      [
        node('b1', 'battery', {
          nominalVoltage: 12.8,
          capacity: 100,
          bankId: 'matrix',
          bankTopology: 'series-parallel',
          bankSeries: 2,
          bankParallel: 2,
        }),
        node('b2', 'battery', {
          nominalVoltage: 12.8,
          capacity: 100,
          bankId: 'matrix',
          bankTopology: 'series-parallel',
        }),
        node('b3', 'battery', {
          nominalVoltage: 12.8,
          capacity: 100,
          bankId: 'matrix',
          bankTopology: 'series-parallel',
        }),
        node('b4', 'battery', {
          nominalVoltage: 12.8,
          capacity: 100,
          bankId: 'matrix',
          bankTopology: 'series-parallel',
        }),
      ],
      []
    );
    expect(systemVoltageOf(graph)).toBe(volts(25.6));
    expect(graph.batteryBanks[0]?.capacityAh).toBe(200);
    expect(graph.connections.filter((connection) => connection.bankLink === 'series')).toHaveLength(2);
    expect(
      graph.connections.filter((connection) => connection.bankLink === 'parallel-positive')
    ).toHaveLength(1);
    expect(
      graph.connections.filter((connection) => connection.bankLink === 'parallel-negative')
    ).toHaveLength(1);
    expect(graph.circuits.find((circuit) => circuit.domain === 'DC_12V')?.nodeIds).toEqual([
      'b1',
      'b2',
      'b3',
      'b4',
    ]);
  });

  it('erzeugt für eine Bank mit unpassender Mitgliederzahl keine geratenen Serienlinks', () => {
    const graph = buildElectricalGraph(
      [
        node('b1', 'battery', {
          bankId: 'matrix',
          bankTopology: 'series-parallel',
          bankSeries: 2,
          bankParallel: 2,
        }),
        node('b2', 'battery', { bankId: 'matrix', bankTopology: 'series-parallel' }),
      ],
      []
    );
    expect(graph.batteryBanks[0]?.topology).toBe('unassigned');
    expect(graph.connections.filter((connection) => connection.origin === 'battery-bank')).toEqual([]);
    expect(graph.questions.some((question) => question.kind === 'member-count-mismatch')).toBe(true);
  });

  it('ein Plan ohne Batterie bekommt eine benannte, keine erfundene Ebene', () => {
    const graph = buildElectricalGraph([node('shore', 'shorePower'), node('tv', 'consumer230v')], []);
    expect(graph.powerSystems).toHaveLength(1);
    expect(graph.powerSystems[0]?.id).toBe('sys:default');
    expect(graph.batteryBanks).toEqual([]);
  });

  it('sammelt offene Fragen aus Bank- und AC-Modell in einer Liste', () => {
    const graph = buildElectricalGraph(
      [
        node('b1', 'battery'),
        node('b2', 'battery'),
        node('shore', 'shorePower'),
        node('inv', 'inverter'),
        node('tv', 'consumer230v'),
      ],
      [
        edge('e1', 'shore', 'tv', { edgeDomain: 'AC_230V' }),
        edge('e2', 'inv', 'tv', { edgeDomain: 'AC_230V' }),
      ]
    );
    const kinds = graph.questions.map((question) => question.kind);
    expect(kinds).toContain('ambiguous-topology');
    expect(kinds).toContain('multiple-sources');
    // Die Liste ist stabil sortiert (Determinismus der Anzeige).
    expect([...graph.questions].map((q) => q.id).sort()).toEqual(graph.questions.map((q) => q.id));
  });

  it('ist reihenfolgeunabhängig', () => {
    const forward = buildElectricalGraph(PLAN.nodes, PLAN.edges);
    const backward = buildElectricalGraph([...PLAN.nodes].reverse(), [...PLAN.edges].reverse());
    expect(electricalGraphHash(backward)).toBe(electricalGraphHash(forward));
  });

  describe('electricalGraphHash — Trennung Topologie / Geometrie (ADR 0008)', () => {
    it('Verschieben eines Knotens ändert den Hash NICHT', () => {
      const moved = PLAN.nodes.map((entry) => ({ ...entry, position: { x: entry.position.x + 777, y: 13 } }));
      expect(electricalGraphHash(buildElectricalGraph(moved, PLAN.edges))).toBe(
        electricalGraphHash(buildElectricalGraph(PLAN.nodes, PLAN.edges))
      );
    });

    it('eine neue Verbindung ändert den Hash', () => {
      const withExtra = [...PLAN.edges, edge('e5', 'rail', 'batt', { edgeDomain: 'DC_12V' })];
      expect(electricalGraphHash(buildElectricalGraph(PLAN.nodes, withExtra))).not.toBe(
        electricalGraphHash(buildElectricalGraph(PLAN.nodes, PLAN.edges))
      );
    });

    it('eine geänderte Absicht ändert den Hash (sie ist elektrisch relevant)', () => {
      const pinned = PLAN.edges.map((entry) =>
        entry.id === 'e1' ? { ...entry, data: { ...entry.data, locked: true } } : entry
      );
      expect(electricalGraphHash(buildElectricalGraph(PLAN.nodes, pinned))).not.toBe(
        electricalGraphHash(buildElectricalGraph(PLAN.nodes, PLAN.edges))
      );
    });

    it('eine geänderte Bauteilgrenze ändert den Hash', () => {
      const stronger = PLAN.nodes.map((entry) =>
        entry.id === 'rail' ? { ...entry, data: { ...entry.data, rating: 250 } } : entry
      );
      expect(electricalGraphHash(buildElectricalGraph(stronger, PLAN.edges))).not.toBe(
        electricalGraphHash(buildElectricalGraph(PLAN.nodes, PLAN.edges))
      );
    });
  });

  describe('fnv1a', () => {
    it('ist stabil, acht Hex-Zeichen lang und unterscheidet kleine Änderungen', () => {
      expect(fnv1a('')).toHaveLength(8);
      expect(fnv1a('abc')).toBe(fnv1a('abc'));
      expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
      expect(fnv1a('ab')).not.toBe(fnv1a('ba'));
    });
  });
});
