/**
 * lib/planner/routing-core/costModel.ts
 *
 * Weighted routing cost model.
 *
 * IMPORTANT: routeCost() must receive the actual collision, lane congestion and
 * hop counts produced by the candidate simulation. It must NOT be called with
 * empty/default collision data — otherwise the engine would optimize only by
 * length and bends and ignore the core V2 requirements.
 */

import type { Point } from '../domainModel';
import type { RouteCandidateScore, RoutePath } from './types';
import { COST_WEIGHTS, ROUTING } from '../tokens';
import { countBends, pathLength } from '../geometry/collision';

export type CostWeights = {
  readonly lengthPerMeter: number;
  readonly bend: number;
  readonly routeSegment: number;
  readonly collision: number;
  readonly laneCongestion: number;
  readonly hop: number;
  readonly laneHop: number;
};

export type PathCostInput = {
  readonly path: Pick<RoutePath, 'points'>;
  readonly collision?: number;
  readonly laneCongestion?: number;
  readonly hops?: number;
  readonly segmentCount?: number;
};

export type PathCost = {
  readonly length: number;
  readonly bends: number;
  readonly collision: number;
  readonly laneCongestion: number;
  readonly hops: number;
  readonly cost: number;
};

export function defaultCostWeights(): CostWeights {
  return { ...COST_WEIGHTS };
}

/**
 * Evaluates a path using all cost dimensions. The collision/lane/hops fields are
 * intentionally read from the input; an empty simulation yields zero cost for
 * those dimensions, but the caller must supply the real simulation when using
 * this in routing.
 */
export function routeCost(input: PathCostInput, weights: CostWeights = defaultCostWeights()): PathCost {
  const points = input.path.points;
  const length = pathLength(points) / ROUTING.pxPerMeter;
  const bends = countBends(points);
  const segmentCount = Math.max(0, points.length - 1);

  const collision = input.collision ?? 0;
  const laneCongestion = input.laneCongestion ?? 0;
  const hops = input.hops ?? 0;
  const segments = input.segmentCount ?? segmentCount;

  const cost =
    length * weights.lengthPerMeter +
    bends * weights.bend +
    segments * weights.routeSegment +
    collision * weights.collision +
    laneCongestion * weights.laneCongestion +
    hops * weights.hop;

  return {
    length,
    bends,
    collision,
    laneCongestion,
    hops,
    cost,
  };
}

/**
 * Ranks candidates deterministically by cost, then by edge id and candidate id.
 * Every candidate is required to have been evaluated with the full simulation.
 */
export function selectBestPath(candidates: readonly RouteCandidateScore[]): RouteCandidateScore | undefined {
  if (candidates.length === 0) return undefined;

  const sorted = [...candidates].sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.edgeId !== b.edgeId) return a.edgeId < b.edgeId ? -1 : 1;
    return a.candidateId < b.candidateId ? -1 : 1;
  });

  return sorted[0];
}

/**
 * Small helper for tests and humans: let the caller see which dimensions moved
 * the result before applying the selector.
 */
export function scoreCandidate(
  edgeId: string,
  candidateId: string,
  points: readonly Point[],
  input: PathCostInput,
  weights: CostWeights = defaultCostWeights()
): RouteCandidateScore {
  const cost = routeCost({ ...input, path: { points } }, weights);
  return {
    edgeId,
    candidateId,
    collision: cost.collision,
    laneCongestion: cost.laneCongestion,
    hops: cost.hops,
    cost: cost.cost,
  };
}
