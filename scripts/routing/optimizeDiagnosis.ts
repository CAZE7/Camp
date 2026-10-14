/**
 * A1-Diagnose: Was macht die Nachbearbeitung (C → D) mit dem Plan?
 *
 * Führt die 5-State-Diagnose (`lib/routing/diagnostic/`) über die sechs
 * Referenzpläne, drei Stress-Szenarien und — auf Wunsch — die synthetische
 * Spannkanten-Familie aus und stellt den Übergang **C → D** gegenüber:
 * Roh-Wegpunkte nach dem Routing gegen die Endgeometrie nach Nudge,
 * Bend-Merge und beiden Trenngängen.
 *
 * Zwei Sichten je Plan:
 *
 *  1. **Gate-Sicht** (`measurePlan`, paritätisch zu I1/I2/I3 — Test:
 *     `lib/routing/rules/transformAcceptance.test.ts`): harte Verletzungen,
 *     Freigabe-Verletzungen, Kreuzungen, Länge — je für C und D.
 *  2. **Diagnose-Sicht** (`RoutingMetrics` der Session): dieselben Zustände
 *     durch das Metrik-Modul des Diagnose-Systems (u. a. Länge, Biegungen,
 *     Clearance-Verstöße).
 *
 * Die Akzeptanzregel selbst steht in
 * `lib/routing/rules/transformAcceptance.ts` (ADR 0037) und greift im
 * Produktivpfad als Kettenregel über den ganzen Nachbearbeitungs-Block; der
 * Bericht steht in `docs/routing/OPTIMIZE-DIAGNOSIS.md`.
 *
 * Aufruf:
 *   npx tsx scripts/routing/optimizeDiagnosis.ts
 *   npx tsx scripts/routing/optimizeDiagnosis.ts --without-gate   # Stand VOR A1
 *   npx tsx scripts/routing/optimizeDiagnosis.ts --with-grid      # + stress:spanning-100
 *   npx tsx scripts/routing/optimizeDiagnosis.ts --all-scenarios  # alle 15 p-Szenarien
 */

import {
  clearDiagnosticSessions,
  createDiagnosticSession,
  enableRoutingDiagnostics,
  setActiveDiagnosticSession,
  type DiagnosticStateSnapshot,
  type RoutingDiagnosticSession,
} from '../../lib/routing/diagnostic';
import {
  routeAllCables,
  setTransformAcceptanceForTest,
  type RouteEdgeRef,
} from '../../components/edges/utils/routeAll';
import { nodesToObstacles } from '../../components/edges/utils/pathfinding';
import type { RoutableNode } from '../../components/edges/utils/nodeGeometry';
import { performAutoWiring } from '../../lib/autoWire';
import {
  measurePlan,
  type AcceptanceEdge,
  type AcceptanceNodeRect,
} from '../../lib/routing/rules/transformAcceptance';
import type { Point } from '../../lib/routing/geometry';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { REGRESSION_SCENARIOS } from '../regression/scenarios';

export type DiagnosisMeasure = {
  readonly hard: number;
  readonly weighted: number;
  readonly crossings: number;
  readonly bends: number;
  readonly length: number;
};

export type OptimizeDiagnosisRow = {
  readonly id: string;
  readonly kind: 'reference' | 'scenario' | 'stress';
  readonly edges: number;
  readonly c: DiagnosisMeasure;
  readonly d: DiagnosisMeasure;
  readonly delta: {
    readonly hard: number;
    readonly weighted: number;
    readonly crossings: number;
    readonly length: number;
    readonly lengthPct: number;
  };
  /**
   * Diagnose-Sicht: `RoutingMetrics` des C-/D-Zustands. Achtung — `cLength` /
   * `dLength` sind seit dem A1-Befund (2026-10-14) die aus der Geometrie
   * gerechneten Längen; vorher meldete Zustand D die Zahlen des Rohroutings.
   */
  readonly diagnostic: {
    readonly cClearanceViolations: number;
    readonly dClearanceViolations: number;
    readonly cLength: number;
    readonly dLength: number;
    readonly dCrossings: number;
  };
};

/** Pläne der Referenzfamilie — dieselben sechs wie Golden Master/Audit. */
const STRESS_SCENARIOS = ['p02-batterie-10-verbraucher', 'p07-acdc-mischung', 'p11-zwangskreuzung'];

/**
 * Synthetische Spannkanten-Familie (dieselbe Konstruktion wie
 * `benchmarks/routeAllScaling.probe.ts` „Worst Case"): n Knoten im 420/220-
 * Raster, Kanten n_i → n_{i+n/2}. Kein Referenzplan — die Familie ist der
 * gemessene Auslöser des A1-Befunds (Nachbearbeitung kauft Freigabe mit
 * Kreuzungen und Länge) und deshalb der Belastungstest der Regel.
 */
export function spanningGridPlan(n = 100): { nodes: RoutableNode[]; edges: RouteEdgeRef[] } {
  const nodes: RoutableNode[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `n${i}`,
      type: i === 0 ? 'battery' : i % 10 === 0 ? 'busbar' : 'consumer',
      position: { x: (i % 10) * 420, y: Math.floor(i / 10) * 220 },
      data: {},
      width: 192,
      height: 120,
    } as RoutableNode);
  }
  const edges: RouteEdgeRef[] = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i++) {
    edges.push({
      id: `s${String(i).padStart(4, '0')}`,
      source: `n${i}`,
      target: `n${i + half}`,
      sourceHandle: 'plus',
      targetHandle: 'plus',
      data: { edgeDomain: 'DC_12V', crossSection: 16 },
    } as RouteEdgeRef);
  }
  return { nodes, edges };
}

const toMeasures = (snapshot: DiagnosticStateSnapshot | null | undefined): DiagnosisMeasure => {
  if (!snapshot) return { hard: 0, weighted: 0, crossings: 0, bends: 0, length: 0 };
  return {
    hard: 0,
    weighted: 0,
    crossings: snapshot.routes.reduce((sum, r) => sum + r.crossings, 0),
    bends: snapshot.routes.reduce((sum, r) => sum + r.bends, 0),
    length: snapshot.routes.reduce((sum, r) => sum + r.length, 0),
  };
};

const measureState = (
  edges: readonly AcceptanceEdge[],
  nodes: readonly AcceptanceNodeRect[]
): DiagnosisMeasure => {
  const measure = measurePlan(edges, nodes);
  return {
    hard: measure.hard,
    weighted: measure.weighted,
    crossings: measure.crossings,
    bends: measure.bends,
    length: measure.length,
  };
};

const nodeRectsOf = (nodes: readonly { id: string }[]): AcceptanceNodeRect[] => {
  const rects = nodesToObstacles(nodes as never, new Set());
  const out: AcceptanceNodeRect[] = [];
  let index = 0;
  for (const node of nodes) {
    const rect = rects[index++];
    if (rect) out.push({ id: node.id, ...rect });
  }
  return out;
};

const snapshotEdges = (snapshot: DiagnosticStateSnapshot | null | undefined): AcceptanceEdge[] => {
  if (!snapshot) return [];
  return snapshot.routes.map((route) => ({
    id: route.edgeId,
    source: route.source,
    target: route.target,
    waypoints: route.waypoints as Point[],
  }));
};

type PlanInput = {
  readonly id: string;
  readonly kind: OptimizeDiagnosisRow['kind'];
  readonly nodes: readonly { id: string }[];
  readonly edges: readonly { id: string; source: string; target: string }[];
};

const runPlan = (plan: PlanInput, session: RoutingDiagnosticSession): OptimizeDiagnosisRow => {
  const routes = routeAllCables(plan.nodes as never, plan.edges as never);
  const nodeRects = nodeRectsOf(plan.nodes);
  const snapshotC = session.getSnapshot('C');
  const snapshotD = session.getSnapshot('D');
  const edgesC = snapshotEdges(snapshotC);
  const edgesD = snapshotEdges(snapshotD);

  const fallbackC: AcceptanceEdge[] = plan.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    waypoints: (routes.get(e.id)?.waypoints ?? []) as Point[],
  }));

  const c = measureState(edgesC.length > 0 ? edgesC : fallbackC, nodeRects);
  const d = measureState(edgesD.length > 0 ? edgesD : fallbackC, nodeRects);
  const metricsC = session.getMetrics('C');
  const metricsD = session.getMetrics('D');

  return {
    id: plan.id,
    kind: plan.kind,
    edges: plan.edges.length,
    c,
    d,
    delta: {
      hard: d.hard - c.hard,
      weighted: d.weighted - c.weighted,
      crossings: d.crossings - c.crossings,
      length: d.length - c.length,
      lengthPct: c.length > 0 ? ((d.length - c.length) / c.length) * 100 : 0,
    },
    diagnostic: {
      cClearanceViolations: metricsC?.clearanceViolations ?? 0,
      dClearanceViolations: metricsD?.clearanceViolations ?? 0,
      cLength: metricsC?.totalCableLength ?? 0,
      dLength: metricsD?.totalCableLength ?? 0,
      dCrossings: metricsD?.geometricCrossings ?? 0,
    },
  };
};

export type OptimizeDiagnosisOptions = {
  /** `false` = Nachbearbeitungs-Gatter aus (Stand VOR A1/ADR 0037). */
  readonly gate?: boolean;
  /** Alle 15 Regressions-Szenarien statt der drei Stress-Szenarien. */
  readonly allScenarios?: boolean;
  /** Zusätzlich die synthetische Spannkanten-Familie (`stress:spanning-100`). */
  readonly grid?: boolean;
};

/** Führt die Diagnose über alle Pläne aus. */
export function runOptimizeDiagnosis(options: OptimizeDiagnosisOptions = {}): OptimizeDiagnosisRow[] {
  const gate = options.gate ?? true;
  setTransformAcceptanceForTest(gate);
  const rows: OptimizeDiagnosisRow[] = [];
  const session = createDiagnosticSession('optimize-diagnosis', 0, { enabled: true, maxSessions: 20 });
  setActiveDiagnosticSession(session);
  enableRoutingDiagnostics(true);
  try {
    for (const [name, plan] of Object.entries(GOLDEN_PLANS)) {
      const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
      if (!wired) continue;
      rows.push(
        runPlan(
          {
            id: name,
            kind: 'reference',
            nodes: wired.nodes as unknown as { id: string }[],
            edges: wired.edges as unknown as { id: string; source: string; target: string }[],
          },
          session
        )
      );
    }
    for (const scenario of REGRESSION_SCENARIOS) {
      if (!options.allScenarios && !STRESS_SCENARIOS.includes(scenario.id)) continue;
      rows.push(
        runPlan({ id: scenario.id, kind: 'scenario', nodes: scenario.nodes, edges: scenario.edges }, session)
      );
    }
    if (options.grid) {
      const stress = spanningGridPlan(100);
      rows.push(
        runPlan(
          {
            id: 'stress:spanning-100',
            kind: 'stress',
            nodes: stress.nodes as unknown as { id: string }[],
            edges: stress.edges as unknown as { id: string; source: string; target: string }[],
          },
          session
        )
      );
    }
  } finally {
    setActiveDiagnosticSession(null);
    enableRoutingDiagnostics(false);
    clearDiagnosticSessions();
    setTransformAcceptanceForTest(null);
  }
  return rows;
}

const fmt = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Markdown-Tabelle für `docs/routing/OPTIMIZE-DIAGNOSIS.md`. */
export function renderDiagnosisTable(rows: readonly OptimizeDiagnosisRow[]): string {
  const header =
    '| Plan | Kanten | C: hart | C: frei | C: kreuz | C: Länge | D: hart | D: frei | D: kreuz | D: Länge | Δ frei | Δ Länge | Δ Länge % |';
  const sep = '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |';
  const lines = rows.map(
    (row) =>
      `| ${row.id} | ${row.edges} | ${row.c.hard} | ${row.c.weighted} | ${row.c.crossings} | ${fmt(
        row.c.length
      )} | ${row.d.hard} | ${row.d.weighted} | ${row.d.crossings} | ${fmt(row.d.length)} | ${
        row.delta.weighted
      } | ${fmt(row.delta.length)} | ${row.delta.lengthPct.toFixed(2)} % |`
  );
  return [header, sep, ...lines].join('\n');
}

if (process.argv[1]?.endsWith('optimizeDiagnosis.ts')) {
  const gate = !process.argv.includes('--without-gate');
  const rows = runOptimizeDiagnosis({
    gate,
    allScenarios: process.argv.includes('--all-scenarios'),
    grid: process.argv.includes('--with-grid'),
  });
  console.log(renderDiagnosisTable(rows));
  console.log('');
  for (const row of rows) {
    console.log(
      `${row.id}: Diagnose C/D Clearance ${row.diagnostic.cClearanceViolations} → ${row.diagnostic.dClearanceViolations}, ` +
        `Länge ${row.diagnostic.cLength.toFixed(0)} → ${row.diagnostic.dLength.toFixed(0)} px, ` +
        `Kreuzungen (D) ${row.diagnostic.dCrossings}`
    );
  }
}
