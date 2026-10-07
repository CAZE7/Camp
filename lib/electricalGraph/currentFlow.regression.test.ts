/**
 * lib/electricalGraph/currentFlow.regression.test.ts — Auftrag §15:
 * Regresstests A, B, H und I gegen das Topologie-Strommodell.
 *
 * (C/D = batteryBank.test.ts, E/F = verify/protection.test.ts RCD-001,
 * G = verify/physics.test.ts `calculateCorrectedIz` — dort bereits besetzt.)
 *
 * Die Szenarien sind die EXAKTEN Fälle aus dem Audit
 * (`docs/AUDIT-STROMBERECHNUNG-2026-10.md`, RC-1): die alte Endpunkt-Heuristik
 * (`calculateEdgeCurrent`) stampfte den Plan-Gesamtstrom (158,7 A) auf JEDEN
 * Nebenast und jede Rückleitung. Diese Datei friert das korrekte
 * Segment-Verhalten ein, damit es nicht stillschweigend zurückkommt.
 */
import { describe, expect, it } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { performAutoWiring } from '../autoWire';
import { computeCableCurrents, type CableCurrentModel } from './currentFlow';

type PlanNode = Node;
type PlanEdge = Edge;

const node = (id: string, type: string, data: Record<string, unknown>): PlanNode => ({
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
): PlanEdge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  data,
});

const modelOf = (nodes: PlanNode[], edges: PlanEdge[]): CableCurrentModel =>
  computeCableCurrents({ nodes, edges } as Parameters<typeof computeCableCurrents>[0]);

const labelOf = (nodes: PlanNode[], id: string): string => {
  const value = nodes.find((n) => n.id === id)?.data?.label;
  return typeof value === 'string' && value !== '' ? value : id;
};

const currentOf = (
  nodes: PlanNode[],
  edges: PlanEdge[],
  sourceLabel: string,
  targetLabel: string
): number => {
  const label = (id: string): string => labelOf(nodes, id);
  const found = edges.find((e) => label(e.source) === sourceLabel && label(e.target) === targetLabel);
  if (!found) throw new Error(`Kante ${sourceLabel} → ${targetLabel} nicht gefunden`);
  const entry = modelOf(nodes, edges).byEdgeId.get(found.id);
  if (entry?.operatingCurrent === null || entry?.operatingCurrent === undefined) {
    throw new Error(
      `Kante ${found.id}: Strom nicht bestimmt (${entry?.assumptions?.join('; ') ?? 'ohne Erklärung'})`
    );
  }
  return entry!.operatingCurrent as number;
};

/** Vollständig sortierte, JSON-serialisierbare Projektion des Modells. */
function modelJson(model: CableCurrentModel): string {
  const entries = [...model.byEdgeId.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([id, e]) =>
        [
          id,
          {
            operatingCurrent: e.operatingCurrent,
            calculationMethod: e.calculationMethod,
            voltage: e.voltage,
            direction: e.direction,
            contributors: e.contributingLoads
              .map((c) => [c.componentId, c.contribution, c.role])
              .sort((x, y) => (x[0] as string).localeCompare(y[0] as string)),
            upstream: [...(e.upstreamSources ?? [])].sort(),
            downstream: [...(e.downstreamLoads ?? [])].sort(),
            assumptions: [...(e.assumptions ?? [])].sort(),
          },
        ] as const
    );
  return JSON.stringify({
    edges: entries,
    notes: [...(model.notes ?? [])].sort(),
  });
}

describe('Auftrag §15 — Regresstests des Strommodells', () => {
  it('A — drei Lasten 10/20/5 A: Hauptstrang 35 A, jeder Zweig nur sein eigenes', () => {
    // 120 W / 240 W / 60 W bei 12 V = 10 / 20 / 5 A.
    const nodes: PlanNode[] = [
      node('bat', 'battery', { label: 'Batterie 200Ah', capacity: 200, chemistry: 'LiFePO4' }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('bar-', 'busbar', { label: 'Minus-Schiene' }),
      node('c1', 'consumer', { label: 'Last 10A', watts: 120 }),
      node('c2', 'consumer', { label: 'Last 20A', watts: 240 }),
      node('c3', 'consumer', { label: 'Last 5A', watts: 60 }),
    ];
    const edges: PlanEdge[] = [
      edge('e-bat-bar', 'bat', 'bar', 'plus', 'plus'),
      edge('e-bat-bar-', 'bat', 'bar-', 'minus', 'minus'),
      edge('e-bar-c1', 'bar', 'c1', 'plus', 'plus'),
      edge('e-c1-bar-', 'c1', 'bar-', 'minus', 'minus'),
      edge('e-bar-c2', 'bar', 'c2', 'plus', 'plus'),
      edge('e-c2-bar-', 'c2', 'bar-', 'minus', 'minus'),
      edge('e-bar-c3', 'bar', 'c3', 'plus', 'plus'),
      edge('e-c3-bar-', 'c3', 'bar-', 'minus', 'minus'),
    ];

    // Hauptstrang: Summe der Zweige (10 + 20 + 5 = 35 A), Plus und Minus.
    expect(currentOf(nodes, edges, 'Batterie 200Ah', 'Plus-Schiene')).toBeCloseTo(35, 2);
    expect(currentOf(nodes, edges, 'Batterie 200Ah', 'Minus-Schiene')).toBeCloseTo(35, 2);

    // Jeder Zweig trägt NUR seine eigene Last — nie den Gesamtstrom.
    expect(currentOf(nodes, edges, 'Plus-Schiene', 'Last 10A')).toBeCloseTo(10, 2);
    expect(currentOf(nodes, edges, 'Plus-Schiene', 'Last 20A')).toBeCloseTo(20, 2);
    expect(currentOf(nodes, edges, 'Plus-Schiene', 'Last 5A')).toBeCloseTo(5, 2);
    // Rückleitungen: gleiche Werte, keine Doppelzählung.
    expect(currentOf(nodes, edges, 'Last 10A', 'Minus-Schiene')).toBeCloseTo(10, 2);
    expect(currentOf(nodes, edges, 'Last 20A', 'Minus-Schiene')).toBeCloseTo(20, 2);
    expect(currentOf(nodes, edges, 'Last 5A', 'Minus-Schiene')).toBeCloseTo(5, 2);
  });

  it('B — parallele Batteriepfade: 10-A-Last wird NICHT doppelt gezählt', () => {
    // Erklärte Parallel-Bank (2 × 12 V): jede Batterie trägt den Equal-Split,
    // die Last wird insgesamt EINMAL gezählt — die alte Heuristik hätte
    // beide Pfade mit der vollen Last belegen können.
    const nodes: PlanNode[] = [
      node('bat1', 'battery', {
        label: 'Batterie 1',
        capacity: 100,
        chemistry: 'LiFePO4',
        bankId: 'bank-1',
        bankTopology: 'parallel',
      }),
      node('bat2', 'battery', {
        label: 'Batterie 2',
        capacity: 100,
        chemistry: 'LiFePO4',
        bankId: 'bank-1',
        bankTopology: 'parallel',
      }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('bar-', 'busbar', { label: 'Minus-Schiene' }),
      node('c1', 'consumer', { label: 'Last 10A', watts: 120 }),
    ];
    const edges: PlanEdge[] = [
      edge('e-bat1-bar', 'bat1', 'bar', 'plus', 'plus'),
      edge('e-bat1-bar-', 'bat1', 'bar-', 'minus', 'minus'),
      edge('e-bat2-bar', 'bat2', 'bar', 'plus', 'plus'),
      edge('e-bat2-bar-', 'bat2', 'bar-', 'minus', 'minus'),
      edge('e-bar-c1', 'bar', 'c1', 'plus', 'plus'),
      edge('e-c1-bar-', 'c1', 'bar-', 'minus', 'minus'),
    ];

    const i1 = currentOf(nodes, edges, 'Batterie 1', 'Plus-Schiene');
    const i2 = currentOf(nodes, edges, 'Batterie 2', 'Plus-Schiene');
    // Equal-Split zweier gleicher flexibler Quellen.
    expect(i1).toBeCloseTo(5, 2);
    expect(i2).toBeCloseTo(5, 2);
    // Summe der Parallelpfade = Last (10 A), NICHT 2 × 10 A.
    expect(i1 + i2).toBeCloseTo(10, 2);
    // Die Lastkante trägt die Last genau einmal.
    expect(currentOf(nodes, edges, 'Plus-Schiene', 'Last 10A')).toBeCloseTo(10, 2);
  });

  it('H — dasselbe Plan 100× ⇒ bit-identisches Modell (kein Zustand, keine Race)', () => {
    const planNodes: PlanNode[] = [
      node('bat', 'battery', { label: 'Batterie 200Ah', capacity: 200, chemistry: 'LiFePO4' }),
      node('shunt', 'shunt', { label: 'Smart Shunt' }),
      node('bar', 'busbar', { label: 'Plus-Schiene' }),
      node('bar-', 'busbar', { label: 'Minus-Schiene' }),
      node('inv', 'inverter', { label: '1000W Inverter', watts: 1000, continuousPower: 1000 }),
      node('c230', 'consumer230v', { label: '230V Steckdose', watts: 600 }),
      node('c1', 'consumer', { label: 'LED-Beleuchtung', watts: 20 }),
      node('mppt', 'mpptController', { label: 'MPPT', amps: 30 }),
      node('solar', 'solar', { label: 'Solar 400W', watts: 400 }),
    ];
    const planEdges: PlanEdge[] = [
      edge('e-bat-shunt', 'bat', 'shunt', 'minus', 'minus'),
      edge('e-shunt-bar-', 'shunt', 'bar-', 'minus', 'minus'),
      edge('e-bat-bar', 'bat', 'bar', 'plus', 'plus'),
      edge('e-bar-inv', 'bar', 'inv', 'plus', 'plus'),
      edge('e-bar-inv-', 'bar-', 'inv', 'minus', 'minus'),
      edge('e-inv-c230', 'inv', 'c230', 'out', 'in', { edgeDomain: 'AC_230V' }),
      edge('e-bar-c1', 'bar', 'c1', 'plus', 'plus'),
      edge('e-c1-bar-', 'c1', 'bar-', 'minus', 'minus'),
      edge('e-solar-mppt', 'solar', 'mppt', 'plus', 'plus', { edgeDomain: 'Solar' }),
      edge('e-mppt-bar', 'mppt', 'bar', 'out', 'plus'),
    ];
    const baseline = modelJson(modelOf(planNodes, planEdges));
    for (let run = 0; run < 100; run += 1) {
      // Frische Kopien: kein Referenz-Cache, keine verbleibende
      // Iterationsreihenfolge — das Modell muss rein sein.
      const copyNodes = planNodes.map((n) => ({
        ...n,
        position: { ...n.position },
        data: { ...(n.data as object) },
      }));
      const copyEdges = planEdges.map((e) => ({ ...e, data: { ...(e.data as object) } }));
      expect(modelJson(modelOf(copyNodes, copyEdges)), `Run ${run} weicht vom Basismodell ab`).toBe(baseline);
    }
  });

  it('I — Gold-Regression des 158,7-A-Falls: Hauptstrang trägt den Topologie-Strom, Nebenäste nicht', () => {
    // Der Originalbefund: „Kabel 200Ah Lithium → Smart Shunt: Ib = 158.7 A“ —
    // die Endpunkt-Heuristik hatte den Plan-Gesamtstrom auf jede Kante ohne
    // Endpunkt-Regel gestempelt. Dieser Plan (= Golden-Master-Plan
    // `inverter`) wird durch AutoWire geführt; der Strom pro Segment wird
    // eingefroren: Hauptstrang = Inverter-Eingang + DC-Last, LED-Zweig =
    // LED-Last, Inverter-Kabel = Inverter-Eingang.
    const nodes: PlanNode[] = [
      node('battery-1', 'battery', { label: '200Ah Lithium', capacity: 200, chemistry: 'LiFePO4' }),
      node('inverter-1', 'inverter', { label: '1000W Inverter', watts: 1000, continuousPower: 1000 }),
      node('cons-230v', 'consumer230v', { label: '230V Steckdose', watts: 600 }),
      node('cons-light', 'consumer', { label: 'LED-Beleuchtung', watts: 20 }),
    ];
    const wired = performAutoWiring(
      nodes as Parameters<typeof performAutoWiring>[0],
      [] as Parameters<typeof performAutoWiring>[1]
    );
    if (!wired) throw new Error('performAutoWiring lieferte null');
    const wNodes = wired.nodes as PlanNode[];
    const wEdges = wired.edges as PlanEdge[];
    const model = modelOf(wNodes, wEdges);

    const label = (id: string): string => labelOf(wNodes, id);
    const byPair = (src: string, tgt: string): number => {
      const e = wEdges.find((x) => label(x.source) === src && label(x.target) === tgt);
      if (!e) throw new Error(`Kante ${src} → ${tgt} fehlt`);
      const entry = model.byEdgeId.get(e.id);
      if (entry?.operatingCurrent === null || entry?.operatingCurrent === undefined) {
        throw new Error(`Kante ${e.id} nicht bestimmt`);
      }
      return entry!.operatingCurrent as number;
    };

    // 1000 W / 12 V / 0,85 = 98,04 A Inverter-Eingang; LED 20 W / 12 V = 1,67 A.
    const inverterIn = 1000 / 12 / 0.85; // 98,04 A
    const ledA = 20 / 12; // 1,67 A
    const mainA = inverterIn + ledA; // 99,71 A

    // Hauptstrang: Batterie → Shunt → Minus-Schiene (Discharge-Richtung).
    expect(byPair('200Ah Lithium', 'Smart Shunt')).toBeCloseTo(mainA, 1);
    expect(byPair('Smart Shunt', 'Minus-Schiene')).toBeCloseTo(mainA, 1);
    expect(byPair('200Ah Lithium', 'Plus-Schiene')).toBeCloseTo(mainA, 1);

    // Nebenäste tragen NUR ihre eigene Last — nie den Hauptstrang (RC-1-Fix).
    // Die LED hängt hinter dem Sicherungskasten: Schiene→Kasten und
    // Kasten→LED tragen je die LED-Last, nicht den Hauptstrang.
    expect(byPair('Plus-Schiene', '12V Sicherungskasten')).toBeCloseTo(ledA, 2);
    expect(byPair('12V Sicherungskasten', 'LED-Beleuchtung')).toBeCloseTo(ledA, 2);
    expect(byPair('Minus-Schiene', 'LED-Beleuchtung')).toBeCloseTo(ledA, 2);
    expect(byPair('Plus-Schiene', '1000W Inverter')).toBeCloseTo(inverterIn, 1);

    // Zweiter Originalbefund: „Kabel Minus Busbar → Sicherungskasten:
    // Ib = 158.7 A“ — die belastungslose Rückleitung hinter dem Kasten
    // trägt 0 A (die LED-Rückleitung läuft direkt über die Minus-Schiene).
    expect(byPair('Minus-Schiene', '12V Sicherungskasten')).toBe(0);

    // Der historische Befund ist ausgeschlossen: KEINE Kante, die nicht der
    // Batterie-Hauptstrang (Batterie→Shunt, Batterie→Plus-Schiene,
    // Shunt→Minus-Schiene) ist, trägt den Hauptstrang-Strom. Das
    // Inverter-Kabel trägt (fast) denselben Wert und wird mitgeduldet;
    // alle übrigen Kanten (LED-Zweig, Rückleitung ohne Last, AC) müssen
    // deutlich darunter liegen.
    const isMainOrInverter = (e: PlanEdge): boolean => {
      const s = label(e.source);
      const t = label(e.target);
      return (
        s === '200Ah Lithium' ||
        s === 'Smart Shunt' ||
        s === '1000W Inverter' ||
        t === 'Smart Shunt' ||
        t === '1000W Inverter'
      );
    };
    for (const e of wEdges) {
      if (isMainOrInverter(e)) continue;
      const entry = model.byEdgeId.get(e.id);
      if (!entry || entry.operatingCurrent === null) continue;
      expect(
        entry.operatingCurrent,
        `Kante ${e.id} (${label(e.source)} → ${label(e.target)}) trägt Hauptstrang-Strom (RC-1-Regression)`
      ).toBeLessThan(mainA - 1);
    }
  });
});
