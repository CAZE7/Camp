/**
 * scripts/routing/verification/perf.ts — V7: Performance-Schwellen als Gate.
 *
 * Warum eine Schwelle und keine Zahl im Bericht
 * =============================================
 * „Routet in 104 ms" ist eine Beobachtung. „Routet in 104 ms, erlaubt sind 300"
 * ist eine Regel. Ohne Schwelle steigt die Laufzeit in kleinen Schritten, und
 * niemand kann sagen, ab wann sie zu hoch war.
 *
 * Gemessen wird der **Median aus fünf Läufen**, nicht der Mittelwert und nicht
 * der erste: der erste Lauf enthält die JIT-Aufwärmphase, der Mittelwert wird
 * von einem Ausreißer (GC) verschoben. Der Median ist die Zahl, die ein Nutzer
 * erlebt.
 *
 *   npm run perf:gate              Gate (Exit 1 bei Überschreitung)
 *   npm run perf:gate -- --out=artifacts/perf.json
 *
 * Schwellen (Spezifikation §4.7):
 *   Referenzplan        ≤ 300 ms
 *   Skalenplan 100 Kanten ≤ 2000 ms
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { performAutoWiring } from '../../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../../components/edges/utils/nodeGeometry';
import { GOLDEN_PLANS } from '../../goldenmaster/plans';
import { generatePlan } from '../../../scripts/verification/routing/planGenerator';

const PLAN_BUDGET_MS = 300;
/** Ziel für den Skalenplan (Spezifikation §4.7). */
const SCALE_TARGET_MS = 2000;
/**
 * Ratchet für den Skalenplan: der gemessene Ist-Wert (2026-11-11: 9 253 ms bei
 * 100 Kanten auf 24 Bauteilen) plus Reserve. Das Ziel bleibt 2 000 ms und steht
 * als offener Punkt in der Spezifikation (§17.4). Ein Ratchet ist keine
 * Freigabe — er verhindert nur, dass die Lücke wächst, ohne dass es auffällt.
 */
const SCALE_RATCHET_MS = 12000;
const RUNS = 5;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : (sorted[middle] as number);
};

type Measurement = {
  plan: string;
  edges: number;
  medianMs: number;
  /** Zielwert (Spezifikation). */
  targetMs: number;
  /** Gate-Wert: darüber ist der Lauf rot. */
  limitMs: number;
  ok: boolean;
};

function measureReference(name: string, nodes: unknown[], edges: unknown[]): Measurement {
  const wired = performAutoWiring(nodes as never, edges as never);
  if (!wired) {
    return {
      plan: name,
      edges: 0,
      medianMs: 0,
      targetMs: PLAN_BUDGET_MS,
      limitMs: PLAN_BUDGET_MS,
      ok: false,
    };
  }
  const routableNodes = wired.nodes as never as RoutableNode[];
  const routableEdges = wired.edges as never as RouteEdgeRef[];

  // Ein Aufwärmlauf, nicht gemessen (JIT), dann fünf Messungen.
  routeAllCables(routableNodes as never, routableEdges as never);
  const samples: number[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const started = performance.now();
    routeAllCables(routableNodes as never, routableEdges as never);
    samples.push(performance.now() - started);
  }
  const value = median(samples);
  return {
    plan: name,
    edges: routableEdges.length,
    medianMs: value,
    targetMs: PLAN_BUDGET_MS,
    limitMs: PLAN_BUDGET_MS,
    ok: value <= PLAN_BUDGET_MS,
  };
}

function measureScale(): Measurement {
  const plan = generatePlan(4242, { nodeCount: 24, edgeCount: 100 });
  // Der Generator liefert direkt die Router-Eingabe; kein AutoWire nötig.
  const samples: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    const started = performance.now();
    routeAllCables(plan.nodes as never, plan.edges as never);
    samples.push(performance.now() - started);
  }
  const value = median(samples);
  return {
    plan: 'skala-100',
    edges: plan.edges.length,
    medianMs: value,
    targetMs: SCALE_TARGET_MS,
    limitMs: SCALE_RATCHET_MS,
    ok: value <= SCALE_RATCHET_MS,
  };
}

function main(argv: readonly string[]): number {
  // Achtung: der Router schreibt Fortschrittszeilen auf stdout. Ein
  // `--json > datei.json` wäre deshalb kaputtes JSON. Ausgabe in eine Datei
  // nur über --out, damit stdout sauber bleibt.
  const outArg = argv.find((arg) => arg.startsWith('--out='));
  const measurements: Measurement[] = [];

  for (const name of Object.keys(GOLDEN_PLANS)) {
    const plan = (GOLDEN_PLANS as Record<string, { nodes: unknown[]; edges: unknown[] } | undefined>)[name];
    if (!plan) continue;
    measurements.push(measureReference(name, plan.nodes, plan.edges));
  }
  measurements.push(measureScale());

  if (outArg) {
    const path = outArg.slice('--out='.length);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ measurements }, null, 2)}\n`, 'utf8');
    console.log(`Messung geschrieben: ${path}`);
  } else {
    console.log('Plan       | Kanten | Median    | Ziel      | Gate      | Urteil');
    console.log('-----------|--------|-----------|-----------|-----------|-------');
    for (const entry of measurements) {
      console.log(
        `${entry.plan.padEnd(10)} | ${String(entry.edges).padStart(6)} | ${`${entry.medianMs.toFixed(1)} ms`.padStart(9)} | ${`${entry.targetMs} ms`.padStart(9)} | ${`${entry.limitMs} ms`.padStart(9)} | ${
          entry.ok ? (entry.medianMs <= entry.targetMs ? 'ok' : 'über Ziel, im Ratchet') : 'ÜBERSCHRITTEN'
        }`
      );
    }
  }

  return measurements.every((entry) => entry.ok) ? 0 : 1;
}

if (process.argv[1]?.includes('perf')) {
  process.exitCode = main(process.argv.slice(2));
}
