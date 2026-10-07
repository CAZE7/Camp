/**
 * Auftrag Phase 12 — Regressionstests des Strommodells (1–9, 16).
 *
 * Geprüft wird das Verhalten, das die Auftragsvorgabe festschreibt:
 *  1. Hauptstrang trägt die Summe der nachgelagerten Lasten.
 *  2. Abzweig trägt nur seine eigene(n) Last(en).
 *  3. Gleiche parallele Kabel teilen gleichmäßig.
 *  4. Ungleiche parallele Kabel teilen nach Leitwert (R = ρ·L/A).
 *  5. Fehlende Pfaddaten erfinden keine Präzision (UNKNOWN + Annahme).
 *  6. Dual-Rollen-Bauteile werden nicht doppelt gezählt.
 *  7. Batterie-Reihe.
 *  8. Batterie-Parallel.
 *  9. Batterie-Reihe-Parallel.
 * 16. Wiederholte Prüfung desselben Plans ist bit-identisch.
 */
import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';

import { computeCableCurrents, type CableCurrentModel } from './currentFlow';

type PlanNode = Node;
type PlanEdge = Edge;

const node = (id: string, type: string, data: Record<string, unknown> = {}): PlanNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  data: Record<string, unknown> = {}
): PlanEdge => ({ id, source, target, sourceHandle, targetHandle, data });

const modelOf = (nodes: PlanNode[], edges: PlanEdge[]): CableCurrentModel =>
  computeCableCurrents({ nodes, edges } as Parameters<typeof computeCableCurrents>[0]);

const currentOf = (model: CableCurrentModel, edgeId: string): number | null =>
  model.byEdgeId.get(edgeId)?.operatingCurrent ?? null;

const battery = (id: string, data: Record<string, unknown> = {}): PlanNode =>
  node(id, 'battery', { label: id, role: 'house', capacity: 100, chemistry: 'LiFePO4', ...data });

describe('Phase 12 (1/2) — Hauptstrang und Abzweig', () => {
  it('1 — der Hauptstrang trägt die Summe aller nachgelagerten Lasten', () => {
    const nodes: PlanNode[] = [
      battery('bat'),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('box', 'fuse', { label: 'Fuse Box', rating: 40 }),
      node('c1', 'consumer', { label: 'Last A', watts: 120 }), // 10 A
      node('c2', 'consumer', { label: 'Last B', watts: 60 }), // 5 A
    ];
    const edges: PlanEdge[] = [
      edge('e-bat-bar', 'bat', 'bar', 'plus', 'plus', { crossSection: 16, length: 1, edgeDomain: 'DC_12V' }),
      edge('e-bar-box', 'bar', 'box', 'plus', 'plus', { crossSection: 16, length: 1, edgeDomain: 'DC_12V' }),
      edge('e-box-c1', 'box', 'c1', 'plus', 'plus', { crossSection: 4, length: 3, edgeDomain: 'DC_12V' }),
      edge('e-box-c2', 'box', 'c2', 'plus', 'plus', { crossSection: 4, length: 3, edgeDomain: 'DC_12V' }),
    ];
    const model = modelOf(nodes, edges);
    expect(currentOf(model, 'e-bat-bar')).toBeCloseTo(15, 2);
    expect(currentOf(model, 'e-bar-box')).toBeCloseTo(15, 2);
  });

  it('2 — der Abzweig trägt nur seine eigene Last', () => {
    const nodes: PlanNode[] = [
      battery('bat'),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('box', 'fuse', { label: 'Fuse Box', rating: 40 }),
      node('c1', 'consumer', { label: 'Last A', watts: 120 }),
      node('c2', 'consumer', { label: 'Last B', watts: 60 }),
    ];
    const edges: PlanEdge[] = [
      edge('e-bat-bar', 'bat', 'bar', 'plus', 'plus', { crossSection: 16, length: 1, edgeDomain: 'DC_12V' }),
      edge('e-bar-box', 'bar', 'box', 'plus', 'plus', { crossSection: 16, length: 1, edgeDomain: 'DC_12V' }),
      edge('e-box-c1', 'box', 'c1', 'plus', 'plus', { crossSection: 4, length: 3, edgeDomain: 'DC_12V' }),
      edge('e-box-c2', 'box', 'c2', 'plus', 'plus', { crossSection: 4, length: 3, edgeDomain: 'DC_12V' }),
    ];
    const model = modelOf(nodes, edges);
    expect(currentOf(model, 'e-box-c1')).toBeCloseTo(10, 2);
    expect(currentOf(model, 'e-box-c2')).toBeCloseTo(5, 2);
    // Jede Kante erklärt ihre Beiträge selbst (Auftrag Phase 4).
    expect(model.byEdgeId.get('e-box-c1')?.contributingLoads.map((entry) => entry.componentId)).toEqual([
      'c1',
    ]);
    // Pfad in Flussrichtung (Quelle → Last); Batterien erscheinen als ihr
    // String-Knoten, weil die Reihen-/Parallelverschaltung dort kollabiert ist.
    expect(model.byEdgeId.get('e-box-c1')?.path).toEqual(['string:bat', 'bar', 'box', 'c1']);
    expect(model.byEdgeId.get('e-box-c1')?.flowDirection).toBe('forward');
  });
});

describe('Phase 12 (3/4/5) — Verteilung auf parallele Pfade', () => {
  /** Zwei parallel geführte Zuleitungen derselben Last, je Pfad eigene Kabellänge. */
  const parallelFixture = (lengthA: number | null, lengthB: number | null, sectionA = 4, sectionB = 4) => {
    const nodes: PlanNode[] = [
      battery('bat'),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('c1', 'consumer', { label: 'Last', watts: 480 }), // 40 A
    ];
    const dataOf = (length: number | null, section: number): Record<string, unknown> => ({
      edgeDomain: 'DC_12V',
      crossSection: section,
      ...(length === null ? {} : { length }),
    });
    const edges: PlanEdge[] = [
      edge('e-a', 'bat', 'bar', 'plus', 'plus', dataOf(lengthA, sectionA)),
      edge('e-b', 'bat', 'bar', 'plus', 'plus', dataOf(lengthB, sectionB)),
      edge('e-load', 'bar', 'c1', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 10, length: 1 }),
    ];
    return { nodes, edges, model: modelOf(nodes, edges) };
  };

  it('3 — gleiche parallele Kabel teilen gleichmäßig (nachweislich gleichwertig)', () => {
    const { model } = parallelFixture(2, 2);
    expect(model.byEdgeId.get('e-a')?.splitMethod).toBe('conductance-weighted');
    expect(currentOf(model, 'e-a')).toBeCloseTo(20, 6);
    expect(currentOf(model, 'e-b')).toBeCloseTo(20, 6);
    // Summe = Last, keine Doppelzählung.
    expect((currentOf(model, 'e-a') ?? 0) + (currentOf(model, 'e-b') ?? 0)).toBeCloseTo(40, 6);
  });

  it('4 — ungleiche parallele Kabel teilen nach Leitwert G = 1/R', () => {
    // R = ρ·L/A: Pfad A = 0,0175 · 1 / 4 = 4,375 mΩ; Pfad B = 0,0175 · 6 / 10 = 10,5 mΩ.
    // G_A = 228,57 · G_B = 95,24  ⇒ I_A = 40 · 228,57/323,81 = 28,235 A, I_B = 11,765 A.
    const { model } = parallelFixture(1, 6, 4, 10);
    expect(currentOf(model, 'e-a')).toBeCloseTo(28.24, 2);
    expect(currentOf(model, 'e-b')).toBeCloseTo(11.76, 2);
    expect(model.byEdgeId.get('e-a')?.splitMethod).toBe('conductance-weighted');
    expect(model.byEdgeId.get('e-a')?.splitConfidence).toBe('computed');
    // Der kürzere/dickere Pfad trägt mehr — die Richtung ist die Aussage.
    expect(currentOf(model, 'e-a')!).toBeGreaterThan(currentOf(model, 'e-b')!);
  });

  it('5 — fehlende Pfaddaten erfinden keine Präzision (UNKNOWN + dokumentierte Annahme)', () => {
    // Pfad A vermessen (2 m/4 mm²), Pfad B ohne Länge ⇒ keine Aufteilung
    // berechenbar. Konservativ trägt JEDER Pfad den vollen Strom; das ist
    // ausgewiesen und nicht als Präzision ausgegeben.
    const { model } = parallelFixture(2, null);
    expect(model.byEdgeId.get('e-a')?.splitMethod).toBe('full-per-path-unknown');
    expect(model.byEdgeId.get('e-a')?.splitConfidence).toBe('unknown');
    expect(currentOf(model, 'e-a')).toBeCloseTo(40, 6);
    expect(currentOf(model, 'e-b')).toBeCloseTo(40, 6);
    const assumptions = model.byEdgeId.get('e-a')?.assumptions.join(' ') ?? '';
    expect(assumptions).toContain('UNTERSCHIEDLICHER Datenlage');
    expect(assumptions).toContain('vollen Strom');
  });

  it('5b — ohne Messwerte, aber nachweislich gleichwertigen Pfaden: Equal-Split als Annahme', () => {
    const { model } = parallelFixture(null, null);
    expect(model.byEdgeId.get('e-a')?.splitMethod).toBe('equal-equivalent-paths');
    expect(model.byEdgeId.get('e-a')?.splitConfidence).toBe('assumed');
    expect(currentOf(model, 'e-a')).toBeCloseTo(20, 6);
  });
});

describe('Phase 12 (6) — Dual-Rolle ohne Doppelzählung', () => {
  it('6 — ein Durchgangs-Bauteil trägt je Seite seinen eigenen Strom (keine Vollstrom-Stempel)', () => {
    const nodes: PlanNode[] = [
      battery('starter', { label: 'Starterbatterie', role: 'starter', chemistry: 'AGM' }),
      node('booster', 'dcdcCharger', { label: 'Booster', amps: 30, efficiency: 0.9 }),
      battery('house', { label: 'Aufbaubatterie' }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('load', 'consumer', { label: 'Last', watts: 120 }), // 10 A
    ];
    const edges: PlanEdge[] = [
      edge('e-starter-booster', 'starter', 'booster', 'plus', 'plus', {
        edgeDomain: 'DC_12V',
        crossSection: 10,
        length: 2,
      }),
      edge('e-booster-house', 'booster', 'house', 'plus', 'plus', {
        edgeDomain: 'DC_12V',
        crossSection: 10,
        length: 2,
      }),
      edge('e-house-bar', 'house', 'bar', 'plus', 'plus', {
        edgeDomain: 'DC_12V',
        crossSection: 16,
        length: 1,
      }),
      edge('e-bar-load', 'bar', 'load', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 4, length: 3 }),
    ];
    const model = modelOf(nodes, edges);

    // Eingang: Ausgang / η = 30 / 0,9 = 33,33 A; Ausgang: 30 A; Lastzweig: 10 A.
    expect(currentOf(model, 'e-starter-booster')).toBeCloseTo(33.33, 1);
    expect(currentOf(model, 'e-booster-house')).toBeCloseTo(30, 1);

    // Keine Kante trägt die Summe aus beiden Rollen (33,33 + 30 = 63,3 A wäre
    // die Doppelzählung, 43,33 A die Summe mit der Last).
    for (const edgeId of ['e-starter-booster', 'e-booster-house']) {
      expect(currentOf(model, edgeId)!).toBeLessThan(35);
    }
    // Die topologische Begründung steht im Modell (Phase 3).
    expect(model.dualRoleTopology.get('booster')).toBe('series-pass-through');
    expect(model.notes.join(' ')).toContain('Doppelrolle');
  });

  it('6b — parallele Ausgänge eines Reihenwandlers teilen sich (kein voller Strom je Kabel)', () => {
    const nodes: PlanNode[] = [
      battery('starter', { label: 'Starterbatterie', role: 'starter', chemistry: 'AGM' }),
      node('booster', 'dcdcCharger', { label: 'Booster', amps: 30, efficiency: 1 }),
      battery('house1', { label: 'Bank 1' }),
      battery('house2', { label: 'Bank 2' }),
    ];
    const edges: PlanEdge[] = [
      edge('e-in', 'starter', 'booster', 'plus', 'plus', {
        edgeDomain: 'DC_12V',
        crossSection: 10,
        length: 2,
      }),
      edge('e-out1', 'booster', 'house1', 'plus', 'plus', {
        edgeDomain: 'DC_12V',
        crossSection: 10,
        length: 1,
      }),
      edge('e-out2', 'booster', 'house2', 'plus', 'plus', {
        edgeDomain: 'DC_12V',
        crossSection: 10,
        length: 1,
      }),
    ];
    const model = modelOf(nodes, edges);

    // Zwei gleiche Ausgangskabel: je 15 A statt pauschal 30 A auf jeder Kante.
    expect(currentOf(model, 'e-out1')).toBeCloseTo(15, 2);
    expect(currentOf(model, 'e-out2')).toBeCloseTo(15, 2);
    expect((currentOf(model, 'e-out1') ?? 0) + (currentOf(model, 'e-out2') ?? 0)).toBeCloseTo(30, 2);
    expect(currentOf(model, 'e-in')).toBeCloseTo(30, 2);
  });
});

describe('Phase 12 (7/8/9) — Batterieverschaltungen', () => {
  it('7 — Batterie-Reihe: der volle Stringstrom fließt durch jedes Reihenkabel', () => {
    const nodes: PlanNode[] = [
      battery('b1', { label: 'Batterie 1' }),
      battery('b2', { label: 'Batterie 2' }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('load', 'consumer', { label: 'Last', watts: 120 }), // 10 A
    ];
    const edges: PlanEdge[] = [
      edge('e-series', 'b1', 'b2', 'plus', 'minus', { edgeDomain: 'DC_12V', crossSection: 16, length: 0.3 }),
      edge('e-b2-bar', 'b2', 'bar', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 16, length: 1 }),
      edge('e-bar-load', 'bar', 'load', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 4, length: 3 }),
    ];
    const model = modelOf(nodes, edges);
    expect(currentOf(model, 'e-series')).toBeCloseTo(10, 2);
    expect(currentOf(model, 'e-b2-bar')).toBeCloseTo(10, 2);
    expect(model.byEdgeId.get('e-series')?.calculationMethod).toBe('string-internal');
  });

  it('8 — Batterie-Parallel: die Last teilt sich auf die Stränge, kein Strang trägt sie doppelt', () => {
    const nodes: PlanNode[] = [
      battery('b1', { label: 'Batterie 1' }),
      battery('b2', { label: 'Batterie 2' }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('load', 'consumer', { label: 'Last', watts: 240 }), // 20 A
    ];
    const edges: PlanEdge[] = [
      edge('e-b1-bar', 'b1', 'bar', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 10, length: 2 }),
      edge('e-b2-bar', 'b2', 'bar', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 10, length: 2 }),
      edge('e-bar-load', 'bar', 'load', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 4, length: 3 }),
    ];
    const model = modelOf(nodes, edges);
    expect(currentOf(model, 'e-b1-bar')).toBeCloseTo(10, 2);
    expect(currentOf(model, 'e-b2-bar')).toBeCloseTo(10, 2);
    expect(currentOf(model, 'e-bar-load')).toBeCloseTo(20, 2);
  });

  it('9 — Batterie-Reihe-Parallel: je String die halbe Last, intern der volle Stringstrom, nie doppelt', () => {
    // 2s2p: String A = b1 — b2, String B = b3 — b4; beide Strings an der Schiene.
    const nodes: PlanNode[] = [
      battery('b1', { label: 'Batterie 1' }),
      battery('b2', { label: 'Batterie 2' }),
      battery('b3', { label: 'Batterie 3' }),
      battery('b4', { label: 'Batterie 4' }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('load', 'consumer', { label: 'Last', watts: 240 }), // 20 A
    ];
    const data = { edgeDomain: 'DC_12V', crossSection: 10, length: 1 };
    const edges: PlanEdge[] = [
      edge('e-s1', 'b1', 'b2', 'plus', 'minus', data),
      edge('e-s2', 'b3', 'b4', 'plus', 'minus', data),
      edge('e-b2-bar', 'b2', 'bar', 'plus', 'plus', data),
      edge('e-b4-bar', 'b4', 'bar', 'plus', 'plus', data),
      edge('e-bar-load', 'bar', 'load', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 4, length: 3 }),
    ];
    const model = modelOf(nodes, edges);
    // Zwei parallele Strings: je 10 A. Intern je String: 10 A.
    expect(currentOf(model, 'e-b2-bar')).toBeCloseTo(10, 2);
    expect(currentOf(model, 'e-b4-bar')).toBeCloseTo(10, 2);
    expect(currentOf(model, 'e-s1')).toBeCloseTo(10, 2);
    expect(currentOf(model, 'e-s2')).toBeCloseTo(10, 2);
    // Gesamtstrom der Last bleibt 20 A — keine Verdopplung durch die Matrix.
    expect(currentOf(model, 'e-bar-load')).toBeCloseTo(20, 2);
    expect(
      (currentOf(model, 'e-b2-bar') ?? 0) + (currentOf(model, 'e-b4-bar') ?? 0),
      'Summe der Stringzuleitungen darf die Last nicht überschreiten'
    ).toBeCloseTo(20, 2);
  });
});

describe('Phase 12 (16) — Determinismus', () => {
  it('16 — derselbe Plan ergibt 50× dieselbe Projektion (inkl. Ursachen/Zuständen)', () => {
    const nodes: PlanNode[] = [
      battery('bat'),
      node('shunt', 'shunt', { label: 'Smart Shunt' }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('bar-', 'busbar', { label: 'Minus-Schiene' }),
      node('inv', 'inverter', { label: '1500-W-Inverter', continuousPower: 1500 }),
      node('ac', 'consumer230v', { label: '230-V-Last', watts: 1200 }),
      node('c1', 'consumer', { label: 'Kühlbox', watts: 60 }),
    ];
    const edges: PlanEdge[] = [
      edge('e-bat-bar', 'bat', 'bar', 'plus', 'plus', {
        edgeDomain: 'DC_12V',
        crossSection: 70,
        length: 0.2,
      }),
      edge('e-bat-shunt', 'bat', 'shunt', 'minus', 'minus', {
        edgeDomain: 'DC_12V',
        crossSection: 70,
        length: 0.2,
      }),
      edge('e-shunt-bar-', 'shunt', 'bar-', 'minus', 'minus', {
        edgeDomain: 'DC_12V',
        crossSection: 70,
        length: 0.5,
      }),
      edge('e-bar-inv', 'bar', 'inv', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 70, length: 1 }),
      edge('e-inv-ac', 'inv', 'ac', 'plus', 'plus', { edgeDomain: 'AC_230V', crossSection: 2.5, length: 2 }),
      edge('e-bar-c1', 'bar', 'c1', 'plus', 'plus', { edgeDomain: 'DC_12V', crossSection: 4, length: 2 }),
    ];
    const project = (model: CableCurrentModel): string =>
      JSON.stringify(
        [...model.byEdgeId.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, entry]) => [
            id,
            entry.operatingCurrent,
            entry.splitMethod,
            entry.splitConfidence,
            entry.path,
            entry.flowDirection,
            [...entry.assumptions].sort(),
          ])
      );
    const baseline = project(modelOf(nodes, edges));
    for (let run = 0; run < 50; run += 1) {
      const copyNodes = nodes.map((entry) => ({ ...entry, data: { ...entry.data } }));
      const copyEdges = edges.map((entry) => ({ ...entry, data: { ...entry.data } }));
      expect(project(modelOf(copyNodes, copyEdges)), `Lauf ${run}`).toBe(baseline);
    }
  });
});
