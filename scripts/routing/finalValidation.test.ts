import { describe, expect, it } from 'vitest';
import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { nodesToObstacles } from '../../components/edges/utils/pathfinding';
import {
  formatFinalValidation,
  totalViolations,
  validateFinalRouting,
  type FinalValidationCounts,
} from '../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../lib/routing/invariants';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

/**
 * CI-Gate der Final-Invariante (ADR 0015).
 *
 * ## Was hier passiert — und warum die Zahlen nicht 0 sind
 *
 * Die Spezifikation verlangt am Ende des Routings:
 *
 * ```text
 * edge × node overlap = 0
 * edge × edge overlap = 0
 * clearance violation = 0
 * ```
 *
 * Der heutige Router erfüllt das nicht. Die unten eingefrorenen Zahlen sind
 * der ehrlich gemessene Ist-Zustand, kein Zielwert. Sie stehen hier, damit
 * der Zustand SICHTBAR und nicht verhandelbar ist:
 *
 * - Sie dürfen **sinken** — jede Verbesserung ist willkommen, der Test
 *   fordert dann aktiv das Nachziehen der Baseline (kein stilles Aufweichen
 *   in die andere Richtung).
 * - Sie dürfen **niemals steigen**. Wer eine Leitung mehr durch ein Bauteil
 *   legt, bricht den Build.
 *
 * Ein Gate mit Schwelle 0 wäre ehrlicher, würde aber sofort jeden Build
 * blockieren und damit binnen Minuten abgeschaltet — ein abgeschaltetes Gate
 * schützt nichts. Der Weg auf 0 ist Router-Arbeit (ADR 0015, „Offen“).
 *
 * `validateFinalRouting()` selbst kennt diese Baseline NICHT. Sie meldet
 * kompromisslos `INVALID`, sobald eine Verletzung vorliegt. Die Toleranz
 * lebt ausschließlich hier, sichtbar und kommentiert.
 */

/** Gemessen am 2026-09-07 auf `GOLDEN_PLANS`. Obergrenze, kein Ziel. */
const BASELINE: Readonly<Record<string, FinalValidationCounts>> = {
  simple: { edgeNodeCollisions: 8, edgeEdgeOverlaps: 2, clearanceViolations: 0 },
  camper: { edgeNodeCollisions: 13, edgeEdgeOverlaps: 6, clearanceViolations: 9 },
  solar: { edgeNodeCollisions: 8, edgeEdgeOverlaps: 3, clearanceViolations: 0 },
  inverter: { edgeNodeCollisions: 7, edgeEdgeOverlaps: 2, clearanceViolations: 0 },
  acdc: { edgeNodeCollisions: 30, edgeEdgeOverlaps: 9, clearanceViolations: 1 },
  complex: { edgeNodeCollisions: 6, edgeEdgeOverlaps: 15, clearanceViolations: 3 },
};

type Wired = Parameters<typeof nodesToObstacles>[0];

function routePlan(planName: string) {
  const plan = GOLDEN_PLANS[planName]!;
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für Plan "${planName}"`);
  const nodes = wired.nodes as never as Wired;
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(nodes as never, edges);

  const routed: RoutedEdge[] = [];
  for (const edge of edges) {
    const result = routes.get(edge.id);
    if (result) {
      routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
    }
  }
  // Exakt die Boxen, die der Router selbst als Hindernisse behandelt —
  // sonst misst der Test eine andere Geometrie als die, die geroutet wurde.
  const rects: NodeRect[] = nodes.map((node, index) => {
    const [rect] = nodesToObstacles([node], new Set<string>());
    return { id: (node as { id?: string }).id ?? `n${index}`, ...rect! };
  });

  return validateFinalRouting(routed, rects);
}

describe('Final-Invariante — Ratchet über die Golden-Master-Pläne', () => {
  for (const planName of Object.keys(BASELINE)) {
    it(`${planName}: keine NEUEN Verletzungen gegenüber der Baseline`, () => {
      const report = routePlan(planName);
      const baseline = BASELINE[planName]!;

      // Verschlechterung bricht den Build — je Invariante einzeln, damit die
      // Fehlermeldung sagt, WELCHE Regel gerissen ist.
      expect(
        report.counts.edgeNodeCollisions,
        `I1 (Leitung durch fremdes Bauteil) verschlechtert: ${formatFinalValidation(report)}`
      ).toBeLessThanOrEqual(baseline.edgeNodeCollisions);
      expect(
        report.counts.edgeEdgeOverlaps,
        `I2 (kollineare Überdeckung) verschlechtert: ${formatFinalValidation(report)}`
      ).toBeLessThanOrEqual(baseline.edgeEdgeOverlaps);
      expect(
        report.counts.clearanceViolations,
        `I3 (Clearance unterschritten) verschlechtert: ${formatFinalValidation(report)}`
      ).toBeLessThanOrEqual(baseline.clearanceViolations);
    });
  }

  /**
   * Gegenrichtung: Wird der Router besser, MUSS die Baseline nachgezogen
   * werden. Ohne diesen Test würde eine Verbesserung stillschweigend wieder
   * Spielraum für Verschlechterung schaffen — die Ratsche würde durchrutschen.
   */
  it('Baseline ist nicht zu locker (Verbesserungen müssen nachgezogen werden)', () => {
    const stale: string[] = [];
    for (const planName of Object.keys(BASELINE)) {
      const report = routePlan(planName);
      const baseline = BASELINE[planName]!;
      if (
        report.counts.edgeNodeCollisions < baseline.edgeNodeCollisions ||
        report.counts.edgeEdgeOverlaps < baseline.edgeEdgeOverlaps ||
        report.counts.clearanceViolations < baseline.clearanceViolations
      ) {
        stale.push(`${planName}: ${formatFinalValidation(report)}`);
      }
    }
    expect(
      stale,
      `Router ist besser geworden — BASELINE in dieser Datei nachziehen:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });
});

describe('validateFinalRouting — die Regel selbst kennt keine Toleranz', () => {
  const nodeRect: NodeRect = { id: 'n', x: 100, y: 0, width: 100, height: 100 };

  it('sauberes Routing ⇒ VALID', () => {
    const edges: RoutedEdge[] = [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 300 },
          { x: 400, y: 300 },
        ],
      },
    ];
    const report = validateFinalRouting(edges, [nodeRect]);
    expect(report.status).toBe('VALID');
    expect(totalViolations(report.counts)).toBe(0);
  });

  it('EINE Kollision genügt für INVALID — kein Abwägen gegen den Rest', () => {
    const edges: RoutedEdge[] = [
      // 99 saubere Kanten weit weg vom Knoten …
      ...Array.from({ length: 99 }, (_, i) => ({
        id: `ok-${i}`,
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 1000 + i * 50 },
          { x: 400, y: 1000 + i * 50 },
        ],
      })),
      // … und eine, die mitten durch das Bauteil läuft.
      {
        id: 'bad',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 50 },
          { x: 400, y: 50 },
        ],
      },
    ];
    const report = validateFinalRouting(edges, [nodeRect]);
    expect(report.status).toBe('INVALID');
    expect(report.counts.edgeNodeCollisions).toBeGreaterThan(0);
    expect(report.violations.some((v) => v.edgeId === 'bad')).toBe(true);
  });

  it('meldet Overlap zweier Kanten als INVALID', () => {
    const edges: RoutedEdge[] = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 500 },
          { x: 400, y: 500 },
        ],
      },
      {
        id: 'e2',
        source: 'c',
        target: 'd',
        waypoints: [
          { x: 100, y: 500 },
          { x: 300, y: 500 },
        ],
      },
    ];
    const report = validateFinalRouting(edges, []);
    expect(report.status).toBe('INVALID');
    expect(report.counts.edgeEdgeOverlaps).toBe(1);
  });

  it('ist deterministisch — gleiche Eingabe, gleicher Report (ADR 0010)', () => {
    const edges: RoutedEdge[] = [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 50 },
          { x: 400, y: 50 },
        ],
      },
    ];
    expect(validateFinalRouting(edges, [nodeRect])).toEqual(validateFinalRouting(edges, [nodeRect]));
  });
});
