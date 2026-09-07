/**
 * lib/planner/routing-core/types.ts
 *
 * Shared types for Route V2 candidate generation, cost evaluation and selection.
 */

import type { Point } from '../domainModel';
import type { Lane } from '../geometry/lanes';

export type RoutePath = {
  readonly edgeId: string;
  readonly points: readonly Point[];
};

export type RouteCandidate = {
  readonly id: string;
  readonly edgeId: string;
  readonly points: readonly Point[];
  readonly sourceHandle?: string;
  readonly targetHandle?: string;
  readonly lane?: Lane;
};

export type RouteCandidateScore = {
  readonly edgeId: string;
  readonly candidateId: string;
  readonly collision: number;
  readonly laneCongestion: number;
  readonly hops: number;
  readonly cost: number;
};

export type CollisionSimulation = {
  readonly edgeNodeCollisions: number;
  readonly edgeEdgeCollisions: number;
  readonly laneCongestion: number;
  readonly requiredHops: number;
};

export type RenderedEdge = {
  readonly edgeId: string;
  readonly points: readonly Point[];
};

export type RoutedEdgeMetrics = {
  readonly edgeId: string;
  readonly length: number;
  readonly bends: number;
  readonly collisions: number;
  readonly crossings: number;
  readonly hops: number;
  readonly cost: number;
};

export type RoutingV2Result = {
  readonly edges: readonly RenderedEdge[];
  readonly metrics: readonly RoutedEdgeMetrics[];
  readonly diagnostics: {
    readonly totalCollisions: number;
    readonly totalCrossings: number;
    readonly totalHops: number;
    readonly maxEdgeNodeCollisions: number;
    readonly maxEdgeEdgeOverlaps: number;
    readonly minClearance: number;
    readonly deterministic: boolean;
    readonly elapsedMs: number;
  };
};
