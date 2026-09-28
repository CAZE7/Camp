/**
 * PHASE-0-Baseline — MISSION Stufe 0: Messung + Doku, KEIN Verhaltensdiff.
 *
 * Misst Full-Route (routeAllCables, der produktive Live-Pfad) und
 * inkrementelle Edits (Einzelkanten-Neubau inklusive Frame-Cache-Aufbau,
 * `buildOrthogonalPath`-Parcours wie in `benchmarks/edgeRoutingPerf.bench.ts`)
 * auf den drei Mission-Teilmengen:
 *
 *   (a) 15 Regressionspläne   — `scripts/regression/scenarios.ts` (WP-11/#400)
 *   (b) 25 Galerie-Szenarien  — `components/edges/utils/routingScenarios.ts`
 *   (c) 120 Knoten / 240 Kanten — Synthetik: Kantenmuster nach `buildPlan`
 *       aus `benchmarks/edgeRoutingPerf.bench.ts`, Raster/Abstände wie
 *       `benchmarks/routeAllScaling.probe.ts` (routbar), + 3 planweite
 *       Spannkanten (n0→n119, n0→n118, n3→n117).
 *
 * Qualitäts-Dashboard nach agent.md Erlass R-1 („keine Aufgabe gilt ohne
 * Metrik-Nachweis als fertig"):
 *   (b) läuft über `buildRoutingQualityReport` (components/edges/utils/
 *       routingQuality.ts) — ratio/bends/uTurns/crossings/clearanceHits.
 *   (a)/(c) über `measureScenario` (scripts/regression/layout.ts) — dieselbe
 *       Quelle wie Golden-Master-Capture und Regressionstest, plus U-Turns
 *       (`countUTurns`) und Gesamtlänge/Manhattan-Verhältnis je Plan.
 *
 * Kill-Gate der MISSION (Stufe 0, Grenzwerte MISSION-Vorgabe, nicht gemessen):
 *   Full-Route-Median ≤ 50 ms UND inkrementell-Median ≤ 4 ms
 *   ⇒ GPU-Track (Stufe 4) nicht bauen; sonst Stufe 4 vorbereitbar (Flag,
 *     ohne CI-Beteiligung). Evaluiert auf Teilmengen (c); (a) als Zusatz.
 *
 * Bewusst NICHT hier: irgendein Wert, der Routing-Verhalten ändert. Diese
 * Datei ruft nur bestehende, eingefrorene Einstiege auf und schreibt
 * `benchmarks/baseline.json`. Keine Math.random-, keine Zeitquelle außer
 * `capturedAt`/`loadavg`-Metadaten.
 *
 * Aufruf: npx tsx benchmarks/phase0Baseline.ts
 * Zitate: agent.md R-1 · docs/ROUTING-INVARIANTS.md (R1–R7) ·
 *         docs/ai/TESTING-CONTEXT.md (benchmarks = tsx-Sonden) ·
 *         scripts/regression/layout.ts (routeScenario/measureScenario)
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { Position, type Node } from '@xyflow/react';
import { routeAllCables, type RouteEdgeRef } from '../components/edges/utils/routeAll';
import type { RoutableNode } from '../components/edges/utils/nodeGeometry';
import { buildOrthogonalPath, type OrthogonalPathInput } from '../components/edges/utils/orthogonalRouting';
import { crossingSegmentsExcluding, obstaclesExcluding } from '../components/edges/utils/routingCache';
import { polarityPathOffset } from '../components/edges/utils/pathUtils';
import { REGRESSION_SCENARIOS, type RegressionScenario } from '../scripts/regression/scenarios';
import { measureScenario, routeScenario, scenarioNodeRects } from '../scripts/regression/layout';
import { ROUTING_SCENARIOS } from '../components/edges/utils/routingScenarios';
import {
  buildRoutingQualityReport,
  countUTurns,
  formatQualityTable,
} from '../components/edges/utils/routingQuality';
import type { RoutedEdge } from '../lib/routing/invariants';
import type { PathResult } from '../components/edges/utils/pathfinding';

// ─── Methodik-Konstanten (Messdesign, keine Routing-Größen) ───────────────
const FULL_WARMUP = 1;
const FULL_REPS = 7;
const INCREMENTAL_REVS = 3;
const GALLERY_WARMUP = 1;
const GALLERY_REVS = 19;
/** MISSION Stufe 0 — Kill-Gate, Quelle: Missionstext, nicht Repo-Token. */
const GATE_FULL_ROUTE_MS = 50;
const GATE_INCREMENTAL_MS = 4;
/** Provenienz der transkribierten Referenz-Gate-Werte (npm run perf:*). */
const REFERENCE_GATES_DATE = '2026-09-28';

type Percentiles = {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  samples: number;
};

type PlanQuality = {
  edges: number;
  /** Summe der Trassenlängen in px (measureScenario). */
  length: number;
  /** Σ Manhattan-Distanz der Knoten-Mittelpunkte (R-1-Zielnenner). */
  manhattanOptimum: number;
  /** length / manhattanOptimum — R-1-Ziel ≤ 1,3 (Dashboard, kein Gate hier). */
  ratio: number;
  bends: number;
  uTurns: number;
  crossings: number;
  clearanceViolations: number;
  edgeOverlaps: number;
  fallbacks: number;
};

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

function percentiles(values: readonly number[]): Percentiles {
  if (values.length === 0) throw new Error('percentiles: keine Samples');
  const s = [...values].sort((a, b) => a - b);
  const q = (f: number): number => s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0;
  return {
    p50: round3(q(0.5)),
    p95: round3(q(0.95)),
    p99: round3(q(0.99)),
    min: round3(s[0] ?? 0),
    max: round3(s[s.length - 1] ?? 0),
    samples: s.length,
  };
}

const centerOf = (n: Node): { x: number; y: number } => ({
  x: n.position.x + (n.width ?? 192) / 2,
  y: n.position.y + (n.height ?? 120) / 2,
});

function centerMap(nodes: readonly Node[]): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>();
  for (const n of nodes) m.set(n.id, centerOf(n));
  return m;
}

function countFallbacks(result: Map<string, PathResult>): number {
  let n = 0;
  result.forEach((r) => {
    if (r.usedSearch === 'fallback') n += 1;
  });
  return n;
}

/** Full-Route: produktiver Live-Pfad `routeAllCables` über den ganzen Plan. */
function measureFullRoute(
  nodes: readonly Node[],
  edges: readonly RouteEdgeRef[]
): { samples: number[]; fallbacks: number } {
  const asRoutable = nodes as unknown as RoutableNode[];
  const asEdges = edges as RouteEdgeRef[];
  for (let w = 0; w < FULL_WARMUP; w++) routeAllCables(asRoutable, asEdges);
  const samples: number[] = [];
  let fallbacks = 0;
  for (let r = 0; r < FULL_REPS; r++) {
    const t0 = performance.now();
    const result = routeAllCables(asRoutable, asEdges);
    samples.push(performance.now() - t0);
    fallbacks = countFallbacks(result);
  }
  return { samples, fallbacks };
}

type EdgeLite = { id: string; source: string; target: string };

/**
 * Inkrementelle Edits: pro Kante Neubau der Route — Frame-Cache gelesen
 * (`obstaclesExcluding`/`crossingSegmentsExcluding`), dann
 * `buildOrthogonalPath` mit zentrierten Endpunkten und Right/Left-Ports,
 * exakt das Muster von `benchmarks/edgeRoutingPerf.bench.ts` („vorher").
 *
 * Zwei Reihen:
 *   edit     = Cache-Read + Pfadbau (Produktiv-Kosten eines Edits)
 *   pathOnly = nur `buildOrthogonalPath` auf vorbereiteten Inputs
 *              (isoliert die Suche — „hananAStar pro Kante")
 */
function measureIncremental(
  nodes: readonly Node[],
  edges: readonly RouteEdgeRef[],
  revs: number
): { edit: number[]; pathOnly: number[] } {
  const routable = nodes as unknown as RoutableNode[];
  const centers = centerMap(nodes);
  const refs: EdgeLite[] = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));

  // Frame-Caches aufwärmen — dieselbe Konvention wie der Referenz-Bench.
  obstaclesExcluding(routable, new Set<string>());

  const makeInput = (i: number): OrthogonalPathInput | null => {
    const e = edges[i];
    const ref = refs[i];
    if (!e || !ref) return null;
    const source = centers.get(e.source);
    const target = centers.get(e.target);
    if (!source || !target) return null;
    return {
      sourceX: source.x,
      sourceY: source.y,
      sourcePosition: Position.Right,
      targetX: target.x,
      targetY: target.y,
      targetPosition: Position.Left,
      offset: polarityPathOffset(e.sourceHandle),
      obstacles: obstaclesExcluding(routable, new Set([e.source, e.target])),
      crossingSegments: crossingSegmentsExcluding(routable, refs, ref),
    };
  };

  // Warmup beider Reihen (JIT + Caches).
  const prepared: OrthogonalPathInput[] = [];
  for (let i = 0; i < edges.length; i++) {
    const input = makeInput(i);
    if (!input) continue;
    buildOrthogonalPath(input);
    prepared.push(input);
  }

  const editSamples: number[] = [];
  const pathSamples: number[] = [];
  for (let r = 0; r < revs; r++) {
    for (let i = 0; i < edges.length; i++) {
      const t0 = performance.now();
      const input = makeInput(i);
      if (input) buildOrthogonalPath(input);
      editSamples.push(performance.now() - t0);

      const p = prepared[i];
      if (p) {
        const t1 = performance.now();
        buildOrthogonalPath(p);
        pathSamples.push(performance.now() - t1);
      }
    }
  }
  return { edit: editSamples, pathOnly: pathSamples };
}

/** R-1-Dashboard je Plan: measureScenario (Capture/Test-Quelle) + U-Turns + Ratio. */
function planQuality(
  nodes: readonly Node[],
  edges: readonly RouteEdgeRef[],
  routed: readonly RoutedEdge[],
  fallbacks: number
): PlanQuality {
  const m = measureScenario(routed, scenarioNodeRects(nodes));
  const centers = centerMap(nodes);
  let manhattan = 0;
  for (const e of edges) {
    const s = centers.get(e.source);
    const t = centers.get(e.target);
    if (!s || !t) continue;
    manhattan += Math.abs(s.x - t.x) + Math.abs(s.y - t.y);
  }
  const uTurns = routed.reduce((sum, e) => sum + countUTurns(e.waypoints), 0);
  return {
    edges: edges.length,
    length: round3(m.length),
    manhattanOptimum: round3(manhattan),
    ratio: manhattan > 0 ? round3(m.length / manhattan) : 1,
    bends: m.bends,
    uTurns,
    crossings: m.crossings,
    clearanceViolations: m.clearanceViolations,
    edgeOverlaps: m.edgeOverlaps,
    fallbacks,
  };
}

// ─── Teilmengen (a): 15 Regressionspläne ──────────────────────────────────
type RegressionRow = {
  id: string;
  fullRouteMs: Percentiles;
  quality: PlanQuality;
};

function measureRegression(): {
  rows: RegressionRow[];
  fullRoute: Percentiles;
  edit: Percentiles;
  pathOnly: Percentiles;
} {
  const fullAll: number[] = [];
  const editAll: number[] = [];
  const pathAll: number[] = [];
  const rows: RegressionRow[] = [];
  for (const scenario of REGRESSION_SCENARIOS) {
    const full = measureFullRoute(scenario.nodes, scenario.edges);
    fullAll.push(...full.samples);
    const routed = routeScenario(scenario); // frisch, deterministisch (I9) — außerhalb der Timing-Schleife
    rows.push({
      id: scenario.id,
      fullRouteMs: percentiles(full.samples),
      quality: planQuality(scenario.nodes, scenario.edges, routed, full.fallbacks),
    });
    const inc = measureIncremental(scenario.nodes, scenario.edges, INCREMENTAL_REVS);
    editAll.push(...inc.edit);
    pathAll.push(...inc.pathOnly);
  }
  return {
    rows,
    fullRoute: percentiles(fullAll),
    edit: percentiles(editAll),
    pathOnly: percentiles(pathAll),
  };
}

// ─── Teilmengen (b): 25 Galerie-Szenarien (Einzelkanten-Router) ───────────
function measureGallery(): {
  stats: Percentiles;
  quality: ReturnType<typeof buildRoutingQualityReport>;
} {
  for (let w = 0; w < GALLERY_WARMUP; w++) {
    for (const s of ROUTING_SCENARIOS) buildOrthogonalPath(s.input);
  }
  const samples: number[] = [];
  for (let r = 0; r < GALLERY_REVS; r++) {
    for (const s of ROUTING_SCENARIOS) {
      const t0 = performance.now();
      buildOrthogonalPath(s.input);
      samples.push(performance.now() - t0);
    }
  }
  return { stats: percentiles(samples), quality: buildRoutingQualityReport() };
}

// ─── Teilmengen (c): 120 Knoten / 240 Kanten ──────────────────────────────
/**
 * Routbarer Skalenplan nach dem Muster der beiden offiziellen Sonden:
 * - Raster/Abstände wie `benchmarks/routeAllScaling.probe.ts` (`makeNodes`:
 *   Spalte 420 px, Zeile 220 px ⇒ 228 px Luft zwischen 192-px-Karten —
 *   der Abstand, den der Produktiv-ELK-Pfad auch einhält). Das
 *   `edgeRoutingPerf.bench.ts`-Raster (220 px) erzeugt 28-px-Spaltenlücken
 *   und dient nur als Render-Timing-Fixture — gemessen (Stand 2026-09-28):
 *   auf diesem Fixture enden Dutzende Kanten im Pfad-Fallback und die
 *   Invarianten zählen hunderte Verletzungen. Ein Kill-Gate darf nicht auf
 *   einem nicht-routbaren Fixture laufen.
 * - Kantenmuster wie `edgeRoutingPerf.bench.ts` (`buildPlan`): Kanten
 *   n_{i-1-j} → n_i, Typen im 4er-Zyklus, 8 Spalten.
 * Bei 120 Knoten × 2 Nachbarn entstehen 237 Kanten; drei planweite
 * Spannkanten (Batterie → ferne Verbraucher) ergänzen bis exakt 240 und
 * bilden den stressigen Fall „Route-BBox ~ halber Plan" ab.
 */
function buildScalePlan(): { nodes: Node[]; edges: RouteEdgeRef[] } {
  const nodes: Node[] = [];
  for (let i = 0; i < 120; i++) {
    const type = i % 4 === 0 ? 'battery' : i % 4 === 1 ? 'shunt' : i % 4 === 2 ? 'fuse' : 'consumer';
    nodes.push({
      id: `n${i}`,
      type,
      position: { x: (i % 8) * 420, y: Math.floor(i / 8) * 220 },
      width: 192,
      height: 120,
      data: {},
    } as Node);
  }
  const edges: RouteEdgeRef[] = [];
  for (let i = 1; i < nodes.length; i++) {
    for (let j = 0; j < 2; j++) {
      const target = i - 1 - j;
      if (target < 0) break;
      edges.push({
        id: `e${edges.length}`,
        source: `n${target}`,
        target: `n${i}`,
        sourceHandle: 'plus',
        targetHandle: 'plus',
      });
    }
  }
  const spanners: Array<[string, string]> = [
    ['n0', 'n119'],
    ['n0', 'n118'],
    ['n3', 'n117'],
  ];
  for (const [source, target] of spanners) {
    edges.push({
      id: `e-span-${edges.length}`,
      source,
      target,
      sourceHandle: 'plus',
      targetHandle: 'plus',
    });
  }
  if (nodes.length !== 120 || edges.length !== 240) {
    throw new Error(`Scale-Plan erwartet 120/240, bekam ${nodes.length}/${edges.length}`);
  }
  return { nodes, edges };
}

// ─── Zusammenführung ──────────────────────────────────────────────────────
function machineInfo() {
  const cpu = os.cpus()[0];
  return {
    cpu: cpu?.model ?? 'unknown',
    cores: os.cpus().length,
    memGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    node: process.version,
    loadavg1: Math.round((os.loadavg()[0] ?? 0) * 100) / 100,
  };
}

function gitCommit(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null; // Provenienz optional — Messwerte hängen nicht daran.
  }
}

function main(): void {
  console.log('PHASE-0-Baseline (MISSION Stufe 0) — Full-Route, Edits, R-1-Dashboard\n');

  const regression = measureRegression();
  const gallery = measureGallery();
  const scale = buildScalePlan();
  const scaleFull = measureFullRoute(scale.nodes, scale.edges);
  const scaleInc = measureIncremental(scale.nodes, scale.edges, INCREMENTAL_REVS);
  const scaleScenario: RegressionScenario = {
    id: 'phase0-120x240',
    title: 'Phase-0 Skalenplan',
    rationale: 'Mission Stufe 0(c): 120 Knoten / 240 Kanten inkl. Spannkanten.',
    nodes: scale.nodes,
    edges: scale.edges,
  };
  const scaleQuality = planQuality(
    scale.nodes,
    scale.edges,
    routeScenario(scaleScenario),
    scaleFull.fallbacks
  );

  // Kill-Gate (MISSION Stufe 0): evaluiert auf (c), Zusatz (a).
  const gateFullMs = percentiles(scaleFull.samples).p50;
  const gateIncMs = percentiles(scaleInc.edit).p50;
  const gatePassed = gateFullMs <= GATE_FULL_ROUTE_MS && gateIncMs <= GATE_INCREMENTAL_MS;
  const decision = gatePassed
    ? 'Kill-Gate erfüllt: GPU-Track (Stufe 4) wird NICHT gebaut — Weiterarbeit nur Stufen 1–3.'
    : 'Kill-Gate NICHT erfüllt: Stufe 4 darf vorbereitet werden (Flag ROUTING_GPU, ohne CI-Beteiligung); Stufen 1–3 laufen zuerst.';

  const baseline = {
    capturedAt: new Date().toISOString(),
    phase: 'PHASE-0 (MISSION Stufe 0)',
    gitCommit: gitCommit(),
    machine: machineInfo(),
    method: {
      fullRoute: `routeAllCables (produktiver Live-Pfad), Warmup ${FULL_WARMUP} + ${FULL_REPS} Messungen je Plan`,
      incrementalEdit:
        'pro Kante: Frame-Cache-Read (obstaclesExcluding/crossingSegmentsExcluding) + buildOrthogonalPath, zentrierte Endpunkte, Right/Left-Ports (Muster benchmarks/edgeRoutingPerf.bench.ts)',
      pathOnly: 'nur buildOrthogonalPath auf vorbereiteten Inputs (isoliert die Suche pro Kante)',
      gallery: `buildOrthogonalPath(scenario.input), Warmup ${GALLERY_WARMUP} + ${GALLERY_REVS} Wiederholungen × 25 Szenarien`,
      percentiles: 'p50/p95/p99 über ALLE Samples der Teilmenge (sortiert, Index floor(n·q))',
      note: 'Absolute ms sind maschinenabhängig (ADR-0030); Vergleiche nur gegen dieselbe Maschine/Datum.',
    },
    referenceGates: {
      capturedFrom: `npm run perf:edge-routing + npm run perf:route-scaling am ${REFERENCE_GATES_DATE}`,
      edgeRouting: {
        renderPath: { plan: 'N=36 E=134', p50Ms: 1.89, p90Ms: 2.04, budgetMs: 16, ok: true },
        livePath: {
          plan: 'N=36 E=134',
          p50Ms: 40.39,
          p90Ms: 54.28,
          ratchetMs: 60,
          tailRatio: 1.34,
          ok: true,
        },
      },
      routeScaling: {
        chain: [
          { n: 10, e: 9, ms: 0.8 },
          { n: 50, e: 49, ms: 3.4 },
          { n: 100, e: 99, ms: 10.8 },
          { n: 250, e: 249, ms: 39.2 },
          { n: 500, e: 499, ms: 154.1 },
        ],
        worstCaseSpanners: [
          { n: 100, e: 50, ms: 40.3 },
          { n: 250, e: 125, ms: 285.0 },
          { n: 500, e: 250, ms: 2561.3 },
        ],
      },
    },
    subsets: {
      regression15: {
        plans: regression.rows.length,
        fullRouteMs: regression.fullRoute,
        incrementalEditMs: regression.edit,
        pathOnlyMs: regression.pathOnly,
        perPlan: regression.rows,
      },
      gallery25: {
        scenarios: ROUTING_SCENARIOS.length,
        singleRouteMs: gallery.stats,
        quality: gallery.quality,
      },
      scale120x240: {
        nodes: 120,
        edges: 240,
        construction:
          'Raster 420/220 px wie benchmarks/routeAllScaling.probe.ts (makeNodes), Kantenmuster wie edgeRoutingPerf.bench.ts buildPlan (n_{i-1-j}→n_i, 8 Spalten) + 3 Spannkanten n0→n119, n0→n118, n3→n117',
        fullRouteMs: percentiles(scaleFull.samples),
        incrementalEditMs: percentiles(scaleInc.edit),
        pathOnlyMs: percentiles(scaleInc.pathOnly),
        fallbacks: scaleFull.fallbacks,
        quality: scaleQuality,
      },
    },
    killGate: {
      rule: `Full-Route-Median ≤ ${GATE_FULL_ROUTE_MS} ms UND Inkrementell-Median ≤ ${GATE_INCREMENTAL_MS} ms (MISSION Stufe 0), evaluiert auf scale120x240`,
      fullRouteMedianMs: gateFullMs,
      incrementalMedianMs: gateIncMs,
      regressionFullRouteMedianMs: regression.fullRoute.p50,
      regressionIncrementalMedianMs: regression.edit.p50,
      passed: gatePassed,
      decision,
    },
  };

  const out = fileURLToPath(new URL('./baseline.json', import.meta.url));
  writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');

  // ── stdout für PR-Kopie ────────────────────────────────────────────────
  console.log('Teilmengen (p50/p95/p99 in ms):');
  const row = (name: string, full: Percentiles, inc?: Percentiles): void => {
    console.log(
      `  ${name.padEnd(16)} Full p50 ${String(full.p50).padStart(8)}  p95 ${String(full.p95).padStart(8)}  p99 ${String(full.p99).padStart(8)}` +
        (inc
          ? `  | Edit p50 ${String(inc.p50).padStart(7)}  p95 ${String(inc.p95).padStart(7)}  p99 ${String(inc.p99).padStart(7)}`
          : '')
    );
  };
  row('regression15', regression.fullRoute, regression.edit);
  row('scale120x240', percentiles(scaleFull.samples), percentiles(scaleInc.edit));
  console.log(
    `  gallery25         Single p50 ${gallery.stats.p50}  p95 ${gallery.stats.p95}  p99 ${gallery.stats.p99} (${gallery.stats.samples} Samples)`
  );
  console.log('\nR-1-Dashboard Galerie-Szenarien (routingQuality.ts):');
  console.log(formatQualityTable(gallery.quality));
  console.log(
    `\n  worstRatio ${gallery.quality.worstRatio.toFixed(2)} (Ziel ≤ 1,3) · sumUTurns ${gallery.quality.sumUTurns} · sumCrossings ${gallery.quality.sumCrossings} · sumClearanceHits ${gallery.quality.sumClearanceHits}`
  );
  console.log('\nR-1-Dashboard Regressionspläne (measureScenario + countUTurns):');
  for (const r of regression.rows) {
    const q = r.quality;
    console.log(
      `  ${r.id.padEnd(26)} ratio ${String(q.ratio).padStart(5)}  bends ${String(q.bends).padStart(3)}  u ${q.uTurns}  cross ${q.crossings}  cl ${q.clearanceViolations}  ov ${q.edgeOverlaps}  fb ${q.fallbacks}  full-p50 ${r.fullRouteMs.p50} ms`
    );
  }
  const sq = scaleQuality;
  console.log(
    `\n  scale120x240: ratio ${sq.ratio} · bends ${sq.bends} · uTurns ${sq.uTurns} · crossings ${sq.crossings} · clearance ${sq.clearanceViolations} · overlaps ${sq.edgeOverlaps} · fallbacks ${sq.fallbacks}`
  );
  console.log(
    `\nKill-Gate: Full-Route-Median ${gateFullMs} ms ≤ ${GATE_FULL_ROUTE_MS} ms: ${gateFullMs <= GATE_FULL_ROUTE_MS} · ` +
      `Inkrementell-Median ${gateIncMs} ms ≤ ${GATE_INCREMENTAL_MS} ms: ${gateIncMs <= GATE_INCREMENTAL_MS}`
  );
  console.log(`⇒ ${decision}`);
  console.log(`\ngeschrieben: benchmarks/baseline.json (commit ${gitCommit() ?? 'n/a'})`);
}

main();
