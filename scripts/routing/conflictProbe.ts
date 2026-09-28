/**
 * Mission Stufe 3 — A/B-Messprobe der Pass-Gates und Reihenfolge-Varianten
 * (`ROUTING_GATES.conflictGraphBatching`, `ROUTING_GATES.integerMilliPxCosts`).
 *
 * „Messen vor Bauen“ und DoD zugleich: Der Produktivpfad steht auf Gate 0
 * (byte-stabil, Golden Master unberührt). Diese Probe liefert die Zahlen,
 * die eine spätere Aktivierung begründen (Recapture-Ledger) — gemessen über
 * die sechs Referenzpläne (`knownPlans/` via AutoWire) und die 15
 * Regressionspläne (`scripts/regression/scenarios.ts`):
 *
 *  1. Konfliktgraph-Statistik (Komponenten, verstellte Positionen) je Pad.
 *  2. Reihenfolge-Varianten A/B gegen Gate 0: `desc` (Spec §5.2, Längenrang
 *     absteigend), `asc` (Spiegel-Experiment), `global` (das historisch
 *     gemessen schlechte „global lange zuerst“, routeAll-Kommentar
 *     2026-09-09 — Reproduktions-Referenz).
 *  3. A/B Integer-Milli-px: Byte-Gleichheit Gate 0 vs. 1 + Metrik-Delta.
 *  4. Determinismus (R5) je Variante: zwei Läufe bitidentisch.
 *
 * Aufruf: `npm run routing:conflict-probe` (JSON nach /tmp/stage3-probe.json).
 */

import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { REGRESSION_SCENARIOS } from '../regression/scenarios';
import { measureScenario } from '../regression/layout';
import { analyzeOverlaps } from './audit';
import { performAutoWiring } from '../../lib/autoWire';
import {
  checkInvariants,
  serializeRoutes,
  type NodeRect,
  type RoutedEdge,
} from '../../lib/routing/invariants';
import {
  resolveHandlePoint,
  routeAllCables,
  setConflictGraphBatchingForTest,
  type ConflictOrderFn,
  type RouteEdgeRef,
} from '../../components/edges/utils/routeAll';
import {
  clearPathfindingCache,
  nodesToObstacles,
  setIntegerMilliPxCostsForTest,
} from '../../components/edges/utils/pathfinding';
import {
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type RoutableNode,
} from '../../components/edges/utils/nodeGeometry';
import {
  conflictComponents,
  greedyConflictOrder,
  type ConflictCandidate,
} from '../../lib/routing/rules/conflictGraph';
import { alternativeRouteGap, ROUTING_TOKENS } from '../../lib/routing/tokens';
import { compareIds } from '../../lib/sortOrder';

const NODE_FALLBACK = { width: 192, height: 120 };

type PlanInput = { name: string; nodes: RoutableNode[]; edges: RouteEdgeRef[] };

type VariantResult = {
  serialized: string;
  crossings: number;
  bends: number;
  length: number;
  edgeOverlaps: number;
  overlapsAtPort: number;
  overlapsElsewhere: number;
  violations: number; // Σ I1..I7
  ms: number;
  deterministic: boolean;
};

type PlanReport = {
  name: string;
  components: { pad0: number; pad16: number; pad48: number; multi: number; biggest: number; moved: number };
  off: VariantResult;
  desc: VariantResult;
  asc: VariantResult;
  global: VariantResult;
  intCosts: VariantResult;
  descByteEqual: boolean;
  ascByteEqual: boolean;
  globalByteEqual: boolean;
  intByteEqual: boolean;
};

// ── Reihenfolge-Varianten (nur Probe — Produktivpfad kennt ausschließlich
//    `true` = Spec-Regel und `null` = Token) ────────────────────────────────

const lengthOf = (c: ConflictCandidate): number => Math.abs(c.from.x - c.to.x) + Math.abs(c.from.y - c.to.y);

/** Spiegel-Experiment: Längenrang AUFGSTEIGEND innerhalb der Komponenten. */
const ascOrder: ConflictOrderFn = (candidates) => {
  const lengthById = new Map(candidates.map((c) => [c.id, lengthOf(c)]));
  const ordered: string[] = [];
  for (const component of conflictComponents(candidates)) {
    ordered.push(
      ...[...component].sort((a, b) => lengthById.get(a)! - lengthById.get(b)! || compareIds(a, b))
    );
  }
  return ordered;
};

/** Historisch gemessene Globale Ordnung „lange zuerst“ (Referenz 2026-09-09). */
const globalDescOrder: ConflictOrderFn = (candidates) =>
  [...candidates].sort((a, b) => lengthOf(b) - lengthOf(a) || compareIds(a.id, b.id)).map((c) => c.id);

const loadPlans = (): PlanInput[] => {
  const plans: PlanInput[] = [];
  for (const [name, plan] of Object.entries(GOLDEN_PLANS)) {
    const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
    if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für "${name}"`);
    plans.push({
      name: `golden:${name}`,
      nodes: wired.nodes as never as RoutableNode[],
      edges: wired.edges as never as RouteEdgeRef[],
    });
  }
  for (const scenario of REGRESSION_SCENARIOS) {
    plans.push({
      name: `reg:${scenario.id}`,
      nodes: scenario.nodes as never as RoutableNode[],
      edges: scenario.edges as RouteEdgeRef[],
    });
  }
  return plans;
};

const rectsOf = (nodes: readonly RoutableNode[]): NodeRect[] =>
  nodes.map((node, index) => {
    const [rect] = nodesToObstacles([node as never], new Set<string>());
    return { id: node.id ?? `n${index}`, ...rect! };
  });

const runVariant = (
  plan: PlanInput,
  gates: { order: boolean | ConflictOrderFn | null; intCosts: boolean }
): { first: VariantResult; second: VariantResult } => {
  const once = (): VariantResult => {
    setConflictGraphBatchingForTest(gates.order);
    setIntegerMilliPxCostsForTest(gates.intCosts ? true : null);
    // Cache-Falle (Stufe-3-Fund 2026-09-28): Ohne Leeren gab der Float-Lauf
    // sein Ergebnis an die Milli-px-Variante zurück (scheinbare Byte-Gleich-
    // heit, während der kalte Golden Master acdc brach). Jeder Durchlauf
    // rechnet frisch — ehrliche A/B-Zahlen.
    clearPathfindingCache();
    try {
      const t0 = performance.now();
      const routes = routeAllCables(plan.nodes as never, plan.edges as never);
      const ms = performance.now() - t0;
      const routed: RoutedEdge[] = [];
      for (const edge of plan.edges) {
        const result = routes.get(edge.id);
        if (!result) throw new Error(`${plan.name}: Kante ${edge.id} fehlt`);
        routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
      }
      const rects = rectsOf(plan.nodes);
      const metrics = measureScenario(routed, rects);
      const overlaps = analyzeOverlaps(routed);
      const inv = checkInvariants(routed, rects);
      const violations = (['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'] as const).reduce(
        (sum, key) => sum + inv[key].length,
        0
      );
      return {
        serialized: serializeRoutes(routed),
        crossings: metrics.crossings,
        bends: metrics.bends,
        length: metrics.length,
        edgeOverlaps: metrics.edgeOverlaps,
        overlapsAtPort: overlaps.atPort,
        overlapsElsewhere: overlaps.elsewhere,
        violations,
        ms,
        deterministic: true,
      };
    } finally {
      setConflictGraphBatchingForTest(null);
      setIntegerMilliPxCostsForTest(null);
    }
  };
  const first = once();
  const second = once();
  second.deterministic = first.serialized === second.serialized;
  return { first, second };
};

/** Ports exakt wie `dumpPorts`/`routeAllCables` auflösen (Knotenmitte + Handle). */
const candidatesOf = (plan: PlanInput): ConflictCandidate[] => {
  const nodeById = new Map(plan.nodes.map((n) => [n.id, n]));
  const centerOf = (node: RoutableNode | undefined) =>
    node
      ? {
          x: nodeOriginX(node) + nodeWidth(node, NODE_FALLBACK.width) / 2,
          y: nodeOriginY(node) + nodeHeight(node, NODE_FALLBACK.height) / 2,
        }
      : undefined;
  const resolve = (edge: RouteEdgeRef, kind: 'source' | 'target') => {
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const src = centerOf(srcNode);
    const tgt = centerOf(tgtNode);
    const flow = src && tgt ? { x: tgt.x - src.x, y: tgt.y - src.y } : undefined;
    return kind === 'source'
      ? resolveHandlePoint(srcNode, edge.sourceHandle, 'source', flow)
      : resolveHandlePoint(
          tgtNode,
          edge.targetHandle,
          'target',
          flow ? { x: -flow.x, y: -flow.y } : undefined
        );
  };
  return plan.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    from: resolve(edge, 'source'),
    to: resolve(edge, 'target'),
  }));
};

const componentStats = (plan: PlanInput): PlanReport['components'] => {
  const candidates = candidatesOf(plan);
  const idOrder = [...candidates].sort((a, b) => compareIds(a.id, b.id)).map((c) => c.id);
  const size = (pad: number): number => conflictComponents(candidates, { pad }).length;
  const comps16 = conflictComponents(candidates, { pad: ROUTING_TOKENS.laneGrid });
  const batched = greedyConflictOrder(candidates);
  const moved = batched.filter((id, i) => idOrder[i] !== id).length;
  return {
    pad0: size(0),
    pad16: comps16.length,
    pad48: size(alternativeRouteGap()),
    multi: comps16.filter((c) => c.length > 1).length,
    biggest: Math.max(0, ...comps16.map((c) => c.length)),
    moved,
  };
};

const sum = (rows: PlanReport[], pick: (r: PlanReport) => number): number =>
  rows.reduce((acc, row) => acc + pick(row), 0);

const main = (): void => {
  const plans = loadPlans();
  const reports: PlanReport[] = [];
  console.log(
    `Stufe-3-A/B-Probe: ${plans.length} Pläne (6 Referenz + ${REGRESSION_SCENARIOS.length} Regression)\n`
  );

  for (const plan of plans) {
    const components = componentStats(plan);
    const off = runVariant(plan, { order: null, intCosts: false });
    const desc = runVariant(plan, { order: true, intCosts: false });
    const asc = runVariant(plan, { order: ascOrder, intCosts: false });
    const global = runVariant(plan, { order: globalDescOrder, intCosts: false });
    const intCosts = runVariant(plan, { order: null, intCosts: true });
    const report: PlanReport = {
      name: plan.name,
      components,
      off: off.first,
      desc: desc.first,
      asc: asc.first,
      global: global.first,
      intCosts: intCosts.first,
      descByteEqual: off.first.serialized === desc.first.serialized,
      ascByteEqual: off.first.serialized === asc.first.serialized,
      globalByteEqual: off.first.serialized === global.first.serialized,
      intByteEqual: off.first.serialized === intCosts.first.serialized,
    };
    reports.push(report);
    const det =
      off.second.deterministic &&
      desc.second.deterministic &&
      asc.second.deterministic &&
      global.second.deterministic &&
      intCosts.second.deterministic;
    const line = (label: string, v: VariantResult, byteEqual: boolean): string =>
      `${label}${byteEqual ? '=' : ''}:K${v.crossings} B${v.bends} L${Math.round(v.length)} Ov${v.edgeOverlaps} I${v.violations}`;
    console.log(
      `${report.name.padEnd(24)} Komp=${components.pad16} big=${components.biggest} verstellt=${components.moved} | ` +
        `${line('off', report.off, true)} | ${line('desc', report.desc, report.descByteEqual)} | ` +
        `${line('asc', report.asc, report.ascByteEqual)} | ${line('glob', report.global, report.globalByteEqual)} | ` +
        `int:${report.intByteEqual ? 'BYTE=' : `K${report.intCosts.crossings} L${Math.round(report.intCosts.length)}`} | det=${det ? '✓' : '✗'}`
    );
  }

  const variant = (
    key: 'desc' | 'asc' | 'global' | 'intCosts',
    byteKey: 'descByteEqual' | 'ascByteEqual' | 'globalByteEqual' | 'intByteEqual'
  ) => ({
    byteEqualPlans: reports.filter((r) => r[byteKey]).length,
    crossings: { off: sum(reports, (r) => r.off.crossings), on: sum(reports, (r) => r[key].crossings) },
    bends: { off: sum(reports, (r) => r.off.bends), on: sum(reports, (r) => r[key].bends) },
    length: {
      off: Math.round(sum(reports, (r) => r.off.length)),
      on: Math.round(sum(reports, (r) => r[key].length)),
    },
    edgeOverlaps: {
      off: sum(reports, (r) => r.off.edgeOverlaps),
      on: sum(reports, (r) => r[key].edgeOverlaps),
    },
    violations: { off: sum(reports, (r) => r.off.violations), on: sum(reports, (r) => r[key].violations) },
    ms: { off: +sum(reports, (r) => r.off.ms).toFixed(1), on: +sum(reports, (r) => r[key].ms).toFixed(1) },
    deterministic: reports.every((r) => r[key].deterministic),
  });

  const summary = {
    plans: reports.length,
    batchingDesc: variant('desc', 'descByteEqual'),
    batchingAsc: variant('asc', 'ascByteEqual'),
    globalDesc: variant('global', 'globalByteEqual'),
    intCosts: variant('intCosts', 'intByteEqual'),
    components: {
      movedTotal: sum(reports, (r) => r.components.moved),
      multiTotal: sum(reports, (r) => r.components.multi),
      biggest: Math.max(...reports.map((r) => r.components.biggest)),
      padSensitivity: {
        pad0: sum(reports, (r) => r.components.pad0),
        pad16: sum(reports, (r) => r.components.pad16),
        pad48: sum(reports, (r) => r.components.pad48),
      },
    },
  };

  console.log('\n=== Zusammenfassung ===');
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync('/tmp/stage3-probe.json', JSON.stringify({ summary, reports }, null, 2));
  console.log('\nRohdaten: /tmp/stage3-probe.json');
};

main();
