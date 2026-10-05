/**
 * scripts/regression/invariantProbe.ts
 *
 * ROUTE-010 — Messwerkzeug: I1/I2/I3 je Regressions-Szenario.
 *
 * Die Regression-Suite (`regression.test.ts`) vergleicht Clearance- und
 * Überdeckungsmetriken nur mit „≤ Baseline“. Damit kann sie grün sein, obwohl
 * ein Szenario echte I2-/I3-Verstöße enthält. Dieses Werkzeug misst die
 * absoluten Invarianten — es ist die Grundlage für das harte Gate
 * „I1 = I2 = I3 = 0 in JEDEM Szenario“.
 *
 *   npx tsx scripts/regression/invariantProbe.ts              Übersicht
 *   npx tsx scripts/regression/invariantProbe.ts --detail     mit Einzelfällen
 *   npx tsx scripts/regression/invariantProbe.ts --json       maschinenlesbar
 *   npx tsx scripts/regression/invariantProbe.ts --plan p02-batterie-10-verbraucher
 *
 * Reine Messung: keine Seiteneffekte, kein Zufall, kein DOM (ADR 0010).
 */
import { REGRESSION_SCENARIOS } from './scenarios';
import { routeScenario, scenarioNodeRects } from './layout';
import {
  checkClearance,
  checkEdgeEdgeOverlaps,
  checkEdgeNodeCollisions,
  type RoutedEdge,
} from '../../lib/routing/invariants';

export type ScenarioInvariants = {
  id: string;
  title: string;
  i1: number;
  i2: number;
  i3: number;
  details: string[];
};

export function measureScenarioInvariants(
  edges: readonly RoutedEdge[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: readonly any[]
): { i1: number; i2: number; i3: number; details: string[] } {
  const i1 = checkEdgeNodeCollisions(edges, nodes);
  const i2 = checkEdgeEdgeOverlaps(edges);
  const i3 = checkClearance(edges, nodes);
  const details = [
    ...i1.map((v) => `I1 ${v.edgeId}${v.otherId ? ' × ' + v.otherId : ''}: ${v.detail}`),
    ...i2.map((v) => `I2 ${v.edgeId}${v.otherId ? ' × ' + v.otherId : ''}: ${v.detail}`),
    ...i3.map((v) => `I3 ${v.edgeId}${v.otherId ? ' × ' + v.otherId : ''}: ${v.detail}`),
  ];
  return { i1: i1.length, i2: i2.length, i3: i3.length, details };
}

export function probeAllScenarios(filter?: string): ScenarioInvariants[] {
  return REGRESSION_SCENARIOS.filter((s) => !filter || s.id === filter).map((scenario) => {
    const routed = routeScenario(scenario);
    const measured = measureScenarioInvariants(routed, scenarioNodeRects(scenario.nodes));
    return {
      id: scenario.id,
      title: scenario.title,
      i1: measured.i1,
      i2: measured.i2,
      i3: measured.i3,
      details: measured.details,
    };
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const detail = args.includes('--detail') || args.includes('--json');
  const json = args.includes('--json');
  const planIdx = args.indexOf('--plan');
  const filter = planIdx >= 0 ? args[planIdx + 1] : undefined;
  const rows = probeAllScenarios(filter);

  if (json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  } else {
    process.stdout.write('Szenario                              I1   I2   I3\n');
    for (const r of rows) {
      process.stdout.write(
        `${r.id.padEnd(36)} ${String(r.i1).padStart(3)} ${String(r.i2).padStart(4)} ${String(r.i3).padStart(4)}\n`
      );
      if (detail) for (const d of r.details) process.stdout.write(`    - ${d}\n`);
    }
    const sum = rows.reduce((a, r) => ({ i1: a.i1 + r.i1, i2: a.i2 + r.i2, i3: a.i3 + r.i3 }), {
      i1: 0,
      i2: 0,
      i3: 0,
    });
    process.stdout.write(
      `${'SUMME'.padEnd(36)} ${String(sum.i1).padStart(3)} ${String(sum.i2).padStart(4)} ${String(sum.i3).padStart(4)}\n`
    );
  }
  process.exitCode = rows.some((r) => r.i1 || r.i2 || r.i3) ? 1 : 0;
}

if (require.main === module) main();
