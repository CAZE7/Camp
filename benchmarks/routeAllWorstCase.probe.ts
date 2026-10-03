/**
 * benchmarks/routeAllWorstCase.probe.ts
 *
 * Einzelmessung des Worst-Case-Szenarios aus `routeAllScaling.probe.ts`
 * (planweite Spannkanten) — als Profiling-Einstieg:
 *
 *   npx tsx benchmarks/routeAllWorstCase.probe.ts 500
 *   node --cpu-prof --cpu-prof-dir=/tmp/prof ... (über tsx)
 *
 * Zweck: Hotspot-Suche für Punkt 2 des Finalisierungs-Auftrags. Reine
 * Messung, keine Seiteneffekte.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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

const n = Number(process.argv[2] ?? 500);
const runs = Number(process.argv[3] ?? 1);

for (let i = 0; i < runs; i++) {
  const nodes = makeNodes(n);
  const edges = makeSpanEdges(n);
  const t0 = performance.now();
  const result = routeAllCables(nodes, edges);
  const ms = performance.now() - t0;
  let fallbacks = 0;
  result.forEach((r) => {
    if (r.usedSearch === 'fallback') fallbacks++;
  });
  console.log(`N=${n} E=${edges.length}  ${ms.toFixed(1)} ms  geroutet=${result.size} fallbacks=${fallbacks}`);
}

if (process.env.CAMP_PROBE_DUMP) {
  mkdirSync('/tmp/camp-probe', { recursive: true });
  const nodes = makeNodes(n);
  const edges = makeSpanEdges(n);
  const result = routeAllCables(nodes, edges);
  const rows: string[] = [];
  for (const edge of edges) {
    const r = result.get(edge.id);
    if (!r) continue;
    rows.push(`${edge.id}\t${r.usedSearch}\t${r.waypoints.map((p) => `${p.x},${p.y}`).join(' ')}`);
  }
  writeFileSync('/tmp/camp-probe/routes-500.tsv', rows.join('\n'));
  console.log(`Dump: /tmp/camp-probe/routes-500.tsv (${rows.length} Routen)`);
}
