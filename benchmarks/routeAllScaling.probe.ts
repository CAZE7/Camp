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
 * Messstand nach dem Fix (diese Maschine, tsx): Kette 500 ≈ 153 ms,
 * Spannkanten 250 ≈ 1,3 s, Spannkanten 500 ≈ 2,8 s — Audit-Baseline für
 * die 500-Knoten-Kette war ~81 200 ms. P-1-Drag-Nachweis (Kette 500, ein
 * Knoten wandert): 499 Kanten, 5 betroffen, 5 neu verlegt, ≈ 121 ms voll
 * gegen ≈ 14 ms inkrementell.
 *
 * Aufruf: npm run perf:route-scaling
 */
import {
  computeAffectedEdgeIds,
  routeAllCables,
  routeIncrementalCables,
  topoKeyOf,
  type RouteEdgeRef,
} from '../components/edges/utils/routeAll';
import type { RoutableNode } from '../components/edges/utils/nodeGeometry';
import { nodeObstacleMap } from '../components/edges/utils/pathfinding';

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

for (const n of [10, 50, 100, 250, 500]) {
  // Warmup klein halten: ein Lauf pro Größe, zweiter für stabilen Wert.
  if (n <= 100) run(n);
  const { ms, fallbacks, routed } = run(n);
  const perEdge = ms / (n - 1);
  console.log(
    `N=${String(n).padStart(3)} E=${String(n - 1).padStart(3)}  ${ms.toFixed(1).padStart(9)} ms  (${perEdge.toFixed(2)} ms/Kante)  geroutet=${routed} fallbacks=${fallbacks}`
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
  const nodes = makeNodes(n);
  const edges = makeSpanEdges(n);
  const t0 = performance.now();
  const result = routeAllCables(nodes, edges);
  const ms = performance.now() - t0;
  let fallbacks = 0;
  result.forEach((r) => {
    if (r.usedSearch === 'fallback') fallbacks++;
  });
  console.log(
    `N=${String(n).padStart(3)} E=${String(edges.length).padStart(3)}  ${ms.toFixed(1).padStart(9)} ms  (${(ms / edges.length).toFixed(2)} ms/Kante)  fallbacks=${fallbacks}`
  );
}

// P-1 (#397): Drag-Nachweis — ein Knoten wandert, Voll-Pass gegen
// inkrementellen Pass. Erwartung: O(betroffen) statt O(E) A*-Läufe,
// der Rest bleibt referenzstabil.
console.log('\nInkrementell: ein Knoten (+30,+20) in der 500er-Kette wandert');
{
  const nodes = makeNodes(500);
  const edges = makeChainEdges(500);
  const routes = routeAllCables(nodes, edges);
  const prev = {
    routes,
    rects: nodeObstacleMap(nodes),
    topo: new Map(edges.map((edge) => [edge.id, topoKeyOf(edge)])),
  };
  const moved = nodes.map((node, i) =>
    i === 250 ? { ...node, position: { x: node.position.x + 30, y: node.position.y + 20 } } : node
  );
  const rects = nodeObstacleMap(moved);
  const affected = computeAffectedEdgeIds(rects, edges, prev);
  const tFull0 = performance.now();
  routeAllCables(moved, edges);
  const fullMs = performance.now() - tFull0;
  let routed = 0;
  const tIncr0 = performance.now();
  routeIncrementalCables(moved, edges, prev, () => routed++);
  const incrMs = performance.now() - tIncr0;
  console.log(
    `E=499  betroffen=${affected.size}  neu-verlegt=${routed}  voll=${fullMs.toFixed(1)} ms  inkrementell=${incrMs.toFixed(1)} ms`
  );
}
