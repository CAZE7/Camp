import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { checkInvariants, type RoutedEdge, type NodeRect } from '../../lib/routing/invariants';
import { nodeObstacleMap } from '../../components/edges/utils/pathfinding';

export function runBenchmark() {
  const results = [];

  for (const [name, plan] of Object.entries(GOLDEN_PLANS)) {
    const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
    if (!wired) continue;
    const nodes = wired.nodes as never;
    const edges = wired.edges as never as RouteEdgeRef[];

    // Warmup
    routeAllCables(nodes, edges);

    // Benchmark duration
    const runs = 20;
    const start = performance.now();
    let routes = new Map();
    for (let i = 0; i < runs; i++) {
      routes = routeAllCables(nodes, edges);
    }
    const durationMs = (performance.now() - start) / runs;

    const routed: RoutedEdge[] = [];
    let totalLength = 0;
    let totalBends = 0;
    let totalCrossings = 0;

    for (const [id, r] of routes) {
      const edge = edges.find((e) => e.id === id);
      if (edge) {
        routed.push({
          id,
          source: edge.source,
          target: edge.target,
          waypoints: r.waypoints,
        });
      }
      totalLength += r.length;
      totalBends += r.bends;
      totalCrossings += r.crossings;
    }

    const obstacleById = nodeObstacleMap(nodes);
    const rects: NodeRect[] = [];
    for (const node of nodes) {
      const rect = obstacleById.get(node.id);
      if (rect) rects.push({ id: node.id, ...rect });
    }

    const report = checkInvariants(routed, rects);

    results.push({
      plan: name,
      components: (nodes as unknown[]).length,
      cables: edges.length,
      durationMs: Number(durationMs.toFixed(2)),
      totalLength: Math.round(totalLength),
      totalBends,
      crossings: totalCrossings,
      I1_Collisions: report.I1.length,
      I2_Overlaps: report.I2.length,
      I3_Clearance: report.I3.length,
      status:
        report.I1.length === 0 && report.I2.length === 0 && report.I3.length === 0 ? 'VALID' : 'INVALID',
    });
  }

  return results;
}

if (process.argv[1]?.endsWith('runRoutingBenchmark.ts')) {
  const res = runBenchmark();
  console.table(res);
  writeFileSync(resolve(process.cwd(), 'docs/routing/benchmark-results.json'), JSON.stringify(res, null, 2));
}
