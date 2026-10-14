import { legacyRouter } from './legacy';
import { optimizeCableRoutes } from '../../components/edges/utils/optimizeCableRoutes';
import {
  routeAllCables,
  resolveRoutingEndpoints,
  setConflictGraphBatchingForTest,
} from '../../components/edges/utils/routeAll';
import { computeCableRouteFinalValidation } from '../../components/edges/utils/cableRouteStore';
import { nodeObstacleMap, type PathResult } from '../../components/edges/utils/pathfinding';
import { measureRoutingQuality, improvesRoutingQuality } from '../../lib/routing/quality';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import { COST_WEIGHTS } from '../../lib/routing/rules/costModel';
import { countBends, pathLength, type Point } from '../../lib/routing/geometry';
import { compareIds } from '../../lib/sortOrder';
import { routeWithLibavoid } from './libavoid.mjs';
import type { RoutingFixture } from './fixtures';

export type Candidate = 'legacy' | 'baseline' | 'libavoid' | 'rip-up' | 'hybrid';
export const candidates: Candidate[] = ['legacy', 'baseline', 'libavoid', 'rip-up', 'hybrid'];
export function assess(fixture: RoutingFixture, routes: Map<string, PathResult>) {
  const report = computeCableRouteFinalValidation(fixture.nodes, fixture.edges, routes);
  const obstacles = [...nodeObstacleMap(fixture.nodes)].map(([id, rect]) => ({ id, ...rect }));
  const routed = fixture.edges.flatMap((edge) => {
    const result = routes.get(edge.id);
    return result
      ? [{ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints }]
      : [];
  });
  return { report, quality: measureRoutingQuality(routed, obstacles, report) };
}

function fromPolyline(waypoints: Point[]): PathResult {
  return {
    waypoints,
    path: '',
    labelX: 0,
    labelY: 0,
    offsetX: 0,
    offsetY: 0,
    length: pathLength(waypoints),
    bends: countBends(waypoints),
    crossings: 0,
    usedSearch: 'astar',
  };
}

export async function runCandidate(
  name: Candidate,
  fixture: RoutingFixture
): Promise<Map<string, PathResult>> {
  if (name === 'legacy') return (await legacyRouter())(fixture.nodes, fixture.edges);
  if (name === 'libavoid') {
    const endpoints = resolveRoutingEndpoints(fixture.nodes, fixture.edges);
    const output = (await routeWithLibavoid({
      obstacles: [...nodeObstacleMap(fixture.nodes)]
        .sort(([a], [b]) => compareIds(a, b))
        .map(([id, rect]) => ({ id, ...rect })),
      edges: [...fixture.edges]
        .sort((a, b) => compareIds(a.id, b.id))
        .map((edge) => ({
          ...edge,
          from: endpoints.get(edge.id)!.source,
          to: endpoints.get(edge.id)!.target,
          lockedWaypoints: edge.data?.locked ? edge.data.lockedWaypoints : undefined,
        })),
      clearance: ROUTING_TOKENS.cableClearance,
      laneSpacing: ROUTING_TOKENS.laneGrid,
      crossingCost: COST_WEIGHTS.crossing,
      bendCost: COST_WEIGHTS.bend,
    })) as { id: string; waypoints: Point[] }[];
    return new Map(output.map(({ id, waypoints }) => [id, fromPolyline(waypoints)]));
  }
  if (name === 'baseline') return routeAllCables(fixture.nodes, fixture.edges);
  const rerouted = optimizeCableRoutes(fixture.nodes, fixture.edges).routes;
  if (name === 'rip-up') return rerouted;
  // Hybrid: global conflict-component ordering + local search; Pareto acceptance after final validation.
  let ordered: Map<string, PathResult>;
  setConflictGraphBatchingForTest(true);
  try {
    ordered = routeAllCables(fixture.nodes, fixture.edges);
  } finally {
    setConflictGraphBatchingForTest(null);
  }
  return improvesRoutingQuality(assess(fixture, ordered).quality, assess(fixture, rerouted).quality)
    ? ordered
    : rerouted;
}
