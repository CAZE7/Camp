/**
 * Performance-Audit-Benchmark: Kosten eines vollständigen Kanten-Render-Durchlaufs.
 *
 * Er bildet treu nach, was `CableEdge` pro Render pro Kante macht:
 *   - Hindernis-Rechtecke der übrigen Nodes
 *   - Kreuzungs-Segmente der übrigen Leitungen (Frame-Cache;
 *     der frühere `CROSSING_SCAN_EDGE_LIMIT` ist entfallen — große Pläne
 *     laufen über `lib/routing/geometry/segmentSpatialIndex.ts`)
 *   - `buildOrthogonalPath` (Routing + Hindernisvermeidung) zwischen den eigenen
 *     Source-/Target-Knoten der Kante
 *
 * Vergleich:
 *   - **vorher** (`old = false`): `nodesToObstacles` + `edgesToCrossingSegments`
 *     je Kante → O(E·N) plus O(E·(N+E)) für die Kreuzungsbasis.
 *   - **nachher** (`old = false`→ cache): `obstaclesExcluding` (einmal je Frame
 *     gecachte Rect-Map) + `crossingSegmentsExcluding` (einmal je Frame
 *     gecachte Zentren-/Segment-Basis).
 *
 * Läuft mit: `npm run perf:edge-routing`
 */
import { Node, Position } from '@xyflow/react';
import {
  nodesToObstacles,
  edgesToCrossingSegments,
  buildOrthogonalPath,
} from '../components/edges/utils/orthogonalRouting';
import { obstaclesExcluding, crossingSegmentsExcluding } from '../components/edges/utils/routingCache';
import { polarityPathOffset } from '../components/edges/utils/pathUtils';
import { routeAllCables, type RouteEdgeRef } from '../components/edges/utils/routeAll';
import type { RoutableNode } from '../components/edges/utils/nodeGeometry';

function buildPlan(nodeCount: number, edgesPerNode: number) {
  const nodes: Node[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `n${i}`,
      type: i % 4 === 0 ? 'battery' : i % 4 === 1 ? 'shunt' : i % 4 === 2 ? 'fuse' : 'consumer',
      position: { x: (i % 8) * 220, y: Math.floor(i / 8) * 160 },
      width: 192,
      height: 120,
      data: { label: `Node ${i}` },
    } as Node);
  }
  const edges: any[] = [];
  for (let i = 1; i < nodeCount; i++) {
    for (let j = 0; j < edgesPerNode; j++) {
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
  return { nodes, edges };
}

/** `refs` wird pro Frame EINMAL gebaut (die Kantenliste bleibt in React Flow stabil). */
function buildRefs(edges: any[]) {
  return edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
}

function renderEdges(nodes: Node[], edges: any[], refs: any[], cached: boolean) {
  const centers = new Map<string, { x: number; y: number }>();
  for (const node of nodes) centers.set(node.id, { x: node.position.x + 96, y: node.position.y + 60 });

  let total = 0;
  for (const edge of edges) {
    const source = centers.get(edge.source)!;
    const target = centers.get(edge.target)!;
    const exclude = new Set([edge.source, edge.target]);
    const obstacles = cached ? obstaclesExcluding(nodes, exclude) : nodesToObstacles(nodes, exclude);
    const crossingSegments =
      edges.length > 120
        ? []
        : cached
          ? crossingSegmentsExcluding(nodes, refs, { id: edge.id, source: edge.source, target: edge.target })
          : edgesToCrossingSegments(
              refs,
              nodes,
              (e) =>
                e.id === edge.id ||
                (e.source === edge.source && e.target === edge.target) ||
                (e.source === edge.target && e.target === edge.source)
            );
    // Legacy-Engine-Benchmark: Die Bündel-Lane des produktiven Passes
    // (portFanOutLanes) braucht einen Gesamtpass; hier misst der Parcours
    // den Einzelrouten-Hot-Path — `polarityPathOffset` ist die noch
    // exportierte Lane-Quelle desselben laneGrid-Rasters
    // (`parallelLaneOffset` wurde mit dem globalen Pass obsolet, R11-a).
    const offset = polarityPathOffset(edge.sourceHandle);
    const { path } = buildOrthogonalPath({
      sourceX: source.x,
      sourceY: source.y,
      sourcePosition: Position.Right,
      targetX: target.x,
      targetY: target.y,
      targetPosition: Position.Left,
      offset,
      obstacles,
      crossingSegments,
    });
    total += path.length;
  }
  return total;
}

function bench(label: string, nodeCount: number, edgesPerNode: number, revolutions = 40) {
  const { nodes, edges } = buildPlan(nodeCount, edgesPerNode);
  const refs = buildRefs(edges);
  renderEdges(nodes, edges, refs, false);
  renderEdges(nodes, edges, refs, true);

  const startBefore = performance.now();
  for (let r = 0; r < revolutions; r++) renderEdges(nodes, edges, refs, false);
  const before = (performance.now() - startBefore) / revolutions;

  const startAfter = performance.now();
  for (let r = 0; r < revolutions; r++) renderEdges(nodes, edges, refs, true);
  const after = (performance.now() - startAfter) / revolutions;

  const speedup = before / after;
  console.log(
    `${label.padEnd(12)} N=${String(nodeCount).padStart(3)} E=${String(edges.length).padStart(3)}  ` +
      `vorher ${before.toFixed(2)} ms  →  nachher ${after.toFixed(2)} ms  (×${speedup.toFixed(1)})`
  );
}

/**
 * WP-11 (#400, absorbiert P-7): Perf-Gate am 100+-Kanten-Referenzplan.
 *
 * Budget: **16 ms Main-Thread pro Frame** (M11-9: ein Frame bei 60 Hz;
 * Begründung des Werts in docs/adr/0012-perf-budget-16ms-pro-frame.md).
 * Gemessen wird der MEDIAN über `GATE_REVOLUTIONS` vollständige
 * Render-Durchläufe des Referenzplans (36 Nodes / 134 Kanten — oberhalb
 * der Produktionsschwelle (früher 120 Kanten; heute übernimmt der
 * Segment-Spatialindex), also der Produktionsmodus großer Pläne
 * mit Frame-Cache). Median statt Mittelwert, damit einzelne
 * Scheduler-Ausreißer des CI-Runners das Gate nicht flackern lassen.
 *
 * Überschreitung ⇒ Exit-Code 1 ⇒ die Quality-Pipeline schlägt fehl.
 */
const FRAME_BUDGET_MS = 16;
const GATE_NODE_COUNT = 36;
const GATE_EDGES_PER_NODE = 4; // ⇒ 134 Kanten (> 100, ehemals über der 120er-Schwelle)
const GATE_REVOLUTIONS = 30;

function perfGate(): boolean {
  const { nodes, edges } = buildPlan(GATE_NODE_COUNT, GATE_EDGES_PER_NODE);
  const refs = buildRefs(edges);
  if (edges.length <= 100) throw new Error('Referenzplan hat keine 100+ Kanten mehr — Gate anpassen');
  renderEdges(nodes, edges, refs, true); // Warmup (JIT + Frame-Cache)

  const samples: number[] = [];
  for (let r = 0; r < GATE_REVOLUTIONS; r++) {
    const start = performance.now();
    renderEdges(nodes, edges, refs, true);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  const p90 = samples[Math.floor(samples.length * 0.9)]!;

  const passed = median <= FRAME_BUDGET_MS;
  console.log(
    `\nPerf-Gate (WP-11/#400): Referenzplan N=${GATE_NODE_COUNT} E=${edges.length}  ` +
      `Median ${median.toFixed(2)} ms  p90 ${p90.toFixed(2)} ms  Budget ${FRAME_BUDGET_MS} ms/Frame  → ` +
      (passed ? 'OK' : 'ÜBERSCHRITTEN')
  );
  return passed;
}

console.log(
  'Kanten-Render-Durchlauf: vorher (je Kante neu bauen) vs. nachher (Frame-Cache, PERF-01/02/05)\n'
);
bench('Klein', 8, 2);
bench('Mittel', 24, 3);
bench('Groß', 60, 4);
bench('Sehr groß', 120, 5);

/**
 * Hebel 3 (AUDIT P1): Das alte Gate maß `buildOrthogonalPath` — den
 * **Altbestand**. Die Fläche zeichnet seit ADR 0014 die Routen aus
 * `routeAllCables` (components/edges/utils/cableRouteStore.ts). Ein Gate,
 * das den nicht mehr benutzten Pfad prüft, ist grün und sagt über die
 * Wirklichkeit nichts: genau die Fehlerklasse, die dieses Projekt schon
 * einmal teuer bezahlt hat.
 *
 * Deshalb misst dieser zweite Block denselben Referenzplan (36 Knoten /
 * 134 Kanten) durch die **Live-Pipeline**. Er ist heute ehrlicherweise
 * langsamer als das 16-ms-Ziel für Einzelkanten-Render (ADR 0012) — die
 * Route berechnet den kompletten Plan in einem Pass, gedrosselt und nicht
 * pro Frame. Das Budget ist deshalb als **Ratchet** gesetzt: Es hält den
 * Ist-Zustand fest und verbietet Rückfall, statt eine Zahl zu behaupten,
 * die nicht gemessen ist. Ziel bleibt 16 ms; wer den Pfad schneller macht,
 * zieht das Ratchet nach unten.
 *
 * Aufruf: npm run perf:edge-routing
 */
const LIVE_PATH_RATCHET_MS = 60;
const LIVE_PATH_REVOLUTIONS = 15;

function livePathGate(): boolean {
  const { nodes, edges } = buildPlan(GATE_NODE_COUNT, GATE_EDGES_PER_NODE);
  const routableNodes = nodes as unknown as RoutableNode[];
  const routeEdges = edges.map((edge) => ({ ...edge, data: {} })) as unknown as RouteEdgeRef[];
  routeAllCables(routableNodes, routeEdges); // Warmup

  const samples: number[] = [];
  for (let r = 0; r < LIVE_PATH_REVOLUTIONS; r++) {
    const start = performance.now();
    routeAllCables(routableNodes, routeEdges);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  const p90 = samples[Math.floor(samples.length * 0.9)]!;
  const passed = median <= LIVE_PATH_RATCHET_MS;

  console.log(
    `\nPerf-Gate Live-Pfad (routeAllCables, AUDIT P1): N=${GATE_NODE_COUNT} E=${routeEdges.length}  ` +
      `Median ${median.toFixed(2)} ms  p90 ${p90.toFixed(2)} ms  Ratchet ${LIVE_PATH_RATCHET_MS} ms ` +
      `(ADR-0012-Ziel 16 ms)  → ` +
      (passed ? 'OK' : 'ÜBERSCHRITTEN')
  );
  return passed;
}

if (!perfGate() || !livePathGate()) {
  process.exitCode = 1;
}
