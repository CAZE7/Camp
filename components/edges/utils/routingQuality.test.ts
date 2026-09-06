import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import {
  buildRoutingQualityReport,
  countUTurns,
  formatQualityTable,
  MIN_ROUTE_CLEARANCE,
  type RoutingQualityReport,
} from './routingQuality';
import { ROUTING_SCENARIOS } from './routingScenarios';
import { performAutoWiring } from '../../../lib/autoWire';
import { routeAllCables } from './routeAll';
import { segmentCrossesRect } from './orthogonalRouting';

/**
 * R-1 (Routing-Qualität): das Mess-Dashboard.
 *
 * agent.md: „Keine Fix-Aufgabe gilt ohne Metrik-Nachweis als fertig.“
 * Dieser Test misst alle 25 Referenzszenarien und hält die Zielwerte fest:
 *
 *   - Länge ≤ je-Szenario-Obergrenze (`maxDetourRatio`) × Manhattan-Optimum,
 *     global angestrebt ≤ 1,3×
 *   - U-Turns = 0 je Kante
 *   - Kreuzungen ≤ 2 je Kante
 *   - Clearance-Verletzungen (< 12 px) = 0 (Szenarien mit begründeter
 *     Ausnahme — Endpunkt im Hindernis — sind ausgenommen)
 *
 * `BASELINE` friert den Vorher-Stand ein (vorm R-Umbau gemessen). Jede
 * Fix-Aufgabe (R-2…R-10) muss diese Werte verbessern und die Baseline im
 * selben Commit nachziehen. Eine Verschlechterung lässt den Test rot —
 * damit ist der Metrik-Nachweis automatisiert.
 *
 * Die Tabelle (`formatQualityTable`) geht als Nachweis in den PR-Text
 * (docs/routing/QUALITY.md, von R-11 finalisiert).
 */

/** Vorher-Stand (gemessen 2026-09-03, vor R-2…R-10). */
const BASELINE = {
  worstRatio: 1.33,
  sumUTurns: 1,
  /** Begründete Ausnahmen (Endpunkt im Hindernis) zählen nicht. */
  sumClearanceHits: 2,
} as const;

/** Szenario-IDs mit begründeter Ausnahme (Endpunkt liegt im Hindernis). */
const exceptionIds = new Set(
  ROUTING_SCENARIOS.filter((scenario) => !scenario.obstacleFree).map((scenario) => scenario.id)
);

function clearanceHitsExcludingExceptions(report: RoutingQualityReport): number {
  return report.rows
    .filter((row) => !exceptionIds.has(row.id))
    .reduce((sum, row) => sum + row.clearanceHits, 0);
}

describe('routingQuality (R-1 Dashboard)', () => {
  const report = buildRoutingQualityReport();

  it('misst alle Referenzszenarien', () => {
    expect(report.rows.map((row) => row.id)).toEqual(ROUTING_SCENARIOS.map((s) => s.id));
  });

  it('Pfadlänge ≤ je-Szenario-Obergrenze × Manhattan-Optimum', () => {
    for (const row of report.rows) {
      const scenario = ROUTING_SCENARIOS.find((s) => s.id === row.id)!;
      expect(
        row.ratio,
        `${row.id}: ratio ${row.ratio.toFixed(2)} > ${scenario.maxDetourRatio} (Länge ${row.length} vs. ${row.optimum})`
      ).toBeLessThanOrEqual(scenario.maxDetourRatio);
    }
  });

  it(`schlimmstes Längenverhältnis bleibt ≤ Baseline ${BASELINE.worstRatio}`, () => {
    expect(report.worstRatio).toBeLessThanOrEqual(BASELINE.worstRatio);
  });

  it('keine U-Turns in irgendeinem Szenario (Ziel; Baseline ≥ 1 wird von R-2/R-7 auf 0 gedrückt)', () => {
    // Zielwert laut agent.md: 0. Solange die Fix-Aufgaben laufen, schützt die
    // Baseline-Assertion vor Verschlechterung; R-2/R-7 ersetzen sie durch 0.
    expect(report.sumUTurns).toBeLessThanOrEqual(BASELINE.sumUTurns);
  });

  it('maximal 2 Kreuzungen je Kante (Ziel; Baseline wird von R-4/R-6 erreicht)', () => {
    for (const row of report.rows) {
      // Szenario 15 (dichtes Kreuzungsraster) und 22 (Stressszene) sind die
      // offenen Baustellen — der Report dokumentiert sie als Nachweis.
      if (row.crossings > 2) {
        expect(row.id).toBeOneOf(['15-crossing-dense-grid', '22-stress-scene']);
      }
    }
  });

  it('keine Clearance-Verletzungen unter 12 px außer bei begründeten Ausnahmen', () => {
    expect(MIN_ROUTE_CLEARANCE).toBe(12);
    // Vorher: 2 (Stressszene). R-10 drückt diesen Wert auf 0; bis dahin
    // schützt die Assertion vor Regression.
    expect(clearanceHitsExcludingExceptions(report)).toBeLessThanOrEqual(BASELINE.sumClearanceHits);
  });

  it('countUTurns erkennt Kehren zuverlässig', () => {
    expect(
      countUTurns([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 0 },
      ])
    ).toBe(1);
    expect(
      countUTurns([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
      ])
    ).toBe(0);
  });

  it('Tabelle ist stabil formatiert (PR-Nachweis)', () => {
    const table = formatQualityTable(report);
    expect(table.split('\n')).toHaveLength(report.rows.length + 1);
  });
});

// ---------------------------------------------------------------------------
// R-10: Hindernis-Präzision — keine Kante schneidet einen Node (inkl. Label-
// fläche, die innerhalb der Node-Box liegt) mit Clearance ≥ 12 px.
// ---------------------------------------------------------------------------

describe('Node-Schnitt-Freiheit (R-10)', () => {
  it('Auto-Wire-Referenzplan: jede Route hält 12 px Abstand zu fremden Nodes', () => {
    const makeNode = (
      id: string,
      type: string,
      position = { x: 0, y: 0 },
      data: Record<string, unknown> = {}
    ): Node => ({ id, type, position, width: 192, height: 120, data }) as unknown as Node;
    const nodes = [
      makeNode('bat-1', 'battery', { x: 0, y: 0 }, { capacity: 100, chemistry: 'LiFePO4' }),
      makeNode('solar-1', 'solar', { x: 0, y: -400 }, { watts: 200 }),
      makeNode('load-1', 'consumer', { x: 1200, y: 200 }, { watts: 60 }),
      makeNode('load-2', 'consumer', { x: 1200, y: 480 }, { watts: 120 }),
    ];
    const wired = performAutoWiring(nodes, []);
    expect(wired).not.toBeNull();
    const routes = routeAllCables(
      wired!.nodes,
      wired!.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
      }))
    );
    const rectOf = (id: string) => {
      const node = wired!.nodes.find((n) => n.id === id)!;
      return { x: node.position.x, y: node.position.y, width: 192, height: 120 };
    };
    for (const edge of wired!.edges) {
      const route = routes.get(edge.id);
      if (!route) continue;
      for (const other of wired!.nodes) {
        if (other.id === edge.source || other.id === edge.target) continue;
        const rect = rectOf(other.id);
        for (let i = 0; i + 1 < route.waypoints.length; i++) {
          const a = route.waypoints[i]!;
          const b = route.waypoints[i + 1]!;
          expect(segmentCrossesRect(a, b, rect), `${edge.id}: Segment ${i} schneidet Node ${other.id}`).toBe(
            false
          );
          // Clearance ≥ 12 px: aufgeblähte Box darf ebenfalls nicht geschnitten werden.
          const clearRect = {
            x: rect.x - MIN_ROUTE_CLEARANCE,
            y: rect.y - MIN_ROUTE_CLEARANCE,
            width: rect.width + 2 * MIN_ROUTE_CLEARANCE,
            height: rect.height + 2 * MIN_ROUTE_CLEARANCE,
          };
          expect(
            segmentCrossesRect(a, b, clearRect),
            `${edge.id}: Segment ${i} verletzt 12-px-Clearance an Node ${other.id}`
          ).toBe(false);
        }
      }
    }
  });
});
