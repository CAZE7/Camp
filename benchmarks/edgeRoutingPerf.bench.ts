/**
 * Performance-Audit-Benchmark: Kosten eines vollständigen Kanten-Render-Durchlaufs.
 *
 * Er bildet treu nach, was `CableEdge` pro Render pro Kante macht:
 *   - Hindernis-Rechtecke der übrigen Nodes
 *   - Kreuzungs-Segmente der übrigen Leitungen (nur bis
 *     `CROSSING_SCAN_EDGE_LIMIT` = 120 Kanten, danach übersprungen)
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
import { Node, Position } from 'reactflow';
import {
  nodesToObstacles,
  edgesToCrossingSegments,
  buildOrthogonalPath,
} from '../components/edges/utils/orthogonalRouting';
import { obstaclesExcluding, crossingSegmentsExcluding } from '../components/edges/utils/routingCache';
import { parallelLaneOffset } from '../components/edges/utils/pathUtils';

/** Muss `CROSSING_SCAN_EDGE_LIMIT` in `components/edges/CableEdge.tsx` entsprechen. */
const CROSSING_SCAN_EDGE_LIMIT = 120;

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
      edges.push({ id: `e${edges.length}`, source: `n${target}`, target: `n${i}`, sourceHandle: 'plus', targetHandle: 'plus' });
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
    const obstacles = cached
      ? obstaclesExcluding(nodes, exclude)
      : nodesToObstacles(nodes, exclude);
    const crossingSegments =
      edges.length > CROSSING_SCAN_EDGE_LIMIT
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
    const offset = parallelLaneOffset({ edgeId: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, siblingEdges: edges });
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

console.log('Kanten-Render-Durchlauf: vorher (je Kante neu bauen) vs. nachher (Frame-Cache, PERF-01/02/05)\n');
bench('Klein', 8, 2);
bench('Mittel', 24, 3);
bench('Groß', 60, 4);
bench('Sehr groß', 120, 5);
