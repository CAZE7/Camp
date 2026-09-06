import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Node } from 'reactflow';
import { REGRESSION_SCENARIOS } from './scenarios';
import {
  buildScenarioLayout,
  measureScenario,
  routeScenario,
  scenarioNodeRects,
  type GoldenLayoutFile,
} from './layout';
import { renderScenarioSvg } from './svg';
import { serializeRoutes } from '../../lib/routing/invariants';
import { layoutWithElk } from '../../lib/routing/elk/runner';
import { toElkPlan } from '../../lib/routing/elk/ab-compare';
import type { RouteEdgeRef } from '../../components/edges/utils/routeAll';

/**
 * WP-11 (#400): Golden-Layout-Regression über die 15 Szenarien.
 *
 * Drei Gates, alle CI-blockierend:
 *
 *  1. GOLDEN LAYOUT — Wegpunkt für Wegpunkt gegen die eingecheckte
 *     Referenz (`goldenLayouts.json`). Nicht „kein Crash", sondern „für
 *     diesen Input exakt diese Trassenstruktur". Refresh nur über
 *     `npx tsx scripts/regression/capture.ts` + PR-Begründung.
 *  2. METRIK-BUDGET — Delta gegen Baseline ≤ 0 für Kreuzungen und Bends,
 *     Länge ≤ Baseline (kein schleichender Qualitätsverlust); Clearance-
 *     Verstöße sind absolut 0.
 *  3. VISUELL — die eingecheckten SVGs (docs/routing-regression/) werden
 *     neu gerendert und byte-genau verglichen. Deterministisch ⇒ keine
 *     flaky Tests; die Playwright-Pixel-Baselines (tests/e2e/visual.spec.ts)
 *     sichern zusätzlich die gebaute Planer-Route im echten Browser.
 *  4. VERHALTEN — die dynamischen Szenarien 13–15: Drag-und-Zurück,
 *     Undo/Redo und der Pass-Wechsel ELK → A* → ELK liefern byte-
 *     identische Ergebnisse (Routing ist zustandslos, ADR 0010).
 */

const GOLDEN_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'goldenLayouts.json');

function loadGolden(): GoldenLayoutFile {
  expect(
    existsSync(GOLDEN_FILE),
    'scripts/regression/goldenLayouts.json fehlt — npx tsx scripts/regression/capture.ts'
  ).toBe(true);
  return JSON.parse(readFileSync(GOLDEN_FILE, 'utf8')) as GoldenLayoutFile;
}

describe('Fixture-Vollständigkeit', () => {
  it('alle 15 Szenarien aus #400 sind vorhanden und eindeutig', () => {
    expect(REGRESSION_SCENARIOS).toHaveLength(15);
    const ids = REGRESSION_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(15);
    const golden = loadGolden();
    expect(golden.scenarios.map((s) => s.id)).toEqual(ids);
  });
});

describe('Golden Layouts — exakte Trassenstruktur (Abweichung = CI-Fail)', () => {
  const golden = loadGolden();

  for (const scenario of REGRESSION_SCENARIOS) {
    it(`${scenario.id} — ${scenario.title}`, () => {
      const reference = golden.scenarios.find((s) => s.id === scenario.id);
      expect(reference, `${scenario.id} fehlt in goldenLayouts.json`).toBeTruthy();
      const actual = buildScenarioLayout(scenario);
      expect(actual.edges, `${scenario.id}: Trassenstruktur weicht von der Referenz ab`).toEqual(
        reference!.edges
      );
    });
  }
});

describe('Metrik-Budget — Delta gegen Baseline ≤ 0', () => {
  const golden = loadGolden();

  for (const scenario of REGRESSION_SCENARIOS) {
    it(`${scenario.id}: Kreuzungen/Bends/Länge ≤ Baseline, Clearance-Verstöße = 0`, () => {
      const baseline = golden.scenarios.find((s) => s.id === scenario.id)!.metrics;
      const routed = routeScenario(scenario);
      const metrics = measureScenario(routed, scenarioNodeRects(scenario.nodes));
      expect(metrics.crossings, 'Kreuzungen').toBeLessThanOrEqual(baseline.crossings);
      expect(metrics.bends, 'Bends').toBeLessThanOrEqual(baseline.bends);
      expect(metrics.length, 'Trassenlänge').toBeLessThanOrEqual(baseline.length);
      expect(metrics.clearanceViolations, 'Clearance-Verstöße').toBe(0);
    });
  }
});

describe('Visuelle Regression — SVGs byte-genau (deterministisch, nicht flaky)', () => {
  const SVG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'routing-regression');

  for (const scenario of REGRESSION_SCENARIOS) {
    it(`${scenario.id}: docs/routing-regression/${scenario.id}.svg ist aktuell`, () => {
      const file = resolve(SVG_DIR, `${scenario.id}.svg`);
      expect(existsSync(file), `${scenario.id}.svg fehlt — npx tsx scripts/regression/capture.ts`).toBe(true);
      const expected = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      const actual = renderScenarioSvg(scenario, buildScenarioLayout(scenario));
      expect(actual, `${scenario.id}: SVG weicht von der eingecheckten Referenz ab`).toBe(expected);
    });
  }
});

describe('Verhalten — dynamische Szenarien 13–15', () => {
  const scenarioById = new Map(REGRESSION_SCENARIOS.map((s) => [s.id, s]));

  it('13 Drag: Verschieben und Zurückschieben liefert byte-identische Trassen', () => {
    const base = scenarioById.get('p03-busbar-fanout')!;
    const dragged = scenarioById.get('p13-drag-zentraler-node')!;
    const before = serializeRoutes(routeScenario(base));

    // Drag: bus 480 → 640 (das ist p13) …
    const draggedRoutes = serializeRoutes(routeScenario(dragged));
    expect(draggedRoutes).not.toBe(before);

    // … und zurück: identische Nodes wie p03 ⇒ identische Trassen.
    const restored = {
      ...dragged,
      nodes: dragged.nodes.map((n) =>
        n.id === 'bus' ? ({ ...n, position: { x: 400, y: 480 } } as Node) : n
      ),
    };
    expect(serializeRoutes(routeScenario(restored))).toBe(before);
  });

  it('14 Undo/Redo: Kante hinzufügen und wieder entfernen ⇒ byte-identisch', () => {
    const base = scenarioById.get('p14-undo-redo')!;
    const before = serializeRoutes(routeScenario(base));

    const extraEdge: RouteEdgeRef = {
      id: 'e-temp',
      source: 'batt',
      target: 'cons-b',
      sourceHandle: 'minus',
      targetHandle: 'minus',
    };
    const mutated = { ...base, edges: [...base.edges, extraEdge] };
    const during = serializeRoutes(routeScenario(mutated).filter((e) => e.id !== 'e-temp'));
    void during; // Lane-Verschiebungen während der Mutation sind erlaubt …

    // … aber nach dem Undo zählt nur: exakt der Ausgangszustand.
    const undone = { ...base, edges: [...base.edges] };
    expect(serializeRoutes(routeScenario(undone))).toBe(before);
  });

  it('15 Pass-Wechsel: ELK → A* → ELK — der ELK-Pass ist idempotent', async () => {
    const scenario = scenarioById.get('p15-pass-wechsel')!;
    const plan = toElkPlan(scenario.nodes as Node[], scenario.edges as RouteEdgeRef[]);

    const elkFirst = await layoutWithElk(plan);
    // Zwischendurch der A*-Pass (Bestandsrouter) …
    const aStar = serializeRoutes(routeScenario(scenario));
    expect(aStar.length).toBeGreaterThan(0);
    // … dann wieder ELK: byte-identisch zum ersten Lauf (kein versteckter Zustand).
    const elkSecond = await layoutWithElk(plan);

    const snapshot = (r: typeof elkFirst) =>
      JSON.stringify([...r.routes.entries()].sort(([a], [b]) => a.localeCompare(b)));
    expect(snapshot(elkSecond)).toBe(snapshot(elkFirst));
  });

  it('15b Pass-Wechsel: auch der A*-Pass ist nach einem ELK-Lauf unverändert', async () => {
    const scenario = scenarioById.get('p15-pass-wechsel')!;
    const before = serializeRoutes(routeScenario(scenario));
    await layoutWithElk(toElkPlan(scenario.nodes as Node[], scenario.edges as RouteEdgeRef[]));
    expect(serializeRoutes(routeScenario(scenario))).toBe(before);
  });
});
