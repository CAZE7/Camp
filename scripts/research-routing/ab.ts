/**
 * A/B-Vergleich: Bestandsrouter (`routeAllCables`) gegen den globalen Kern
 * (`docs/research/routing-core/kernel`), auf denselben Eingaben.
 *
 *   npm run routing:core:ab            Tabelle auf stdout
 *   npm run routing:core:ab -- --json  maschinenlesbar
 *
 * Fairness-Regeln (Spezifikation §8.1):
 *
 * * Beide Engines bekommen **dieselbe** Eingabe: `performAutoWiring(GOLDEN_PLANS[p])`
 *   → `RoutableNode[]`/`RouteEdgeRef[]`; der Kern zusätzlich über den Adapter.
 * * Gemessen wird mit **einer** Auswertung: Länge, Knicke und Kreuzungspaare
 *   werden für beide Seiten aus den fertigen Waypoints berechnet
 *   (`crossingPairs`), nicht aus den Selbstauskünften der Router.
 * * Die Invarianten prüft für beide Seiten dieselbe Instanz (`checkInvariants`).
 *
 * Reine Messung: keine Seiteneffekte, kein Zufall, kein DOM.
 */

import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../components/edges/utils/nodeGeometry';
import { checkInvariants, type NodeRect } from '../../lib/routing/invariants';
import { nodeHeight, nodeOriginX, nodeOriginY, nodeWidth } from '../../components/edges/utils/nodeGeometry';
import { countBends, pathLength, type Point } from '../../lib/routing/geometry';
import { routeCore, crossingPairs } from '../../docs/research/routing-core/kernel';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { adaptPlan } from './adapt';

const NODE_W = 192;
const NODE_H = 120;

type Side = {
  edges: number;
  length: number;
  bends: number;
  crossings: number;
  I1: number;
  I2: number;
  I3: number;
  unroutable: number;
  ms: number;
  deterministic: boolean;
};

type Row = { plan: string; legacy: Side; core: Side };

const nodeRects = (nodes: readonly RoutableNode[]): NodeRect[] =>
  nodes.map((node) => ({
    id: node.id,
    x: nodeOriginX(node),
    y: nodeOriginY(node),
    width: nodeWidth(node, NODE_W),
    height: nodeHeight(node, NODE_H),
  }));

const measure = (
  routes: Map<string, Point[]>,
  rects: readonly NodeRect[],
  edgeMeta: Map<string, { source: string; target: string }>,
  unroutable: number,
  ms: number
): Side => {
  const entries = [...routes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let length = 0;
  let bends = 0;
  let crossings = 0;
  for (let i = 0; i < entries.length; i += 1) {
    const waypoints = (entries[i] as [string, Point[]])[1];
    length += pathLength(waypoints);
    bends += countBends(waypoints);
    for (let j = i + 1; j < entries.length; j += 1) {
      crossings += crossingPairs(waypoints, (entries[j] as [string, Point[]])[1]);
    }
  }
  const routed = entries.map(([id, waypoints]) => ({
    id,
    source: edgeMeta.get(id)?.source ?? '',
    target: edgeMeta.get(id)?.target ?? '',
    waypoints,
  }));
  const report = checkInvariants(routed, rects);
  return {
    edges: entries.length,
    length,
    bends,
    crossings,
    I1: report.I1.length,
    I2: report.I2.length,
    I3: report.I3.length,
    unroutable,
    ms,
    deterministic: true,
  };
};

export function runAb(): Row[] {
  const rows: Row[] = [];
  const planNames = Object.keys(GOLDEN_PLANS);
  for (const name of planNames) {
    const plan = GOLDEN_PLANS[name] as { nodes: unknown[]; edges: unknown[] } | undefined;
    if (!plan) continue;
    const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
    if (!wired) continue;
    const nodes = wired.nodes as never as RoutableNode[];
    const edges = wired.edges as never as RouteEdgeRef[];
    const edgeMeta = new Map(edges.map((edge) => [edge.id, { source: edge.source, target: edge.target }]));

    // --- Bestandsrouter -------------------------------------------------
    const t0 = performance.now();
    const legacyRoutes = routeAllCables(nodes, edges);
    const legacyMs = performance.now() - t0;
    const legacyWaypoints = new Map<string, Point[]>();
    let legacyFallback = 0;
    for (const [id, result] of legacyRoutes) {
      legacyWaypoints.set(
        id,
        result.waypoints.map((p) => ({ x: p.x, y: p.y }))
      );
      if (result.usedSearch === 'fallback') legacyFallback += 1;
    }
    // Doppellauf für den Determinismus-Nachweis (I9).
    const legacyAgain = routeAllCables(nodes, edges);
    let legacyDeterministic = legacyAgain.size === legacyRoutes.size;
    for (const [id, result] of legacyAgain) {
      const first = legacyRoutes.get(id);
      if (!first || first.waypoints.length !== result.waypoints.length) legacyDeterministic = false;
    }
    // Jede Seite wird gegen die Hindernisboxen geprüft, gegen die sie selbst
    // routet. Sonst misst man eine Freigabe gegen eine Geometrie, die der
    // jeweilige Motor nie gesehen hat (Korrektur 2026-11-11, AB-REPORT §2.1).
    const legacySide = measure(legacyWaypoints, nodeRects(nodes), edgeMeta, legacyFallback, legacyMs);
    legacySide.deterministic = legacyDeterministic;

    // --- Globaler Kern --------------------------------------------------
    const adapted = adaptPlan(nodes, edges);
    let coreSide: Side;
    if (!adapted.ok) {
      coreSide = {
        edges: 0,
        length: 0,
        bends: 0,
        crossings: 0,
        I1: 0,
        I2: 0,
        I3: 0,
        unroutable: adapted.missing.length,
        ms: 0,
        deterministic: true,
      };
    } else {
      const c0 = performance.now();
      const result = routeCore(adapted.input);
      const coreMs = performance.now() - c0;
      const coreWaypoints = new Map<string, Point[]>();
      for (const [id, route] of result.routes)
        coreWaypoints.set(
          id,
          route.waypoints.map((p) => ({ x: p.x, y: p.y }))
        );
      // Doppellauf: identische Metriken?
      const again = routeCore(adapted.input);
      const deterministic =
        again.metrics.totalLength === result.metrics.totalLength &&
        again.metrics.totalBends === result.metrics.totalBends &&
        again.metrics.totalCrossings === result.metrics.totalCrossings &&
        again.routes.size === result.routes.size;
      // Kern: die Boxen stammen aus dem Adapter — genau die, die der Kern als
      // Hindernis benutzt (inklusive seiner Freigabe-Logik).
      const coreRects: NodeRect[] = adapted.input.nodes.map((node) => ({
        id: node.id,
        x: node.rect.x,
        y: node.rect.y,
        width: node.rect.width,
        height: node.rect.height,
      }));
      coreSide = measure(coreWaypoints, coreRects, edgeMeta, result.unroutable.length, coreMs);
      coreSide.deterministic = deterministic;
    }
    rows.push({ plan: name, legacy: legacySide, core: coreSide });
  }
  return rows;
}

const fmt = (value: number): string => String(Math.round(value));

const table = (rows: Row[]): string => {
  const lines: string[] = [];
  lines.push(
    'Plan       |        Bestand (Länge/Knicke/Kreuzungen) |           Kern (Länge/Knicke/Kreuzungen) | I1/I2/I3 Bestand | I1/I2/I3 Kern | Δ Länge | Δ Knicke | Δ Kreuz | ms Bestand/Kern'
  );
  lines.push('-'.repeat(150));
  for (const row of rows) {
    const l = row.legacy;
    const c = row.core;
    const dLength = l.length > 0 ? ((c.length - l.length) / l.length) * 100 : 0;
    const dBends = l.bends > 0 ? ((c.bends - l.bends) / l.bends) * 100 : 0;
    const dCross = c.crossings - l.crossings;
    lines.push(
      `${row.plan.padEnd(10)} | ${fmt(l.length).padStart(6)} / ${String(l.bends).padStart(3)} / ${String(
        l.crossings
      ).padStart(
        3
      )}                     | ${fmt(c.length).padStart(6)} / ${String(c.bends).padStart(3)} / ${String(
        c.crossings
      ).padStart(
        3
      )}                     | ${l.I1}/${l.I2}/${l.I3}              | ${c.I1}/${c.I2}/${c.I3}           | ${
        dLength >= 0 ? '+' : ''
      }${dLength.toFixed(1).padStart(6)} % | ${dBends >= 0 ? '+' : ''}${dBends.toFixed(1).padStart(6)} % | ${String(
        dCross >= 0 ? '+' + dCross : dCross
      ).padStart(7)} | ${fmt(l.ms)}/${fmt(c.ms)}`
    );
  }
  const sum = (pick: (side: Side) => number) => rows.reduce((acc, row) => acc + pick(row.core), 0);
  const sumLegacy = (pick: (side: Side) => number) => rows.reduce((acc, row) => acc + pick(row.legacy), 0);
  lines.push('-'.repeat(150));
  lines.push(
    `Σ          | ${fmt(sumLegacy((s) => s.length))} / ${sumLegacy((s) => s.bends)} / ${sumLegacy(
      (s) => s.crossings
    )}                          | ${fmt(sum((s) => s.length))} / ${sum((s) => s.bends)} / ${sum(
      (s) => s.crossings
    )}                          |                  |               |         |          |        |`
  );
  return lines.join('\n');
};

const isJson = process.argv.includes('--json');
const rows = runAb();
if (isJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(table(rows));
}
