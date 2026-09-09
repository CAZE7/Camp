/**
 * PERF-001-Verifikationsprobe (Audit 2026-09): Skalierung von routeAllCables.
 *
 * Nachbau des Audit-Szenarios: Batterie/Busbar/Consumer-Grid, vollständiger
 * Neuaufbau aller Routen in einem Pass. Gemessen wird die Wandzeit je
 * Plangröße sowie die Zahl der Fallback-Ergebnisse (usedSearch='fallback').
 * Zusatz „Worst Case": planweite Spannkanten (Route-BBox ~ halber Plan) —
 * das Szenario, das vor dem Fix vom 2026-09-08 (`buildHananGridMasks` +
 * distanzfreies `segmentHitsAny` + `countCrossings`-BBox-Vorfilter)
 * 203 s für 250 Knoten brauchte.
 *
 * Messstand nach dem Fix (diese Maschine, tsx, Median aus 3 Läufen —
 * Neustand 2026-09-09, siehe Ausgabe): Audit-Baseline für die
 * 500-Knoten-Kette war ~81 200 ms.
 *
 * Streuung beachten: große Pläne (Spannkanten) schwanken einzelmessungs-
 * weise um mehr als Faktor 2, daher Mehrfachmessung statt Einzellauf.
 *
 * Aufruf: npm run perf:route-scaling
 */
import { routeAllCables, type RouteEdgeRef } from '../components/edges/utils/routeAll';
import type { RoutableNode } from '../components/edges/utils/nodeGeometry';

const COL_W = 420;
const ROW_H = 220;
const COLS = 10;

const makeNodes = (n: number): RoutableNode[] => {
  const nodes: RoutableNode[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const type = i === 0 ? 'battery' : i % COLS === 0 ? 'busbar' : 'consumer';
    nodes.push({
      id: `n${i}`,
      type,
      position: { x: col * COL_W, y: row * ROW_H },
      data: {},
      width: 192,
      height: 120,
    } as RoutableNode);
  }
  return nodes;
};

const makeChainEdges = (n: number): RouteEdgeRef[] => {
  const edges: RouteEdgeRef[] = [];
  for (let i = 0; i < n - 1; i++) {
    edges.push({
      id: `e${String(i).padStart(4, '0')}`,
      source: `n${i}`,
      target: `n${i + 1}`,
      sourceHandle: 'plus',
      targetHandle: 'plus',
      data: { edgeDomain: 'DC_12V', crossSection: 16 },
    });
  }
  return edges;
};

const run = (n: number) => {
  const nodes = makeNodes(n);
  const edges = makeChainEdges(n);
  const t0 = performance.now();
  const result = routeAllCables(nodes, edges);
  const ms = performance.now() - t0;
  let fallbacks = 0;
  result.forEach((r) => {
    if (r.usedSearch === 'fallback') fallbacks++;
  });
  return { ms, fallbacks, routed: result.size };
};

/**
 * Mehrfachmessung: die großen Pläne sind Einzelmessungen zu unstet
 * (GC/JIT streuen hier um Faktor >2). Gemeldet wird der Median von
 * `runs` Läufen, dazu Minimum und Maximum als Streumaß.
 */
const measure = (build: () => { nodes: RoutableNode[]; edges: RouteEdgeRef[] }, runs = 3) => {
  const samples: { ms: number; routed: number; fallbacks: number }[] = [];
  for (let i = 0; i < runs; i++) {
    const { nodes, edges } = build();
    const t0 = performance.now();
    const result = routeAllCables(nodes, edges);
    const ms = performance.now() - t0;
    let fallbacks = 0;
    result.forEach((r) => {
      if (r.usedSearch === 'fallback') fallbacks++;
    });
    samples.push({ ms, routed: result.size, fallbacks });
  }
  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const last = samples[samples.length - 1]!;
  return {
    median: ms[Math.floor(ms.length / 2)]!,
    min: ms[0]!,
    max: ms[ms.length - 1]!,
    routed: last.routed,
    fallbacks: last.fallbacks,
  };
};

for (const n of [10, 50, 100, 250, 500]) {
  run(n); // Warmup (JIT) — geht nicht in die Messung ein
  const { median, min, max, routed, fallbacks } = measure(() => ({
    nodes: makeNodes(n),
    edges: makeChainEdges(n),
  }));
  const perEdge = median / (n - 1);
  console.log(
    `N=${String(n).padStart(3)} E=${String(n - 1).padStart(3)}  ${median.toFixed(1).padStart(9)} ms  (${perEdge.toFixed(2)} ms/Kante)` +
      `  median/min/max ${min.toFixed(1)}/${max.toFixed(1)}  geroutet=${routed} fallbacks=${fallbacks}`
  );
}

console.log('\nWorst Case: planweite Spannkanten (n_i → n_{i+N/2}, Route-BBox ~ halber Plan)');
const makeSpanEdges = (n: number): RouteEdgeRef[] => {
  const edges: RouteEdgeRef[] = [];
  for (let i = 0; i < n / 2; i++) {
    edges.push({
      id: `s${String(i).padStart(4, '0')}`,
      source: `n${i}`,
      target: `n${i + Math.floor(n / 2)}`,
      sourceHandle: 'plus',
      targetHandle: 'plus',
      data: { edgeDomain: 'DC_12V', crossSection: 16 },
    });
  }
  return edges;
};

for (const n of [100, 250, 500]) {
  routeAllCables(makeNodes(n), makeSpanEdges(n)); // Warmup
  const { median, min, max, fallbacks } = measure(() => ({
    nodes: makeNodes(n),
    edges: makeSpanEdges(n),
  }));
  const edges = makeSpanEdges(n);
  console.log(
    `N=${String(n).padStart(3)} E=${String(edges.length).padStart(3)}  ${median.toFixed(1).padStart(9)} ms` +
      `  (${(median / edges.length).toFixed(2)} ms/Kante)  median/min/max ${min.toFixed(1)}/${max.toFixed(1)}  fallbacks=${fallbacks}`
  );
}
