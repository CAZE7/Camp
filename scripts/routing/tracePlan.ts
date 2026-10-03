/**
 * scripts/routing/tracePlan.ts
 *
 * Rohdaten-Ausgabe eines Referenzplans: Node-Boxen, Ports, Lanes und die
 * vollständigen Wegpunkte aller gerouteten Kanten. Diagnose-Werkzeug für die
 * Root-Cause-Analyse der I3-Restfälle (Punkt 1).
 *
 *   npx tsx scripts/routing/tracePlan.ts camper
 *   npx tsx scripts/routing/tracePlan.ts camper e-fuse-usb e-fuse-cool
 */
import { performAutoWiring } from '../../lib/autoWire';
import {
  portFanOutLanes,
  resolveHandlePoint,
  routeAllCables,
  type RouteEdgeRef,
} from '../../components/edges/utils/routeAll';
import { nodesToObstacles } from '../../components/edges/utils/pathfinding';
import { nodeHeight, nodeOriginX, nodeOriginY, nodeWidth } from '../../components/edges/utils/nodeGeometry';
import { simplifyWaypoints } from '../../lib/routing/geometry';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

type Wired = Parameters<typeof nodesToObstacles>[0];

const planName = process.argv[2] ?? 'camper';
const filter = process.argv.slice(3);
const plan = GOLDEN_PLANS[planName]!;
const wired = performAutoWiring(plan.nodes as never, plan.edges as never)!;
const nodes = wired.nodes as never as Wired;
const edges = wired.edges as never as RouteEdgeRef[];
const routes = routeAllCables(nodes as never, edges);

const resolve = (edge: RouteEdgeRef, kind: 'source' | 'target') =>
  resolveHandlePoint(
    nodes.find((n) => (n as { id: string }).id === (kind === 'source' ? edge.source : edge.target)),
    kind === 'source' ? edge.sourceHandle : edge.targetHandle,
    kind
  );
const lanes = portFanOutLanes(edges, resolve);

console.log(`### Plan ${planName}`);
console.log('### Nodes (Boxen wie der Router sie als Hindernis sieht)');
for (const node of nodes) {
  const [rect] = nodesToObstacles([node], new Set<string>());
  console.log(
    `  ${(node as { id: string }).id.padEnd(22)} origin=(${nodeOriginX(node).toFixed(1)},${nodeOriginY(node).toFixed(1)}) ` +
      `size=${nodeWidth(node, 172).toFixed(0)}x${nodeHeight(node, 96).toFixed(0)} rect=(${rect!.x.toFixed(1)},${rect!.y.toFixed(1)},${rect!.width.toFixed(1)},${rect!.height.toFixed(1)})`
  );
}

console.log('### Kanten');
for (const edge of edges) {
  const route = routes.get(edge.id);
  if (!route) {
    console.log(`  ${edge.id}: KEINE ROUTE`);
    continue;
  }
  const lane = lanes.get(edge.id);
  const relevant = filter.length === 0 || filter.includes(edge.id);
  if (!relevant) continue;
  const src = resolve(edge, 'source');
  const tgt = resolve(edge, 'target');
  console.log(
    `\n  ${edge.id}  ${edge.source} → ${edge.target}  search=${route.usedSearch} len=${route.length.toFixed(1)} x=${route.crossings}` +
      `  lane=${lane?.lane ?? 0}(r${lane?.laneRank ?? '-'},t${lane?.laneTie ?? '-'}) laneTarget=${lane?.laneTarget ?? 0}(r${lane?.laneTargetRank ?? '-'},t${lane?.laneTargetTie ?? '-'})`
  );
  console.log(`     srcPort=(${src.x.toFixed(1)},${src.y.toFixed(1)}) ${src.position}   tgtPort=(${tgt.x.toFixed(1)},${tgt.y.toFixed(1)}) ${tgt.position}`);
  const pts = simplifyWaypoints(route.waypoints);
  console.log(`     waypoints(${pts.length}): ${pts.map((p) => `(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(' → ')}`);
}
