import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { ElkLayoutEngine } from './elk';
import { LAYOUT_TOKENS } from './tokens';
import { getLayoutRank, LAYOUT_DEFAULT_RANK, LAYOUT_RANK_COUNT } from './ranks';
import { layoutWithElk, setElkInstanceForTest } from '../../routing/elk/runner';
import type { ElkGraph } from '../../routing/elk/graph';
import { portsForNode } from './ports';
import { getNodeLayoutRank } from '../../../components/planner/utils/layout';

/**
 * ADR 0024 / Finding 2026-09-27 (P1 „Rollen-Schichten"):
 *
 * Die fachliche Reihenfolge Quelle → Wandler → Verteilung → Wechselrichter →
 * Verbraucher war bis dahin nur die Sortierhilfe des „Aufräumens" und
 * erreichte ELK nie. Jetzt ist sie der x-Seed der Ranked-Optionen
 * (`layering.strategy: INTERACTIVE`); gemessen über die sechs Referenzpläne
 * sinken die Kreuzungen des Produktivpfads von 42 auf 34 (Σ).
 */
describe('Rollen-Ränge (ADR 0024)', () => {
  it('ordnet die Bauteiltypen den fünf Rollen zu', () => {
    for (const kind of ['solar', 'roofSolar', 'shorePower', 'freshWaterTank']) {
      expect(getLayoutRank(kind), kind).toBe(0);
    }
    for (const kind of ['mpptController', 'dcdcCharger', 'acBatteryCharger', 'pump']) {
      expect(getLayoutRank(kind), kind).toBe(1);
    }
    for (const kind of ['battery', 'shunt', 'busbar', 'fuse', 'conduit']) {
      expect(getLayoutRank(kind), kind).toBe(2);
    }
    expect(getLayoutRank('inverter')).toBe(3);
    for (const kind of ['consumer', 'consumer230v', 'ground']) {
      expect(getLayoutRank(kind), kind).toBe(4);
    }
    expect(getLayoutRank(undefined)).toBe(LAYOUT_DEFAULT_RANK);
    expect(getLayoutRank('unbekannt')).toBe(LAYOUT_DEFAULT_RANK);
    expect(LAYOUT_RANK_COUNT).toBe(5);
  });

  it('ist dieselbe Tabelle wie im Aufräumen (eine Wahrheit)', () => {
    for (const kind of ['solar', 'mpptController', 'busbar', 'inverter', 'consumer230v']) {
      expect(getNodeLayoutRank({ type: kind } as Node)).toBe(getLayoutRank(kind));
    }
  });
});

describe('ElkLayoutEngine — Rollen-Schichten als Nebenbedingung', () => {
  const plan = {
    nodes: [
      { id: 'solar', kind: 'solar', width: 192, height: 120 },
      { id: 'battery', kind: 'battery', width: 192, height: 120 },
      { id: 'inv', kind: 'inverter', width: 192, height: 120 },
      { id: 'load', kind: 'consumer230v', width: 192, height: 120 },
    ],
    edges: [
      { id: 'e1', source: 'solar', target: 'battery', kind: 'cable' as const },
      { id: 'e2', source: 'battery', target: 'inv', kind: 'cable' as const },
      { id: 'e3', source: 'inv', target: 'load', kind: 'cable' as const },
    ],
  };

  it('seedet x mit dem Rang und nutzt die gerankten ELK-Optionen', async () => {
    const captured: ElkGraph[] = [];
    setElkInstanceForTest({
      layout: (graph: ElkGraph) => {
        captured.push(graph);
        return Promise.resolve(graph);
      },
    });
    try {
      await new ElkLayoutEngine().layout(plan);
    } finally {
      setElkInstanceForTest(null);
    }

    const graph = captured[0]!;
    expect(graph.layoutOptions['elk.layered.layering.strategy']).toBe('INTERACTIVE');
    expect(graph.layoutOptions['elk.layered.considerModelOrder.strategy']).toBe('PREFER_EDGES');
    // Gemessen (Finding 2026-09-27): semiInteractive hebt die
    // Kreuzungsminimierung auf (Σ 36 → 44) — im Rollen-Modus bleibt es aus.
    expect(graph.layoutOptions['elk.layered.crossingMinimization.semiInteractive']).toBeUndefined();
    expect(graph.layoutOptions['elk.layered.cycleBreaking.strategy']).toBeUndefined();

    const xById = new Map(graph.children.map((child) => [child.id, child.x ?? 0]));
    expect(xById.get('solar')).toBe(0);
    expect(xById.get('battery')).toBe(2 * LAYOUT_TOKENS.rankSpacing);
    expect(xById.get('inv')).toBe(3 * LAYOUT_TOKENS.rankSpacing);
    expect(xById.get('load')).toBe(4 * LAYOUT_TOKENS.rankSpacing);
  });

  it('echtes ELK hält die Rollenfolge ein (Quelle vor Speicher vor Verbraucher)', async () => {
    const plan = {
      nodes: [
        { id: 'solar', kind: 'solar', width: 192, height: 120 },
        { id: 'battery', kind: 'battery', width: 192, height: 120 },
        { id: 'inv', kind: 'inverter', width: 192, height: 120 },
        { id: 'load', kind: 'consumer230v', width: 192, height: 120 },
      ],
      edges: [
        { id: 'e1', source: 'solar', target: 'battery' },
        { id: 'e2', source: 'battery', target: 'inv' },
        { id: 'e3', source: 'inv', target: 'load' },
      ],
      direction: 'LR' as const,
    };

    const result = await layoutWithElk({
      ranked: true,
      direction: 'LR',
      nodes: plan.nodes.map((node) => ({
        id: node.id,
        x: getLayoutRank(node.kind) * LAYOUT_TOKENS.rankSpacing,
        y: 0,
        width: node.width,
        height: node.height,
        ...(portsForNode(node.id, node.kind).length > 0
          ? { ports: [...portsForNode(node.id, node.kind)] }
          : {}),
      })),
      edges: plan.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
    });

    const x = (id: string) => result.nodes.get(id)?.x ?? Number.NaN;
    expect(x('solar')).toBeLessThan(x('battery'));
    expect(x('battery')).toBeLessThan(x('inv'));
    expect(x('inv')).toBeLessThan(x('load'));
  }, 30_000);
});
