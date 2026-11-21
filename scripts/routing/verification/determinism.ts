/**
 * scripts/routing/verification/determinism.ts — V4.4: Determinismus im FRISCHEN Prozess.
 *
 * Warum ein zweiter Prozess
 * =========================
 * Ein Doppellauf im selben Prozess beweist wenig: derselbe Modulzustand, derselbe
 * Cache, dieselbe Sortierreihenfolge. Die teuren Determinismusfehler entstehen
 * woanders — bei Map/Set-Iterationsreihenfolgen, die von der Einfügereihenfolge
 * abhängen, bei Modul-Level-Zählern, bei Memoisierung über Pläne hinweg.
 *
 * Deshalb startet dieses Skript sich selbst **zweimal neu** und vergleicht nur
 * die Ausgabe. Ist sie gleich, war der Prozesszustand irrelevant.
 *
 *   npm run test:determinism:process            drei Referenzpläne, je 2 Prozesse
 *   npm run test:determinism:process -- --json
 *
 * Zusätzlich wird die **Reihenfolgeinvarianz** geprüft: derselbe Plan mit
 * umgedrehter Knoten- und Kantenreihenfolge muss dasselbe Ergebnis liefern.
 * Das ist die Eigenschaft, die in der Oberfläche ständig verletzt würde, wenn
 * jemand `Object.keys` über eine Map laufen lässt.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { performAutoWiring } from '../../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../../components/edges/utils/nodeGeometry';
import { GOLDEN_PLANS } from '../../goldenmaster/plans';

const SELF = fileURLToPath(import.meta.url);
const QUANT = 1000;
const q = (value: number): number => Math.round(value * QUANT) / QUANT;

const PLANS = ['simple', 'camper', 'complex'] as const;

/** Kanonische Serialisierung: sortiert nach Kanten-ID, quantisiert. */
export function serializeRoutes(nodes: readonly unknown[], edges: readonly unknown[]): string {
  const wired = performAutoWiring(nodes as never, edges as never);
  if (!wired) return 'AUTOWIRE-FEHLER';
  const routes = routeAllCables(
    wired.nodes as never as RoutableNode[],
    wired.edges as never as RouteEdgeRef[]
  );
  const ids = [...routes.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  const lines: string[] = [];
  for (const id of ids) {
    const result = routes.get(id);
    if (!result) continue;
    const waypoints = result.waypoints.map((point) => `${q(point.x)},${q(point.y)}`).join(' ');
    lines.push(`${id}|${result.usedSearch}|${waypoints}`);
  }
  return lines.join('\n');
}

const hashOf = (text: string): string =>
  `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 16)}`;

function emit(planName: string, reverse: boolean): void {
  const plan = (GOLDEN_PLANS as Record<string, { nodes: unknown[]; edges: unknown[] } | undefined>)[planName];
  if (!plan) {
    console.error(`Unbekannter Plan: ${planName}`);
    process.exitCode = 2;
    return;
  }
  const nodes = reverse ? [...plan.nodes].reverse() : plan.nodes;
  const edges = reverse ? [...plan.edges].reverse() : plan.edges;
  console.log(hashOf(serializeRoutes(nodes, edges)));
}

function runFresh(planName: string): string {
  return execFileSync('npx', ['--no-install', 'tsx', SELF, '--emit', planName], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, ROUTING_QUIET: '1' },
  })
    .trim()
    .split('\n')
    .pop() as string;
}

function main(argv: readonly string[]): number {
  if (argv.includes('--emit')) {
    const index = argv.indexOf('--emit');
    const planName = argv[index + 1] ?? '';
    emit(planName, argv.includes('--reverse'));
    return 0;
  }

  const json = argv.includes('--json');
  const results: { plan: string; first: string; second: string; reordered: string; ok: boolean }[] = [];

  for (const planName of PLANS) {
    const plan = (GOLDEN_PLANS as Record<string, { nodes: unknown[]; edges: unknown[] } | undefined>)[
      planName
    ];
    if (!plan) continue;
    const first = runFresh(planName);
    const second = runFresh(planName);
    // Reihenfolgeinvarianz im selben Prozess, umgedrehte Eingabereihenfolge.
    const forward = hashOf(serializeRoutes(plan.nodes, plan.edges));
    const reversed = hashOf(serializeRoutes([...plan.nodes].reverse(), [...plan.edges].reverse()));
    results.push({
      plan: planName,
      first,
      second,
      reordered: reversed === forward ? 'ok' : 'ABWEICHUNG',
      ok: first === second && reversed === forward,
    });
  }

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('Plan    | Prozess 1         | Prozess 2         | Reihenfolge | Urteil');
    console.log('--------|-------------------|-------------------|-------------|-------');
    for (const entry of results) {
      console.log(
        `${entry.plan.padEnd(7)} | ${entry.first.padEnd(17)} | ${entry.second.padEnd(17)} | ${entry.reordered.padEnd(11)} | ${
          entry.ok ? 'ok' : 'FEHLER'
        }`
      );
    }
  }

  return results.every((entry) => entry.ok) ? 0 : 1;
}

if (process.argv[1]?.includes('determinism')) {
  process.exitCode = main(process.argv.slice(2));
}
