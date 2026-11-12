/**
 * scripts/routing/verification/replay.ts — Fehlerakten abspielen.
 *
 *   npm run test:replay                     alle Akten
 *   npm run test:replay -- --json           maschinenlesbar
 *   npm run test:replay -- --fix-hashes     Hashes neu schreiben (bewusste Änderung)
 *   npm run test:replay -- --only ROUTE-REG-00001
 *
 * Exit-Code 1, sobald eine Akte nicht mehr reproduziert (`fixed`), die Eingabe
 * sich geändert hat (`input-drift`) oder die Akte formal ungültig ist.
 *
 * Warum ein `fixed` den Exit-Code setzt
 * =====================================
 * Eine Regression, die stillschweigend grün wird, ist gefährlicher als eine,
 * die rot wird: die Sammlung verrottet, ohne dass es jemand merkt. Wer den
 * Fehler wirklich behoben hat, schließt die Akte (Status im PR) — das ist eine
 * bewusste Handlung, kein Nebeneffekt.
 *
 * Die Akten selbst sind Fixtures: `test/regression/routing/ROUTE-REG-#####.json`.
 * Außerhalb dieser Datei liegt keine Logik.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { performAutoWiring } from '../../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../../components/edges/utils/nodeGeometry';
import { nodesToObstacles } from '../../../components/edges/utils/pathfinding';
import { GOLDEN_PLANS } from '../../goldenmaster/plans';
import { adaptPlan } from '../../routing-core/adapt';
import { routeCore } from '../../../lib/routing-core';
import { checkInvariants, type NodeRect, type RoutedEdge } from '../../../lib/routing/invariants';
import {
  judgeRecord,
  validateRecord,
  type FailureRecord,
  type ReplayOutcome,
} from '../../../lib/routing/verification/failureRecord';
import { minimizePlan, type MinimizePlan } from './minimize';

const RECORD_DIR = join(process.cwd(), 'test', 'regression', 'routing');

type PlanRunner = {
  routed: RoutedEdge[];
  rects: NodeRect[];
  unroutable: { id: string; reason: string }[];
  nodeIds: string[];
};

const QUANT = 1000;
const q = (value: number): number => Math.round(value * QUANT) / QUANT;

/** Kanonische Eingabe für den Hash: sortiert, quantisiert, ohne undefined. */
export function canonicalInput(nodes: readonly unknown[], edges: readonly unknown[]): string {
  const sortById = (items: readonly unknown[]): unknown[] =>
    [...items].sort((a, b) =>
      String((a as { id?: string }).id ?? '').localeCompare(String((b as { id?: string }).id ?? ''), 'en')
    );
  const clean = (value: unknown): unknown => {
    if (typeof value === 'number') return q(value);
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        const entry = (value as Record<string, unknown>)[key];
        if (entry === undefined) continue;
        out[key] = clean(entry);
      }
      return out;
    }
    return value;
  };
  return JSON.stringify({ nodes: sortById(nodes).map(clean), edges: sortById(edges).map(clean) });
}

export function inputHashOf(nodes: readonly unknown[], edges: readonly unknown[]): string {
  return `sha256:${createHash('sha256').update(canonicalInput(nodes, edges)).digest('hex')}`;
}

function planOf(record: FailureRecord): { nodes: unknown[]; edges: unknown[] } {
  if (record.plan.kind === 'reference') {
    const plan = (GOLDEN_PLANS as Record<string, { nodes: unknown[]; edges: unknown[] } | undefined>)[
      record.plan.name
    ];
    if (!plan) throw new Error(`Unbekannter Referenzplan "${record.plan.name}" in ${record.failureId}`);
    return plan;
  }
  return { nodes: record.plan.nodes, edges: record.plan.edges };
}

function rectsOf(nodes: readonly RoutableNode[]): NodeRect[] {
  return nodes.map((node, index) => {
    const [rect] = nodesToObstacles([node], new Set<string>());
    return { id: (node as { id?: string }).id ?? `n${index}`, ...(rect as Omit<NodeRect, 'id'>) };
  });
}

/**
 * Der Plan, den der Router tatsächlich sieht.
 *
 * `reference` ist ein **Eingabeplan**: AutoWire läuft, ergänzt Bauteile und
 * Kanten, dann routet der Motor. `inline` ist ein **verdrahteter Plan**: die
 * Minimierung hat ihn erzeugt, er enthält genau die Kanten, die der Router
 * bekommt. Diese Unterscheidung ist nötig, weil eine Minimierung auf der
 * Eingabeebene nichts zu entfernen hätte — die AutoWire-Kanten entstehen erst
 * im Lauf (gemessen: 0 Kanten in `knownPlans/*.json`).
 */
function wiredPlanOf(record: FailureRecord): { nodes: unknown[]; edges: unknown[] } {
  const plan = planOf(record);
  if (record.plan.kind === 'inline') return plan;
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für ${record.failureId}`);
  return { nodes: wired.nodes as unknown[], edges: wired.edges as unknown[] };
}

/** Führt den in der Akte genannten Motor auf dem in der Akte genannten Plan aus. */
export function runEngine(record: FailureRecord): PlanRunner {
  const plan = wiredPlanOf(record);
  const nodes = plan.nodes as never as RoutableNode[];
  const edges = plan.edges as never as RouteEdgeRef[];

  if (record.engine === 'legacy') {
    const routes = routeAllCables(nodes as never, edges);
    const routed: RoutedEdge[] = [];
    const unroutable: { id: string; reason: string }[] = [];
    for (const edge of edges) {
      const result = routes.get(edge.id);
      if (!result) {
        unroutable.push({ id: edge.id, reason: 'keine Route vom Produktivpfad geliefert' });
        continue;
      }
      routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
    }
    return {
      routed,
      rects: rectsOf(nodes),
      unroutable,
      nodeIds: nodes.map((node) => String((node as { id?: string }).id ?? '')),
    };
  }

  const adapted = adaptPlan(nodes, edges);
  if (!adapted.ok) throw new Error(`Adapterfehler für ${record.failureId}: ${adapted.missing.join(', ')}`);
  const input = adapted.input;
  const result = routeCore(input);
  const endpoints = new Map(
    input.edges.map((edge) => [edge.id, { source: edge.source, target: edge.target }])
  );
  const routed: RoutedEdge[] = [];
  for (const route of result.routes.values()) {
    const ends = endpoints.get(route.id);
    if (!ends) continue;
    routed.push({ id: route.id, source: ends.source, target: ends.target, waypoints: [...route.waypoints] });
  }
  const rects: NodeRect[] = input.nodes.map((node) => ({
    id: node.id,
    x: node.rect.x,
    y: node.rect.y,
    width: node.rect.width,
    height: node.rect.height,
  }));
  return {
    routed,
    rects,
    unroutable: result.unroutable.map((entry) => ({ id: entry.id, reason: entry.reason })),
    nodeIds: input.nodes.map((node) => node.id),
  };
}

/** Ein Blocker ist „benannt“, wenn die Begründung auf ein Bauteil oder einen Anschluss zeigt (R-ERR-3). */
export function namesBlocker(reason: string, nodeIds: readonly string[]): boolean {
  if (nodeIds.some((id) => id.length > 0 && reason.includes(id))) return true;
  return /anschluss|handle|stub|port|bauteil|node/i.test(reason);
}

export function replayRecord(record: FailureRecord): ReplayOutcome {
  const runner = runEngine(record);
  const report = checkInvariants(runner.routed, runner.rects);
  const plan = wiredPlanOf(record);
  const hashMatches = inputHashOf(plan.nodes, plan.edges) === record.inputHash;

  const invariantKey = record.expect.kind === 'invariant' ? record.expect.invariant : null;
  const becauseOfInvariant = invariantKey ? report[invariantKey].length : 0;
  const unroutableWithoutBlocker = runner.unroutable.filter(
    (entry) => !namesBlocker(entry.reason, runner.nodeIds)
  ).length;

  // R-ERR-1 (erreichbar, aber keine Route) wird über den Property-Generator
  // geprüft (Stufe V5). Für einzelne Akten wird hier 0 gemeldet, statt eine
  // Erreichbarkeit zu behaupten, die dieser Lauf nicht misst.
  return judgeRecord(
    record,
    { becauseOfInvariant, unroutableWithoutBlocker, unreachableButUnrouted: 0 },
    hashMatches
  );
}

type CliOptions = { json: boolean; fixHashes: boolean; minimize: boolean; only?: string };

function parseArgs(argv: readonly string[]): CliOptions {
  return {
    json: argv.includes('--json'),
    fixHashes: argv.includes('--fix-hashes'),
    minimize: argv.includes('--minimize'),
    only: argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : undefined,
  };
}

/** Minimiert eine Akte und schreibt das Ergebnis als Inline-Plan zurück. */
function minimizeRecord(
  file: string,
  record: FailureRecord
): { before: MinimizePlan; after: MinimizePlan; removed: string } {
  // Immer auf der verdrahteten Ebene minimieren: das ist die Eingabe des
  // Routers und damit die einzige Ebene, auf der „diese Kante entfernen“
  // eine Bedeutung hat.
  const plan = wiredPlanOf(record);
  const stillFails = (candidate: MinimizePlan): boolean => {
    const probe: FailureRecord = {
      ...record,
      plan: { kind: 'inline', nodes: candidate.nodes, edges: candidate.edges },
    };
    try {
      return replayRecord({ ...probe, inputHash: record.inputHash }).status !== 'fixed';
    } catch {
      return false;
    }
  };
  const result = minimizePlan(plan, stillFails);
  const updated: FailureRecord = {
    ...record,
    plan: { kind: 'inline', nodes: result.plan.nodes, edges: result.plan.edges },
    minimized: true,
    inputHash: inputHashOf(result.plan.nodes, result.plan.edges),
  };
  writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return {
    before: plan,
    after: result.plan,
    removed: `${result.removed.edges} Kanten, ${result.removed.nodes} Bauteile (${result.evaluations} Prüfläufe)`,
  };
}

function loadRecords(): { file: string; raw: unknown }[] {
  return readdirSync(RECORD_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file: join(RECORD_DIR, file),
      raw: JSON.parse(readFileSync(join(RECORD_DIR, file), 'utf8')) as unknown,
    }));
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const options = parseArgs(argv);
  const files = loadRecords();
  const outcomes: (ReplayOutcome & { file: string })[] = [];
  const invalid: { file: string; problems: string }[] = [];
  let rewritten = 0;

  for (const { file, raw } of files) {
    const validated = validateRecord(raw);
    if (!validated.ok) {
      invalid.push({ file, problems: validated.problems.map((p) => `${p.field}: ${p.message}`).join('; ') });
      continue;
    }
    const record = validated.record;
    if (options.only && record.failureId !== options.only) continue;

    if (options.fixHashes) {
      const plan = wiredPlanOf(record);
      const hash = inputHashOf(plan.nodes, plan.edges);
      if (hash !== record.inputHash) {
        writeFileSync(file, `${JSON.stringify({ ...record, inputHash: hash }, null, 2)}\n`, 'utf8');
        record.inputHash = hash;
        rewritten += 1;
      }
    }

    if (options.minimize) {
      const result = minimizeRecord(file, record);
      console.log(
        `${record.failureId}: minimiert ${result.before.edges.length}/${result.before.nodes.length} → ${result.after.edges.length}/${result.after.nodes.length} (${result.removed})`
      );
      const reloaded = validateRecord(JSON.parse(readFileSync(file, 'utf8')));
      if (!reloaded.ok) {
        invalid.push({ file, problems: 'Minimierung erzeugte eine ungültige Akte' });
        continue;
      }
      outcomes.push({ ...replayRecord(reloaded.record), file });
      continue;
    }

    outcomes.push({ ...replayRecord(record), file });
  }

  if (options.json) {
    console.log(JSON.stringify({ outcomes, invalid, rewritten }, null, 2));
  } else {
    console.log('Akte              | Status      | erwartet                 | beobachtet | Hash | Datei');
    console.log('------------------|-------------|--------------------------|------------|------|------');
    for (const outcome of outcomes) {
      console.log(
        `${outcome.failureId} | ${outcome.status.padEnd(11)} | ${outcome.expected.padEnd(24)} | ${outcome.observed.padStart(10)} | ${
          outcome.hashMatches ? 'ok  ' : 'DRIFT'
        } | ${outcome.file.split('/').pop()}`
      );
    }
    if (invalid.length > 0) {
      console.log('\nUngültige Akten:');
      for (const entry of invalid) console.log(`  ${entry.file}: ${entry.problems}`);
    }
    if (rewritten > 0) console.log(`\n${rewritten} Hash(es) neu geschrieben.`);
    const stale = outcomes.filter((outcome) => outcome.status !== 'reproduces');
    if (stale.length > 0) {
      console.log('\nNicht reproduzierend (Akte schließen, nicht löschen):');
      for (const entry of stale) console.log(`  ${entry.failureId}: ${entry.status}`);
    }
  }

  const failing = outcomes.some((outcome) => outcome.status !== 'reproduces') || invalid.length > 0;
  return failing ? 1 : 0;
}

if (process.argv[1]?.includes('replay')) {
  process.exitCode = main();
}
