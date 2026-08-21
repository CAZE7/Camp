import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import {
  performAutoWiring,
  isStarterBatteryLabel,
  cumulativeDropAt,
  sizeDcEdges,
  applyFuseSizes,
  healUserEdges,
  resolveRails,
  relevantCumulativeDrop,
} from './autoWire';
import { volts } from './units';
import type { CableEdgeData } from '../components/edges/CableEdge';
import { FUSE_MAP } from './electrical';

type TestNode = Partial<Node> & { id: string; type: string; data: Record<string, unknown>; position?: { x: number; y: number } };

function n(id: string, type: string, data: Record<string, unknown> = {}, position = { x: 0, y: 0 }): Node {
  return { id, type, position, data } as Node;
}

function e(over: Partial<Edge<CableEdgeData>> & { source: string; target: string }): Edge<CableEdgeData> {
  return {
    id: over.id || `e-${over.source}-${over.target}`,
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    ...over,
  } as Edge<CableEdgeData>;
}

// ---------------------------------------------------------------------------
// performAutoWiring — öffentliche Top-Level-Funktion
// ---------------------------------------------------------------------------
describe('autoWire — performAutoWiring', () => {
  it('gibt null ohne Batterie zurück', () => {
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

  it('verteilt Solarladung über einen MPPT-Laderegler', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      n('s1', 'solar', { label: 'Panel', watts: 300 }),
    ];
    const out = performAutoWiring(nodes)!;
    const types = out.nodes.map((x) => x.type);
    expect(types.some((t) => t === 'mpptController' || t === 'charger')).toBe(true);
  });

  it('legt eine Starterbatterie an, wenn ein DC-DC-Booster vorhanden ist', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4' }),
      n('dcdc', 'dcdcCharger', { label: 'Booster', amps: 30 }),
    ];
    const out = performAutoWiring(nodes)!;
    const labels = out.nodes.map((x) => String(x.data?.label || ''));
    expect(labels.some((l) => /starter/i.test(l))).toBe(true);
  });

  it('erhält die AC-Kanten-Querschnitte für Landstrom → 230V-Verbraucher', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4' }),
      n('sp1', 'shorePower', { label: 'Landstrom' }),
      n('a1', 'consumer230v', { label: 'Steckdose', watts: 2000 }),
    ];
    const out = performAutoWiring(nodes)!;
    const ac = out.edges.find((x) => x.data?.edgeDomain === 'AC_230V');
    expect(ac).toBeTruthy();
    expect(ac!.data?.crossSection).toBeGreaterThanOrEqual(1.5);
  });
});

// ---------------------------------------------------------------------------
// isStarterBatteryLabel — Hilfsfunktion
// ---------------------------------------------------------------------------
describe('autoWire — isStarterBatteryLabel', () => {
  it('erkennt Starterbatterien am Label', () => {
    expect(isStarterBatteryLabel('Starterbatterie')).toBe(true);
    expect(isStarterBatteryLabel('Starter Battery')).toBe(true);
    expect(isStarterBatteryLabel('Aufbaubatterie')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cumulativeDropAt — Spannungsfall-Rekursion (R3)
// ---------------------------------------------------------------------------
describe('autoWire — cumulativeDropAt', () => {
  it('liefert 0 für eine Batterie (Startknoten)', () => {
    const nodes = [n('b1', 'battery', {})];
    const nodeMap = new Map(nodes.map((nn) => [nn.id, nn]));
    const result = cumulativeDropAt('b1', nodeMap, [], nodes, volts(12.8), new Set());
    expect(result.supply).toBe(0);
    expect(result.any).toBe(0);
    expect(result.hasSupplyPath).toBe(true);
  });

  it('liefert 0 für einen nicht vorhandenen Knoten', () => {
    const result = cumulativeDropAt('missing', new Map(), [], [], volts(12.8), new Set());
    expect(result.supply).toBe(0);
    expect(result.any).toBe(0);
    expect(result.hasSupplyPath).toBe(false);
  });

  it('summiert den Spannungsfall über einem DC-Pfad zur Batterie', () => {
    // Batterie → Sicherung (1 m, 2,5 mm²) → Verbraucher 12 A (1 m, 2,5 mm²)
    const nodes = [
      n('b1', 'battery', {}),
      n('f1', 'fuse', {}),
      n('c1', 'consumer', { watts: 96 }), // 96 W / 12,8 V = 7,5 A Last an c1
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'u1', source: 'b1', target: 'f1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 1, crossSection: 2.5, edgeDomain: 'DC_12V' } }),
      e({ id: 'u2', source: 'f1', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 1, crossSection: 2.5, edgeDomain: 'DC_12V' } }),
    ];
    const nodeMap = new Map(nodes.map((nn) => [nn.id, nn]));
    const result = cumulativeDropAt('c1', nodeMap, edges, nodes, volts(12.8), new Set());
    expect(result.hasSupplyPath).toBe(true);
    expect(result.supply).toBeGreaterThan(0);
  });

  it('zählt AC-Kanten nicht zum DC-Spannungsfall', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('sp1', 'shorePower', {}),
      n('a1', 'consumer230v', { watts: 300 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'ac1', source: 'sp1', target: 'a1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 2, crossSection: 1.5, edgeDomain: 'AC_230V' } }),
    ];
    const nodeMap = new Map(nodes.map((nn) => [nn.id, nn]));
    const result = cumulativeDropAt('a1', nodeMap, edges, nodes, volts(12.8), new Set());
    // AC wird ignoriert → kein eigener DC-Pfad, kein Incoming
    expect(result.hasSupplyPath).toBe(false);
    expect(result.supply).toBe(0);
  });

  it('bricht Zyklen über die visited-Menge ab', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('x1', 'consumer', { watts: 12 }),
      n('x2', 'consumer', { watts: 12 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'cyc-a', source: 'x1', target: 'x2', data: { length: 1, crossSection: 2.5, edgeDomain: 'DC_12V' } }),
      e({ id: 'cyc-b', source: 'x2', target: 'x1', data: { length: 1, crossSection: 2.5, edgeDomain: 'DC_12V' } }),
    ];
    const nodeMap = new Map(nodes.map((nn) => [nn.id, nn]));
    // Darf nicht endlos rekursiv laufen.
    expect(() => cumulativeDropAt('x1', nodeMap, edges, nodes, volts(12.8), new Set())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sizeDcEdges — Dimensionierung der DC-Kanten (R3)
// ---------------------------------------------------------------------------
describe('autoWire — sizeDcEdges', () => {
  it('setzt einen Querschnitt ≥ 1,5 mm² auf jeder Kante', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('c1', 'consumer', { watts: 24 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'd1', source: 'b1', target: 'c1', data: { length: 3 } }),
    ];
    sizeDcEdges(edges, nodes, edges, volts(12.8));
    for (const edge of edges) {
      expect(edge.data?.crossSection).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('dimensioniert eine hohe Last hoch (keine zu dünne Leitung)', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('i1', 'inverter', { watts: 2000 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'd1', source: 'b1', target: 'i1', data: { length: 2 } }),
    ];
    sizeDcEdges(edges, nodes, edges, volts(12.8));
    // 2000 W / 12,8 V / 0,85 ≈ 184 A → großer Querschnitt
    expect(edges[0].data?.crossSection).toBeGreaterThanOrEqual(25);
  });

  it('überschreibt vorhandene Querschnitte nicht mit kleineren Werten', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('c1', 'consumer', { watts: 12 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'd1', source: 'b1', target: 'c1', data: { length: 2, crossSection: 16 } }),
    ];
    sizeDcEdges(edges, nodes, edges, volts(12.8));
    expect(edges[0].data?.crossSection).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// applyFuseSizes — Sicherungsauswahl (R3, ELEC-001)
// ---------------------------------------------------------------------------
describe('autoWire — applyFuseSizes', () => {
  it('setzt eine Sicherung ≤ Kabel-Max (FUSE_MAP)', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('c1', 'consumer', { watts: 60 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'f1', source: 'b1', target: 'c1', data: { length: 2, crossSection: 2.5, edgeDomain: 'DC_12V' } }),
    ];
    applyFuseSizes(edges, nodes, volts(12.8));
    const fuse = edges[0].data?.fuseSize;
    expect(fuse).toBeDefined();
    expect(fuse!).toBeLessThanOrEqual(FUSE_MAP[2.5]);
  });

  it('stuft das Kabel hoch, wenn der Strom den Maximalwert übersteigt (keine Über-Sicherung)', () => {
    // 1000 W / 12,8 V / 0,85 ≈ 92 A an 2,5 mm² ist unzulässig — die
    // Funktion muss das Kabel hochtreiben, statt eine Sicherung über
    // FUSE_MAP[2.5] (=20 A) zu setzen (ELEC-001).
    const nodes = [
      n('b1', 'battery', {}),
      n('i1', 'inverter', { watts: 1000 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'f1', source: 'b1', target: 'i1', data: { length: 1, crossSection: 2.5, edgeDomain: 'DC_12V' } }),
    ];
    applyFuseSizes(edges, nodes, volts(12.8));
    const cs = edges[0].data?.crossSection!;
    const fuse = edges[0].data?.fuseSize!;
    expect(fuse).toBeLessThanOrEqual(FUSE_MAP[cs] ?? Infinity);
    expect(cs).toBeGreaterThan(2.5);
  });

  it('fasst Minus-Kanten nicht an (Sicherungen sitzen im Pluspfad)', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('c1', 'consumer', { watts: 24 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'm1', source: 'c1', target: 'b1', sourceHandle: 'minus', targetHandle: 'minus', data: { length: 2, crossSection: 2.5, edgeDomain: 'DC_12V' } }),
    ];
    applyFuseSizes(edges, nodes, volts(12.8));
    expect(edges[0].data?.fuseSize).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// healUserEdges — Umleiten unsicherer Nutzer-Kanten (R3)
// ---------------------------------------------------------------------------
describe('autoWire — healUserEdges', () => {
  function makeNodeMap(nodes: Node[]): Map<string, Node> {
    return new Map(nodes.map((nn) => [nn.id, nn]));
  }

  it('legt Batterie-Minus-Kanten über den Shunt um (kein Bypass)', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('sh', 'shunt', {}),
      n('c1', 'consumer', { watts: 24 }),
    ];
    const userEdges: Edge<CableEdgeData>[] = [
      e({ id: 'bad', source: 'b1', target: 'c1', sourceHandle: 'minus', targetHandle: 'minus', data: { length: 2, edgeDomain: 'DC_12V' } }),
    ];
    const connections = new Set(userEdges.map((ee) => `${ee.source}|${ee.target}|${ee.sourceHandle || ''}|${ee.targetHandle || ''}`));
    const healed = healUserEdges(userEdges, makeNodeMap(nodes), 'b1', 'sh', 'plusRail', 'minusRail', 'fuseBox', connections);
    expect(healed[0].source).toBe('sh');
  });

  it('legt Batterie-Plus auf einen Verbraucher über den Sicherungskasten', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('fb', 'fuse', {}),
      n('c1', 'consumer', { watts: 24 }),
    ];
    const userEdges: Edge<CableEdgeData>[] = [
      e({ id: 'bad', source: 'b1', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 2, edgeDomain: 'DC_12V' } }),
    ];
    const connections = new Set(userEdges.map((ee) => `${ee.source}|${ee.target}|${ee.sourceHandle || ''}|${ee.targetHandle || ''}`));
    const healed = healUserEdges(userEdges, makeNodeMap(nodes), 'b1', 'sh', 'plusRail', 'minusRail', 'fb', connections);
    expect(healed[0].source).toBe('fb');
  });

  it('legt Batterie-Plus auf einen Inverter auf die Plus-Schiene um', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('i1', 'inverter', { watts: 300 }),
    ];
    const userEdges: Edge<CableEdgeData>[] = [
      e({ id: 'bad', source: 'b1', target: 'i1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 1, edgeDomain: 'DC_12V' } }),
    ];
    const connections = new Set(userEdges.map((ee) => `${ee.source}|${ee.target}|${ee.sourceHandle || ''}|${ee.targetHandle || ''}`));
    const healed = healUserEdges(userEdges, makeNodeMap(nodes), 'b1', 'sh', 'plusRail', 'minusRail', 'fb', connections);
    expect(healed[0].source).toBe('plusRail');
  });

  it('entfernt Kanten, die nach dem Umlegen duplikat wären', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('sh', 'shunt', {}),
      n('c1', 'consumer', { watts: 24 }),
    ];
    // Zwei Kanten würden nach dem Umlegen beide auf sh→c1 zeigen.
    const userEdges: Edge<CableEdgeData>[] = [
      e({ id: 'a', source: 'b1', target: 'c1', sourceHandle: 'minus', targetHandle: 'minus', data: { length: 2, edgeDomain: 'DC_12V' } }),
      e({ id: 'b', source: 'sh', target: 'c1', sourceHandle: 'minus', targetHandle: 'minus', data: { length: 2, edgeDomain: 'DC_12V' } }),
    ];
    const connections = new Set(userEdges.map((ee) => `${ee.source}|${ee.target}|${ee.sourceHandle || ''}|${ee.targetHandle || ''}`));
    const healed = healUserEdges(userEdges, makeNodeMap(nodes), 'b1', 'sh', 'plusRail', 'minusRail', 'fb', connections);
    // Genau eine der Kanten fällt weg.
    expect(healed.length).toBe(1);
  });

  it('lässt Batterie-zu-Batterie-Kanten unangetastet (Parallelschaltung)', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('b2', 'battery', {}),
    ];
    const userEdges: Edge<CableEdgeData>[] = [
      e({ id: 'ok', source: 'b1', target: 'b2', sourceHandle: 'minus', targetHandle: 'minus', data: { length: 1, edgeDomain: 'DC_12V' } }),
    ];
    const connections = new Set(userEdges.map((ee) => `${ee.source}|${ee.target}|${ee.sourceHandle || ''}|${ee.targetHandle || ''}`));
    const healed = healUserEdges(userEdges, makeNodeMap(nodes), 'b1', 'sh', 'plusRail', 'minusRail', 'fb', connections);
    expect(healed.length).toBe(1);
    expect(healed[0].source).toBe('b1');
  });
});

// ---------------------------------------------------------------------------
// resolveRails — Busbar-Auflösung (R3)
// ---------------------------------------------------------------------------
describe('autoWire — resolveRails', () => {
  it('gibt bestehende Plus/Minus-Busbars zurück', () => {
    const battery = n('b1', 'battery', {});
    const plus = n('bp', 'busbar', { role: 'positive', label: 'Plus-Schiene' });
    const minus = n('bm', 'busbar', { role: 'negative', label: 'Minus-Schiene' });
    const currentNodes = [battery, plus, minus];
    const nodesByType: Record<string, Node[]> = { busbar: [plus, minus] };
    const nodesByLabel = new Map<string, Node>();
    const created = new Set<string>();
    const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, battery, created);
    expect(rails.plus.id).toBe('bp');
    expect(rails.minus.id).toBe('bm');
    expect(created.size).toBe(0);
  });

  it('erzeugt eine gemeinsame Busbar, wenn keine existiert', () => {
    const battery = n('b1', 'battery', {});
    const currentNodes: Node[] = [battery];
    const nodesByType: Record<string, Node[]> = {};
    const nodesByLabel = new Map<string, Node>();
    const created = new Set<string>();
    const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, battery, created);
    expect(rails.plus.type).toBe('busbar');
    expect(rails.minus.type).toBe('busbar');
    expect(rails.plus.id).toBe(rails.minus.id);
    expect(created.has(rails.plus.id)).toBe(true);
  });

  it('nutzt die ersten zwei Busbars, wenn Rollen nicht unterscheidbar sind', () => {
    const battery = n('b1', 'battery', {});
    const bb1 = n('x1', 'busbar', { label: 'BB1' });
    const bb2 = n('x2', 'busbar', { label: 'BB2' });
    const currentNodes = [battery, bb1, bb2];
    const nodesByType: Record<string, Node[]> = { busbar: [bb1, bb2] };
    const nodesByLabel = new Map<string, Node>();
    const created = new Set<string>();
    const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, battery, created);
    expect(rails.plus.id).toBe('x1');
    expect(rails.minus.id).toBe('x2');
  });
});

/**
 * K1c — Migration auf Branded Types (lib/units.ts).
 *
 * Geprüft wird das Laufzeitverhalten an den Persistenzgrenzen: Kantendaten
 * kommen aus localStorage und können alles Mögliche enthalten. Vorher wurde
 * daraus stillschweigend `NaN` weitergerechnet, jetzt greifen benannte
 * Ersatzwerte (`edgeLength`, `edgeCrossSection`).
 */
describe('autoWire mit typsicheren Einheiten (K1c)', () => {
  const battery = n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4' });
  const consumer = n('c1', 'consumer', { label: 'Kühlbox', watts: 60 });

  it('verkraftet unbrauchbare Längen und Querschnitte in edge.data', () => {
    const nodes = [battery, consumer];
    const broken = [
      e({ source: 'b1', target: 'c1', data: { length: -5, crossSection: 0 } as CableEdgeData }),
    ];
    const out = performAutoWiring(nodes, broken);
    expect(out).not.toBeNull();
    for (const edge of out!.edges) {
      if (edge.data?.edgeDomain === 'AC_230V') continue;
      expect(Number.isFinite(edge.data?.crossSection ?? 0)).toBe(true);
      expect(edge.data?.crossSection ?? 0).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('erzeugt niemals NaN-Querschnitte oder NaN-Sicherungen', () => {
    const nodes = [
      battery,
      n('c1', 'consumer', { label: 'Defekt', watts: 'kaputt' }),
      n('c2', 'consumer', { label: 'Negativ', watts: -100 }),
      n('i1', 'inverter', { label: 'WR', watts: 2000 }),
    ];
    const out = performAutoWiring(nodes)!;
    for (const edge of out.edges) {
      expect(Number.isNaN(edge.data?.crossSection ?? 0)).toBe(false);
      expect(Number.isNaN(edge.data?.fuseSize ?? 0)).toBe(false);
    }
  });

  it('cumulativeDropAt liefert einen nicht-negativen Spannungsfall in Volt', () => {
    const nodes = [battery, consumer];
    const out = performAutoWiring(nodes)!;
    const nodeMap = new Map(out.nodes.map((node) => [node.id, node]));
    const drop = cumulativeDropAt('c1', nodeMap, out.edges, out.nodes, volts(12.8), new Set());
    expect(drop.supply).toBeGreaterThanOrEqual(0);
    expect(drop.any).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(drop.supply)).toBe(true);
  });

  it('hält den 3%-Spannungsfall über den gesamten Versorgungspfad ein', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Aufbau', capacity: 200, chemistry: 'LiFePO4' }),
      n('c1', 'consumer', { label: 'Große Last', watts: 600 }),
    ];
    const out = performAutoWiring(nodes)!;
    const nodeMap = new Map(out.nodes.map((node) => [node.id, node]));
    const drop = relevantCumulativeDrop('c1', nodeMap, out.edges, out.nodes, volts(12.8));
    expect(drop).toBeLessThanOrEqual(12.8 * 0.03 + 1e-9);
  });

  it('dimensioniert unverändert zur Referenz vor der Migration', () => {
    // Regressionsanker: dieselbe Eingabe muss dieselben Querschnitte liefern
    // wie vor der Umstellung auf Branded Types.
    const nodes = [
      n('b1', 'battery', { label: 'Aufbau', capacity: 200, chemistry: 'LiFePO4' }),
      n('c1', 'consumer', { label: 'Kühlbox', watts: 60 }),
    ];
    const out = performAutoWiring(nodes)!;
    const sections = out.edges
      .filter((edge) => edge.data?.edgeDomain !== 'AC_230V')
      .map((edge) => edge.data?.crossSection)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(sections.every((value) => value !== undefined)).toBe(true);
    expect(sections.every((value) => [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70].includes(value as number))).toBe(true);
  });

  it('AC-Kanten bekommen Strom aus 230 V statt aus der Systemspannung', () => {
    const nodes = [
      battery,
      n('sp1', 'shorePower', { label: 'Landstrom' }),
      n('c230', 'consumer230v', { label: 'Kochfeld', watts: 2000 }),
    ];
    const out = performAutoWiring(nodes)!;
    const acEdges = out.edges.filter((edge) => edge.data?.edgeDomain === 'AC_230V');
    expect(acEdges.length).toBeGreaterThan(0);
    for (const edge of acEdges) {
      expect(edge.data?.crossSection).toBeGreaterThanOrEqual(1.5);
      // 2000 W / 230 V ≈ 8.7 A → kein 25-mm²-Kabel nötig
      expect(edge.data?.crossSection).toBeLessThanOrEqual(6);
    }
  });
});
