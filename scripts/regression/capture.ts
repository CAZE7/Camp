import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGRESSION_SCENARIOS } from './scenarios';
import { buildScenarioLayout, type GoldenLayoutFile } from './layout';
import { renderScenarioSvg } from './svg';

/**
 * WP-11 (#400): Golden Layouts der 15 Regressions-Szenarien einfrieren.
 *
 *   npx tsx scripts/regression/capture.ts
 *
 * Schreibt `scripts/regression/goldenLayouts.json` — Wegpunkte UND
 * Metriken (Kreuzungen, Bends, Länge, Clearance-Verstöße) je Szenario —
 * sowie ein deterministisches SVG je Szenario nach
 * `docs/routing-regression/` (visuelle Referenz, byte-genau verglichen).
 * `regression.test.ts` vergleicht Wegpunkt für Wegpunkt und hält die
 * Metrik-Budgets als „Delta ≤ 0" gegen diese Baseline fest.
 *
 * Ein Refresh ist NUR legitim zusammen mit einer PR-Begründung und, bei
 * Architektur-Relevanz, einem Eintrag in docs/ARCHITECTURE-CHANGES.md —
 * dieselbe Konvention wie beim Golden Master (WP-0b).
 */

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), 'goldenLayouts.json');
const SVG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'routing-regression');

function main(): void {
  const file: GoldenLayoutFile = {
    capturedAt: '2026-09-06',
    note: 'Golden Layouts WP-11 (#400) — Abweichung = CI-Fail. Refresh: npx tsx scripts/regression/capture.ts + PR-Begründung.',
    scenarios: REGRESSION_SCENARIOS.map((scenario) => buildScenarioLayout(scenario)),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  mkdirSync(SVG_DIR, { recursive: true });
  for (const scenario of REGRESSION_SCENARIOS) {
    const layout = file.scenarios.find((s) => s.id === scenario.id)!;
    writeFileSync(join(SVG_DIR, `${scenario.id}.svg`), renderScenarioSvg(scenario, layout), 'utf8');
  }
  for (const s of file.scenarios) {
    console.log(
      `${s.id.padEnd(28)} Kanten=${String(s.edges.length).padStart(2)}  X=${s.metrics.crossings}  Bends=${s.metrics.bends}  L=${s.metrics.length.toFixed(0)}  Clearance=${s.metrics.clearanceViolations}`
    );
  }
  console.log(`\n→ ${join('scripts', 'regression', 'goldenLayouts.json')} geschrieben.`);
}

main();
