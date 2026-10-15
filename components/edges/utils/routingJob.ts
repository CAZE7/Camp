import type { RoutingSnapshot } from '../../../lib/routing/model';
import { routeAllCables } from './routeAll';
import { optimizeCableRoutes, type OptimizationSummary } from './optimizeCableRoutes';
import { routingSnapshotNodes } from './routingSnapshot';
import type { PathResult } from './pathfinding';

export type RoutingJob = { snapshot: RoutingSnapshot; optimize: boolean };
export type RoutingJobResult = { routes: [string, PathResult][]; optimization?: OptimizationSummary };
export type RoutingJobReply = { result: RoutingJobResult; error?: never } | { error: string; result?: never };

export function runRoutingJob(job: RoutingJob): RoutingJobResult {
  const nodes = routingSnapshotNodes(job.snapshot);
  if (job.optimize) {
    const result = optimizeCableRoutes(nodes, job.snapshot.edges);
    return { routes: [...result.routes], optimization: result.summary };
  }
  return { routes: [...routeAllCables(nodes, job.snapshot.edges)] };
}
