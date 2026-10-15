import { routeAllCables, type RouteEdgeRef } from './routeAll';
import type { RoutableNode } from './nodeGeometry';
import { nodeObstacleMap, type PathResult } from './pathfinding';
import { computeCableRouteFinalValidation } from './routeValidation';
import {
  improvesRoutingQuality,
  measureRoutingQuality,
  type RoutingQuality,
} from '../../../lib/routing/quality';
import { compareIds } from '../../../lib/sortOrder';
import { isRouteLocked } from '../../../lib/electricalGraph/intent';

/** Work budget established by the 28-plan benchmark. No claim of a wall-clock deadline. */
export const GLOBAL_REROUTE_ATTEMPTS = 4;
export type OptimizationSummary = {
  attempted: number;
  accepted: number;
  budgetExhausted: boolean;
  before: RoutingQuality;
  after: RoutingQuality;
};

/**
 * Explicit global optimization, NOT a drag-frame operation.
 * Always starts from the canonical initial pass: repeated optimize is idempotent,
 * not a ratchet that gets another four chances on every click.
 */
export function optimizeCableRoutes(
  nodes: RoutableNode[],
  edges: RouteEdgeRef[]
): {
  routes: Map<string, PathResult>;
  summary: OptimizationSummary;
} {
  let routes = routeAllCables(nodes, edges);
  const obstacles = [...nodeObstacleMap(nodes)].map(([id, rect]) => ({ id, ...rect }));
  const assess = (candidate: Map<string, PathResult>) => {
    const report = computeCableRouteFinalValidation(nodes, edges, candidate);
    const routed = edges.flatMap((edge) => {
      const route = candidate.get(edge.id);
      return route
        ? [{ id: edge.id, source: edge.source, target: edge.target, waypoints: route.waypoints }]
        : [];
    });
    return { report, quality: measureRoutingQuality(routed, obstacles, report) };
  };
  let current = assess(routes);
  const before = current.quality;
  const priority = new Map(edges.map((edge) => [edge.id, routes.get(edge.id)?.crossings ?? 0]));
  for (const violation of current.report.violations) {
    priority.set(violation.edgeId, (priority.get(violation.edgeId) ?? 0) + 1);
    if (violation.otherId && priority.has(violation.otherId))
      priority.set(violation.otherId, priority.get(violation.otherId)! + 1);
  }
  const invalidIds = new Set([
    ...current.report.violations.flatMap((violation) => [
      violation.edgeId,
      ...(violation.otherId ? [violation.otherId] : []),
    ]),
    ...(current.report.contractViolations ?? []).map((violation) => violation.edgeId),
    ...(current.report.lockedRouteViolations ?? []).map((violation) => violation.edgeId),
  ]);
  const work = edges
    .filter((edge) => !isRouteLocked(edge))
    .sort(
      (a, b) =>
        Number(invalidIds.has(b.id)) - Number(invalidIds.has(a.id)) ||
        (priority.get(b.id) ?? 0) - (priority.get(a.id) ?? 0) ||
        compareIds(a.id, b.id)
    );
  let attempted = 0;
  let accepted = 0;
  for (const edge of work.slice(0, GLOBAL_REROUTE_ATTEMPTS)) {
    const preservedRoutes = new Map(routes);
    preservedRoutes.delete(edge.id);
    const candidate = routeAllCables(nodes, edges, { preservedRoutes });
    attempted++;
    const next = assess(candidate);
    if (improvesRoutingQuality(next.quality, current.quality)) {
      routes = candidate;
      current = next;
      accepted++;
    }
  }
  return {
    routes,
    summary: {
      before,
      after: current.quality,
      attempted,
      accepted,
      budgetExhausted: work.length > attempted,
    },
  };
}
