import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Node } from '@xyflow/react';
import { REGRESSION_SCENARIOS } from './scenarios';
import {
  buildScenarioLayout,
  measureScenario,
  routeScenario,
  scenarioNodeRects,
  type GoldenLayoutFile,
} from './layout';
import { renderScenarioSvg } from './svg';
import {
  checkClearance,
  checkEdgeEdgeOverlaps,
  checkEdgeNodeCollisions,
  serializeRoutes,
} from '../../lib/routing/invariants';
import { layoutWithElk } from '../../lib/routing/elk/runner';
import { toElkPlan } from '../../lib/routing/elk/ab-compare';
import type { RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { compareIds } from '../../lib/sortOrder';
import { routeDefectScore } from '../../components/edges/utils/pathfinding';

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

/**
 * P0-HARTES GATE — I1 = I2 = I3 = 0 in JEDEM Szenario.
 *
 * Dies ist das Gate, das eine Ratchet NICHT ersetzen kann: „Delta ≤ 0"
 * (Gate 2) belegt nur, dass nichts schlechter wurde. Es sagt nichts darüber,
 * ob ein Szenario überhaupt regelkonform ist — ein Plan mit drei Verstößen
 * bleibt drei Verstöße lang grün, solange er sich nicht verschlechtert.
 * Genau deshalb steht dieses Gate daneben: Es verlangt die ABSOLUTE Null.
 *
 * Geprüft werden dieselben drei Invarianten, die auch `finalValidation.ts`
 * fährt (I1 Bauteil-Durchdringung, I2 kollineare Trassenüberdeckung,
 * I3 Kabel-Freigabe) — hier über die Szenarien der Regressions-Suite.
 */
/**
 * ROUTE-010 / p11 (`p11-zwangskreuzung`) ist seit 2026-10-06 REPARIERT und
 * läuft im harten Gate mit — der frühere `it.fails`-Platzhalter ist damit
 * eingelöst (Befund und Ursache: `docs/ai/KNOWN-PROBLEMS.md`, ROUTE-010;
 * verworfene Experimente: ADR 0035).
 *
 * Der reparierte Fall ist eine ZWANGSKREUZUNG: Zwei Kanten zwischen
 * denselben vier Bauteilen müssen sich queren (Jordan-Kurve). Die Lösung
 * quert genau einmal — erlaubt (I10, mit Hop gerendert, `COST_WEIGHTS.crossing`)
 * und ohne Überdeckung/Freigabe-Verletzung.
 */

describe('P0 — I1 = I2 = I3 = 0 in jedem Szenario (hart, nicht als Ratchet)', () => {
  for (const scenario of REGRESSION_SCENARIOS) {
    it(`${scenario.id}: keine Bauteil-Durchdringung, keine Überdeckung, keine Freigabe-Verletzung`, () => {
      const routed = routeScenario(scenario);
      const nodes = scenarioNodeRects(scenario.nodes);
      const edges = routed.map((item) => ({
        id: item.id,
        source: item.source ?? '',
        target: item.target ?? '',
        waypoints: item.waypoints,
      }));
      // I1 — Kanten dürfen kein Bauteil schneiden.
      const i1 = checkEdgeNodeCollisions(edges, nodes);
      expect(
        i1.map((v) => `${v.edgeId}: ${v.otherId ?? ''} ${v.detail}`),
        'I1 Bauteil-Durchdringungen'
      ).toEqual([]);
      // I2 — zwei Kanten dürfen nicht kollinear aufeinander liegen.
      const i2 = checkEdgeEdgeOverlaps(edges);
      expect(
        i2.map((v) => `${v.edgeId}: ${v.otherId ?? ''} ${v.detail}`),
        'I2 Trassenüberdeckungen'
      ).toEqual([]);
      // I3 — zwei Kanten müssen die Kabel-Freigabe einhalten.
      const i3 = checkClearance(edges, nodes);
      expect(
        i3.map((v) => `${v.edgeId}: ${v.otherId ?? ''} ${v.detail}`),
        'I3 Freigabe-Verstöße'
      ).toEqual([]);
    });
  }
});

describe('Metrik-Budget — Delta gegen Baseline ≤ 0', () => {
  const golden = loadGolden();

  for (const scenario of REGRESSION_SCENARIOS) {
    it(`${scenario.id}: Kreuzungen/Bends/Länge/I2 ≤ Baseline, Clearance-Verstöße = 0`, () => {
      const baseline = golden.scenarios.find((s) => s.id === scenario.id)!.metrics;
      const routed = routeScenario(scenario);
      const metrics = measureScenario(routed, scenarioNodeRects(scenario.nodes));
      expect(metrics.crossings, 'Kreuzungen').toBeLessThanOrEqual(baseline.crossings);
      expect(metrics.bends, 'Bends').toBeLessThanOrEqual(baseline.bends);
      expect(metrics.length, 'Trassenlänge').toBeLessThanOrEqual(baseline.length);
      // AUDIT ROUTE-011/012: Clearance-Verstöße (I3) sind jetzt sichtbar
      // (Segment×Segment-Prüfung). Die Verletzungen waren immer da, das
      // Gate hat sie nur nicht gesehen. Ratchet: sie dürfen nicht steigen.
      expect(metrics.clearanceViolations, 'Clearance-Verstöße').toBeLessThanOrEqual(
        baseline.clearanceViolations
      );
      // Kollineare Trassenüberdeckungen waren in dieser Suite unsichtbar —
      // jetzt als Ratchet geführt, damit sie es nicht wieder werden.
      expect(metrics.edgeOverlaps, 'I2-Überdeckungen').toBeLessThanOrEqual(baseline.edgeOverlaps);
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
      JSON.stringify([...r.routes.entries()].sort(([a], [b]) => compareIds(a, b)));
    expect(snapshot(elkSecond)).toBe(snapshot(elkFirst));
  });

  it('15b Pass-Wechsel: auch der A*-Pass ist nach einem ELK-Lauf unverändert', async () => {
    const scenario = scenarioById.get('p15-pass-wechsel')!;
    const before = serializeRoutes(routeScenario(scenario));
    await layoutWithElk(toElkPlan(scenario.nodes as Node[], scenario.edges as RouteEdgeRef[]));
    expect(serializeRoutes(routeScenario(scenario))).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// ADR 0032 (2026-10-03) — Leiter-Frühstopp und Tube-Reparatur.
// Der Frühstopp „if (bestFound) break" sperrte die rangniedrigeren Versuche
// auch dann, wenn der gefundene Kandidat INTERN defekt war (I4-Portkehren,
// Selbstüberdeckung). Gemessen: p04 (e-b) und p13 (e-bus-c) endeten mit
// Defekt-Score 80; die Reparatur beseitigte in p02 eine harte Überdeckung
// gegen eine verlegte Trasse bei neutraler Kantenlänge (728 → 728 px).
// Diese Tests sichern den Effekt direkt: Die finalen Routen sind intern
// mangelfrei — ein Revert des Frühstopp-Fixes lässt sie rot werden.
// ---------------------------------------------------------------------------
describe('ADR 0032 — defekte Versuchs-Gewinner werden ersetzt (Frühstopp-Fix)', () => {
  const cases = [
    { id: 'p02-batterie-10-verbraucher', note: 'Tube-Reparatur: harte Überdeckung beseitigt' },
    { id: 'p04-parallele-verbraucher', note: 'I4-Portkehre der Kante e-b ersetzt (penalty 80 → 0)' },
    { id: 'p13-drag-zentraler-node', note: 'I4-Portkehre der Kante e-bus-c ersetzt (penalty 80 → 0)' },
  ];
  for (const { id, note } of cases) {
    it(`${id}: finale Routen sind intern mangelfrei (Σ Defekt-Score = 0) — ${note}`, () => {
      const scenario = REGRESSION_SCENARIOS.find((s) => s.id === id)!;
      const routed = routeScenario(scenario);
      expect(routed.length).toBeGreaterThan(0);
      for (const edge of routed) {
        expect(
          routeDefectScore(edge.waypoints),
          `${edge.id}: interne Mängel (Kehren/Selbstüberdeckung/Kurzsegment)`
        ).toBe(0);
      }
    });
  }
});
