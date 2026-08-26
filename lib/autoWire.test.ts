import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import {
  performAutoWiring,
  isStarterBatteryLabel,
  cumulativeDropAt,
  sizeDcEdges,
  sizeAcEdges,
  applyFuseSizes,
  healUserEdges,
  resolveRails,
  pickHouseBattery,
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

  it('stempelt Auto-Solar-Kanten (Panel→MPPT) als Solar statt DC_12V', () => {
    const out = performAutoWiring([
      n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4' }),
      n('s1', 'solar', { label: 'Panel', watts: 300 }),
    ])!;
    const solarEdges = out.edges.filter((x) => x.source === 's1');
    expect(solarEdges.length).toBeGreaterThan(0);
    for (const edge of solarEdges) {
      expect(edge.data?.edgeDomain).toBe('Solar');
    }
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
// sizeAcEdges — 230-V-Leitungen (AUTO-001: bisher nur indirekt getestet)
// ---------------------------------------------------------------------------
describe('autoWire — sizeAcEdges', () => {
  it('dimensioniert Landstrom → 230-V-Gerät nach Last und Länge (230 V, 3 %)', () => {
    const nodes = [
      n('sp', 'shorePower', {}),
      n('c1', 'consumer230v', { watts: 3680 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'ac1', source: 'sp', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 30, edgeDomain: 'AC_230V' } }),
    ];
    sizeAcEdges(edges, nodes);
    // 3680 W / 230 V = 16 A → Spannungsfall dominiert bei 30 m:
    // A = (16 A · 2 · 30 m) / (58 · 4,6 V) = 3,60 mm² → 4 mm² Normquerschnitt.
    expect(edges[0].data?.crossSection).toBe(4);
  });

  it('nutzt die Last des 230-V-Geräts, nicht die Wechselrichter-Nennleistung', () => {
    // Die AC-Leitung Wechselrichter → Gerät trägt den Gerätestrom. Eine
    // Auslegung nach Wechselrichter-Nennleistung (5000 W → 6 mm²) wäre falsch.
    const nodes = [
      n('i1', 'inverter', { watts: 5000 }),
      n('c1', 'consumer230v', { watts: 3680 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'ac1', source: 'i1', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 30, edgeDomain: 'AC_230V' } }),
    ];
    sizeAcEdges(edges, nodes);
    // 3680 W / 230 V = 16 A bei 30 m → Spannungsfall dominiert → 4 mm².
    expect(edges[0].data?.crossSection).toBe(4);
  });

  it('dimensioniert Landstrom-Leitungen nach dem Ladegerät (min. 16 A CEE)', () => {
    const nodes = [
      n('sp', 'shorePower', {}),
      n('ch', 'acBatteryCharger', { amps: 20 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'ac1', source: 'sp', target: 'ch', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 2, edgeDomain: 'AC_230V' } }),
    ];
    sizeAcEdges(edges, nodes);
    // 20 A bei 2 m (Derating 0,7): thermisch 4 mm²; die Leitung darf nicht am
    // 16-A-Landstromanschluss vorbeigehen und den 20-A-Lader unterdimensionieren.
    expect(edges[0].data?.crossSection).toBe(4);
  });

  it('unterschreitet einen vorhandenen Querschnitt nie (Nutzerwert ist Untergrenze)', () => {
    const nodes = [
      n('sp', 'shorePower', {}),
      n('c1', 'consumer230v', { watts: 230 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'ac1', source: 'sp', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus', data: { length: 2, crossSection: 10, edgeDomain: 'AC_230V' } }),
    ];
    sizeAcEdges(edges, nodes);
    expect(edges[0].data?.crossSection).toBe(10);
  });

  it('lässt Kanten ohne AC-Markierung unangetastet', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('c1', 'consumer', { watts: 24 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'dc1', source: 'b1', target: 'c1', data: { length: 2, crossSection: 4, edgeDomain: 'DC_12V' } }),
      e({ id: 'no-data', source: 'b1', target: 'c1' }),
    ];
    sizeAcEdges(edges, nodes);
    expect(edges[0].data?.crossSection).toBe(4);
    expect(edges[1].data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// pickHouseBattery — Wahl der Aufbaubatterie (AUTO-001: bisher nur indirekt)
// ---------------------------------------------------------------------------
describe('autoWire — pickHouseBattery', () => {
  it('bevorzugt eine Nicht-Starterbatterie, auch wenn sie später im Array steht', () => {
    const starter = n('s1', 'battery', { label: 'Starterbatterie' });
    const house = n('h1', 'battery', { label: 'Aufbaubatterie' });
    expect(pickHouseBattery([starter, house])?.id).toBe('h1');
  });

  it('fällt auf die erste Batterie zurück, wenn alle wie Starter aussehen', () => {
    const only = n('s1', 'battery', { label: 'Starterbatterie' });
    expect(pickHouseBattery([only])?.id).toBe('s1');
  });

  it('liefert undefined für eine leere Batterieliste', () => {
    expect(pickHouseBattery([])).toBeUndefined();
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

  it('legt Minus-Rückleiter zur Batterie über den Shunt um (target-Handle)', () => {
    // Verbraucher-Minus zurück zur Batterie ist der klassische Shunt-Bypass in
    // Gegenrichtung: der Ziel-Handle hängt am Batterie-Minus.
    const nodes = [
      n('b1', 'battery', {}),
      n('sh', 'shunt', {}),
      n('c1', 'consumer', { watts: 24 }),
    ];
    const userEdges: Edge<CableEdgeData>[] = [
      e({ id: 'ret', source: 'c1', target: 'b1', sourceHandle: 'minus', targetHandle: 'minus', data: { length: 2, edgeDomain: 'DC_12V' } }),
    ];
    const connections = new Set(userEdges.map((ee) => `${ee.source}|${ee.target}|${ee.sourceHandle || ''}|${ee.targetHandle || ''}`));
    const healed = healUserEdges(userEdges, makeNodeMap(nodes), 'b1', 'sh', 'plusRail', 'minusRail', 'fuseBox', connections);
    expect(healed[0].target).toBe('sh');
    expect(healed[0].source).toBe('c1');
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

  it('erzeugt zwei getrennte Busbars, wenn keine existiert', () => {
    const battery = n('b1', 'battery', {});
    const currentNodes: Node[] = [battery];
    const nodesByType: Record<string, Node[]> = {};
    const nodesByLabel = new Map<string, Node>();
    const created = new Set<string>();
    const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, battery, created);
    expect(rails.plus.type).toBe('busbar');
    expect(rails.minus.type).toBe('busbar');
    expect(rails.plus.id).not.toBe(rails.minus.id);
    expect(created.has(rails.plus.id)).toBe(true);
    expect(created.has(rails.minus.id)).toBe(true);
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

  it('nutzt eine einzelne vorhandene Busbar für Plus und erzeugt eine getrennte Minus-Schiene', () => {
    const battery = n('b1', 'battery', {});
    const single = n('x1', 'busbar', { label: 'Main Busbar' });
    const currentNodes = [battery, single];
    const nodesByType: Record<string, Node[]> = { busbar: [single] };
    const nodesByLabel = new Map<string, Node>();
    const created = new Set<string>();
    const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, battery, created);
    expect(rails.plus.id).toBe('x1');
    expect(rails.minus.id).not.toBe('x1');
    expect(created.has(rails.minus.id)).toBe(true);
  });

  it('respektiert Rollen, auch wenn nur eine Schiene explizit markiert ist', () => {
    // Die positive Schiene steht im Array hinter einer unmarkierten Schiene.
    // Ohne Rollen-Auswahl würde sie fälschlich als Minus-Schiene verwendet.
    const battery = n('b1', 'battery', {});
    const unlabeled = n('x1', 'busbar', { label: 'BB1' });
    const positive = n('x2', 'busbar', { role: 'positive', label: 'Plus-Schiene' });
    const currentNodes = [battery, unlabeled, positive];
    const nodesByType: Record<string, Node[]> = { busbar: [unlabeled, positive] };
    const nodesByLabel = new Map<string, Node>();
    const created = new Set<string>();
    const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, battery, created);
    expect(rails.plus.id).toBe('x2');
    expect(rails.minus.id).toBe('x1');
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

// ---------------------------------------------------------------------------
// Regressionstests für die Audit-Fehler (aus dem Deep-Audit von lib/autoWire.ts)
// ---------------------------------------------------------------------------
describe('autoWire — behobene Audit-Fehler', () => {
  it('erzeugt getrennte Plus-/Minus-Schienen (kein Kurzschluss am Standardplan)', () => {
    const nodes = [
      n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4' }),
      n('c1', 'consumer', { label: 'LED', watts: 20 }),
    ];
    const out = performAutoWiring(nodes)!;
    const busbars = out.nodes.filter((x) => x.type === 'busbar');
    const plus = out.nodes.find((x) => x.type === 'busbar' && x.data?.role === 'positive');
    const minus = out.nodes.find((x) => x.type === 'busbar' && x.data?.role === 'negative');
    expect(busbars.length).toBeGreaterThanOrEqual(2);
    expect(plus).toBeDefined();
    expect(minus).toBeDefined();
    expect(plus!.id).not.toBe(minus!.id);
    expect(out.edges.some((x) => x.source === 'b1' && x.target === plus!.id && x.sourceHandle === 'plus')).toBe(true);
    expect(out.edges.some((x) => x.target === minus!.id && x.sourceHandle === 'minus' && x.source !== 'b1')).toBe(true);
  });

  it('legt Batterien unterschiedlicher Chemie/Nennspannung nicht parallel', () => {
    const out = performAutoWiring([
      n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8 }),
      n('b2', 'battery', { label: 'Zweit', capacity: 100, chemistry: 'AGM', nominalVoltage: 24 }),
      n('c1', 'consumer', { label: 'LED', watts: 20 }),
    ])!;
    const plus = out.nodes.find((x) => x.type === 'busbar' && x.data?.role === 'positive');
    expect(out.edges.some((x) => x.source === 'b2' && x.target === plus!.id)).toBe(false);
  });

  it('erzwingt 16 mm² Masseanbindung, obwohl eine Nutzerkante Masse→Verbraucher existiert', () => {
    const out = performAutoWiring(
      [
        n('b1', 'battery', { label: 'Aufbau', capacity: 100, chemistry: 'LiFePO4' }),
        n('g1', 'ground', { label: 'Masse' }),
        n('c1', 'consumer', { label: 'LED', watts: 50 }),
      ],
      [e({ id: 'u-g', source: 'g1', target: 'c1', sourceHandle: 'minus', targetHandle: 'minus', data: { length: 2 } })]
    )!;
    const minus = out.nodes.find((x) => x.type === 'busbar' && x.data?.role === 'negative');
    const bond = out.edges.find((x) => x.source === minus!.id && x.target === 'g1' && x.sourceHandle === 'minus');
    expect(bond).toBeDefined();
    expect(bond!.data?.crossSection).toBe(16);
  });

  it('dimensioniert die Inverter-Zuleitung nach der 230-V-Gerätelast', () => {
    const out = performAutoWiring([
      n('b1', 'battery', { label: 'Aufbau', capacity: 200, chemistry: 'LiFePO4' }),
      n('i1', 'inverter', { label: 'WR', continuousPower: 5000 }),
      n('a1', 'consumer230v', { label: 'Kochfeld', watts: 5000 }),
    ])!;
    const edge = out.edges.find((x) => x.target === 'i1' && x.sourceHandle === 'plus');
    expect(edge).toBeDefined();
    expect(edge!.data?.crossSection).toBeGreaterThanOrEqual(16);
  });

  it('verkleinert einen vorhandenen Querschnitt über 70 mm² nicht', () => {
    const nodes = [
      n('b1', 'battery', {}),
      n('c1', 'consumer', { watts: 5 }),
    ];
    const edges: Edge<CableEdgeData>[] = [
      e({ id: 'd1', source: 'b1', target: 'c1', data: { length: 1, crossSection: 95, edgeDomain: 'DC_12V' } }),
    ];
    sizeDcEdges(edges, nodes, edges, volts(12.8));
    expect(edges[0].data?.crossSection).toBe(95);
    expect(() => applyFuseSizes(edges, nodes, volts(12.8))).not.toThrow();
  });

  it('erzeugt bei nur Starterbatterie + Booster eine Aufbaubatterie statt Selbstschleife', () => {
    const out = performAutoWiring([
      n('b1', 'battery', { label: 'Starterbatterie', chemistry: 'AGM' }),
      n('d1', 'dcdcCharger', { label: 'Booster', amps: 30 }),
    ])!;
    const house = out.nodes.find((x) => x.type === 'battery' && !String(x.data?.label ?? '').match(/start/i));
    expect(house).toBeDefined();
    // Der Booster wird an Starter UND Schiene angelegt, nie nur an die Batterie.
    const boosterToStarter = out.edges.find((x) => x.source === 'b1' && x.target === 'd1');
    expect(boosterToStarter).toBeDefined();
  });

  it('markiert unmarkierte Nutzer-DC-Kanten mit DC_12V', () => {
    const out = performAutoWiring(
      [n('b1', 'battery', {}), n('c1', 'consumer', { watts: 20 })],
      [e({ id: 'u-dc', source: 'b1', target: 'c1', data: { length: 2 } })]
    )!;
    const userEdge = out.edges.find((x) => x.id === 'u-dc')!;
    expect(userEdge.data?.edgeDomain).toBe('DC_12V');
  });

  it('versorgt jeden Wechselrichter mit Landstrom-Eingang', () => {
    const out = performAutoWiring([
      n('b1', 'battery', { label: 'Aufbau', capacity: 200, chemistry: 'LiFePO4' }),
      n('i1', 'inverter', { label: 'WR1', watts: 1000 }),
      n('i2', 'inverter', { label: 'WR2', watts: 1000 }),
      n('sp1', 'shorePower', { label: 'Landstrom' }),
    ])!;
    expect(out.edges.some((x) => x.source === 'sp1' && x.target === 'i1' && x.targetHandle === 'ac_in')).toBe(true);
    expect(out.edges.some((x) => x.source === 'sp1' && x.target === 'i2' && x.targetHandle === 'ac_in')).toBe(true);
  });
});
