/**
 * lib/planner/routing-v2/orchestrator.ts
 *
 * Route V2 pipeline.
 *
 * For every edge:
 *   1. build candidates from the obstacle-aware corridor graph,
 *   2. simulate edge-node and edge-edge collisions,
 *   3. evaluate real routing costs,
 *   4. select the best candidate deterministically,
 *   5. register it as routed and continue.
 *
 * This module intentionally imports nothing from React Flow, ELK or dagre.
 */

import type { PlannerEdge, PlannerNode, PlannerNodeData, Point } from '../domainModel';
import { buildNodeLookup } from '../graph/nodeLookup';
import { LaneRegistry } from '../geometry/lanes';
import { buildCorridorGraph } from '../geometry/corridor';
import {
  bboxFromNode,
  boundingBoxOfNodes,
  classifyEdgeEdgeIntersections,
  classifySegments,
  countEdgeNodeCollisions,
  minEdgeNodeClearance,
  pointsToSegments,
} from '../geometry/collision';
import { rerouteCrossings } from './hopping';
import { generateRoutingCandidates } from '../routing-core/candidates';
import { defaultCostWeights, routeCost, selectBestPath, type CostWeights } from '../routing-core/costModel';
import type {
  RouteCandidate,
  RouteCandidateScore,
  RoutedEdgeMetrics,
  RoutingV2Result,
} from '../routing-core/types';
import { GEOMETRY, ROUTING } from '../tokens';

export type RouteOrchestratorOptions = {
  readonly weights?: CostWeights;
  readonly maxCandidates?: number;
  readonly grid?: number;
  readonly maxIterations?: number;
  readonly bounds?: { x: number; y: number; width: number; height: number };
};

export type RouteOrchestratorInput = {
  readonly nodes: readonly PlannerNode<PlannerNodeData>[];
  readonly edges: readonly PlannerEdge[];
  readonly options?: RouteOrchestratorOptions;
};

type RoutedEdge = {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceHandle?: string;
  readonly targetHandle?: string;
  readonly points: readonly Point[];
  readonly collisionCount: number;
  readonly overlapCount: number;
  readonly crossingCount: number;
  readonly cost: number;
};

export function routeAllEdges(input: RouteOrchestratorInput): RoutingV2Result {
  const startedAt = now();
  const nodes = input.nodes;
  const edges = input.edges;
  const options = input.options ?? {};
  const weights = options.weights ?? defaultCostWeights();
  const lookup = buildNodeLookup(nodes);
  const laneRegistry = new LaneRegistry(edges);
  const nodeBBoxes = nodes.map((node) => ({
    nodeId: node.id,
    bbox: bboxFromNode(node),
  }));
  const bounds = options.bounds ?? boundingBoxOfNodes(nodes, ROUTING.searchPadding);

  const routedEdges: RoutedEdge[] = [];
  const metrics: RoutedEdgeMetrics[] = [];

  const routeOrder = laneRegistry.routeOrder();
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const ordered = routeOrder
    .map((edgeId) => edgesById.get(edgeId))
    .filter((edge): edge is PlannerEdge => edge !== undefined);

  for (const edge of ordered) {
    const sourceNode = lookup.get(edge.source);
    const targetNode = lookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      // Keep the run deterministic: skip unroutable edges but still report.
      metrics.push({
        edgeId: edge.id,
        length: Number.POSITIVE_INFINITY,
        bends: Number.POSITIVE_INFINITY,
        collisions: Number.POSITIVE_INFINITY,
        crossings: Number.POSITIVE_INFINITY,
        hops: Number.POSITIVE_INFINITY,
        cost: Number.POSITIVE_INFINITY,
      });
      continue;
    }

    const graph = buildCorridorGraph(nodes, [edge.source, edge.target], {
      grid: options.grid ?? GEOMETRY.laneGrid,
      padding: ROUTING.searchPadding,
      bounds,
    });

    const candidates = generateRoutingCandidates({
      graph,
      edgeId: edge.id,
      sourceNode,
      targetNode,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      weights,
      maxCandidates: options.maxCandidates ?? ROUTING.maxCandidatesPerEdge,
      routed: routedEdges.map((routed) => ({
        edgeId: routed.edgeId,
        points: routed.points,
      })),
    });

    const scored = scoreCandidates(candidates, edge, routedEdges, laneRegistry, nodeBBoxes, weights);

    const bestScore = selectBestPath(scored) as ScoredWithExtras | undefined;
    if (!bestScore) continue;

    const bestCandidate = candidates.find((candidate) => candidate.id === bestScore.candidateId);
    if (!bestCandidate) continue;

    routedEdges.push({
      edgeId: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      points: bestCandidate.points,
      collisionCount: bestScore.collision,
      overlapCount: bestScore.scoredOverlaps,
      crossingCount: bestScore.hops,
      cost: bestScore.cost,
    });

    metrics.push({
      edgeId: edge.id,
      length: routeCost({ path: { points: bestCandidate.points } }, weights).length,
      bends: routeCost({ path: { points: bestCandidate.points } }, weights).bends,
      collisions: bestScore.collision,
      crossings: bestScore.hops,
      hops: bestScore.addedHopCount,
      cost: bestScore.cost,
    });
  }

  const refinedEdges = refineCrossings(routedEdges, nodes, laneRegistry, nodeBBoxes, bounds, weights, {
    grid: options.grid ?? GEOMETRY.laneGrid,
    padding: ROUTING.searchPadding,
    maxCandidates: options.maxCandidates ?? ROUTING.maxCandidatesPerEdge,
  });

  const hopped = rerouteCrossings(
    refinedEdges.map((edge) => ({
      edgeId: edge.edgeId,
      points: edge.points,
    }))
  );

  const finalEdges = hopped.edges.map((edge) => {
    const routed = refinedEdges.find((candidate) => candidate.edgeId === edge.edgeId);
    return {
      edgeId: edge.edgeId,
      sourceNodeId: routed?.sourceNodeId ?? '',
      targetNodeId: routed?.targetNodeId ?? '',
      points: edge.points,
      collisionCount: routed?.collisionCount ?? 0,
      overlapCount: routed?.overlapCount ?? 0,
      crossingCount: routed?.crossingCount ?? 0,
      cost: routed?.cost ?? Number.POSITIVE_INFINITY,
    };
  });

  const diagnostics = {
    ...computeFinalDiagnostics(finalEdges, nodeBBoxes),
    elapsedMs: now() - startedAt,
  };

  const finalMetrics = metrics.map((metric) => {
    const edge = finalEdges.find((candidate) => candidate.edgeId === metric.edgeId);
    if (!edge) return metric;
    return {
      ...metric,
      crossings: computeCrossingCountForEdge(finalEdges, edge.edgeId),
      hops: metric.hops,
    };
  });

  return {
    edges: finalEdges.map((edge) => ({
      edgeId: edge.edgeId,
      points: edge.points,
    })),
    metrics: finalMetrics,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type ScoredWithExtras = RouteCandidateScore & {
  readonly scoredOverlaps: number;
  readonly addedHopCount: number;
};

function scoreCandidates(
  candidates: readonly RouteCandidate[],
  edge: PlannerEdge,
  routedEdges: readonly RoutedEdge[],
  laneRegistry: LaneRegistry,
  nodeBBoxes: readonly { nodeId: string; bbox: { x: number; y: number; width: number; height: number } }[],
  weights: CostWeights
): ScoredWithExtras[] {
  const lane = laneRegistry.laneFor(edge.id);
  const routedSegments = new Map(
    routedEdges.map((routed) => [routed.edgeId, pointsToSegments(routed.points)])
  );
  const routedBounds = new Map(routedEdges.map((routed) => [routed.edgeId, boundsOfPoints(routed.points)]));

  return candidates.map((candidate) => {
    const edgeNodeCollisions = countEdgeNodeCollisions(
      edge.id,
      candidate.points,
      nodeBBoxes,
      [edge.source, edge.target],
      GEOMETRY.cableClearance
    ).length;

    const candidateSegments = pointsToSegments(candidate.points);
    const candidateBounds = boundsOfPoints(candidate.points);
    let overlapCount = 0;
    let crossingCount = 0;
    let laneCongestion = 0;

    for (const routed of routedEdges) {
      const bounds = routedBounds.get(routed.edgeId);
      if (bounds && !rectsOverlap(candidateBounds, bounds)) continue;

      const { overlaps, crossings } = classifySegments(
        edge.id,
        candidateSegments,
        routed.edgeId,
        routedSegments.get(routed.edgeId) ?? []
      );

      overlapCount += overlaps.length;
      crossingCount += crossings.length;

      if (laneRegistry.laneFor(routed.edgeId) === lane && (overlaps.length > 0 || crossings.length > 0)) {
        laneCongestion += 1;
      }
    }

    const cost = routeCost(
      {
        path: { points: candidate.points },
        collision: edgeNodeCollisions + overlapCount,
        laneCongestion,
        hops: crossingCount,
      },
      weights
    );

    return {
      edgeId: edge.id,
      candidateId: candidate.id,
      collision: cost.collision,
      laneCongestion: cost.laneCongestion,
      hops: cost.hops,
      cost: cost.cost,
      scoredOverlaps: overlapCount,
      addedHopCount: crossingCount,
    };
  });
}

const MAX_REFINEMENT_PASSES = 3;

type RefinementRouteOptions = {
  readonly grid: number;
  readonly padding: number;
  readonly maxCandidates: number;
};

/**
 * Rip-up and re-route refinement. Only edges that still create crossings or
 * overlaps are re-routed against the other currently routed edges. This is the
 * industrial "avoid crossings at selection time" step; hopping then only deals
 * with the genuinely unavoidable remainder.
 */
function refineCrossings(
  routedEdges: readonly RoutedEdge[],
  nodes: readonly PlannerNode<PlannerNodeData>[],
  laneRegistry: LaneRegistry,
  nodeBBoxes: readonly { nodeId: string; bbox: { x: number; y: number; width: number; height: number } }[],
  bounds: { x: number; y: number; width: number; height: number },
  weights: CostWeights,
  routeOptions: RefinementRouteOptions
): RoutedEdge[] {
  const lookup = buildNodeLookup(nodes);
  let current = [...routedEdges];

  for (let pass = 0; pass < MAX_REFINEMENT_PASSES; pass += 1) {
    const crossingEdgeIds = collectInterferingEdgeIds(current);
    if (crossingEdgeIds.size === 0) break;

    let changed = false;

    for (const edgeId of Array.from(crossingEdgeIds)) {
      const oldEdge = current.find((edge) => edge.edgeId === edgeId);
      if (!oldEdge) continue;

      const sourceNode = lookup.get(oldEdge.sourceNodeId);
      const targetNode = lookup.get(oldEdge.targetNodeId);
      if (!sourceNode || !targetNode) continue;

      const oldInterference = interferenceCountForEdge(current, edgeId);
      const otherEdges = current.filter((edge) => edge.edgeId !== edgeId);

      const graph = buildCorridorGraph(nodes, [oldEdge.sourceNodeId, oldEdge.targetNodeId], {
        grid: routeOptions.grid,
        padding: routeOptions.padding,
        bounds,
      });

      const candidates = generateRoutingCandidates({
        graph,
        edgeId,
        sourceNode,
        targetNode,
        sourceHandle: oldEdge.sourceHandle,
        targetHandle: oldEdge.targetHandle,
        weights,
        maxCandidates: routeOptions.maxCandidates,
        routed: otherEdges.map((edge) => ({
          edgeId: edge.edgeId,
          points: edge.points,
        })),
      });

      const edgeLike: PlannerEdge = {
        id: edgeId,
        source: oldEdge.sourceNodeId,
        target: oldEdge.targetNodeId,
        sourceHandle: oldEdge.sourceHandle,
        targetHandle: oldEdge.targetHandle,
      };

      const scored = scoreCandidates(candidates, edgeLike, otherEdges, laneRegistry, nodeBBoxes, weights);
      const bestScore = selectBestPath(scored) as ScoredWithExtras | undefined;
      if (!bestScore) continue;

      const bestCandidate = candidates.find((candidate) => candidate.id === bestScore.candidateId);
      if (!bestCandidate) continue;

      const candidateEdge: RoutedEdge = {
        ...oldEdge,
        points: bestCandidate.points,
        collisionCount: bestScore.collision,
        overlapCount: bestScore.scoredOverlaps,
        crossingCount: bestScore.hops,
        cost: bestScore.cost,
      };

      const newInterference = interferenceCountForEdge([...otherEdges, candidateEdge], edgeId);

      if (newInterference < oldInterference) {
        current = current.map((edge) => (edge.edgeId === edgeId ? candidateEdge : edge));
        changed = true;
      }
    }

    if (!changed) break;
  }

  return current;
}

function collectInterferingEdgeIds(edges: readonly RoutedEdge[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const { crossings, overlaps } = classifyEdgeEdgeIntersections(
        edges[i]!.edgeId,
        edges[i]!.points,
        edges[j]!.edgeId,
        edges[j]!.points
      );
      if (crossings.length > 0 || overlaps.length > 0) {
        ids.add(edges[i]!.edgeId);
        ids.add(edges[j]!.edgeId);
      }
    }
  }
  return ids;
}

function interferenceCountForEdge(edges: readonly RoutedEdge[], edgeId: string): number {
  const edge = edges.find((candidate) => candidate.edgeId === edgeId);
  if (!edge) return Number.POSITIVE_INFINITY;

  let count = 0;
  for (const other of edges) {
    if (other.edgeId === edgeId) continue;
    const { crossings, overlaps } = classifyEdgeEdgeIntersections(
      edge.edgeId,
      edge.points,
      other.edgeId,
      other.points
    );
    count += crossings.length + overlaps.length;
  }
  return count;
}

function computeFinalDiagnostics(
  finalEdges: readonly RoutedEdge[],
  nodeBBoxes: readonly { nodeId: string; bbox: { x: number; y: number; width: number; height: number } }[]
): RoutingV2Result['diagnostics'] {
  let totalCollisions = 0;
  let totalCrossings = 0;
  let totalHops = 0;
  let maxEdgeNodeCollisions = 0;
  let maxEdgeEdgeOverlaps = 0;

  const edgeNodeByEdge = new Map<string, number>();
  const edgeOverlapByEdge = new Map<string, number>();
  const edgeCrossingByEdge = new Map<string, number>();

  for (const edge of finalEdges) {
    const excluded = [edge.sourceNodeId, edge.targetNodeId];
    const edgeNode = countEdgeNodeCollisions(
      edge.edgeId,
      edge.points,
      nodeBBoxes,
      excluded,
      GEOMETRY.cableClearance
    ).length;
    edgeNodeByEdge.set(edge.edgeId, edgeNode);
    maxEdgeNodeCollisions = Math.max(maxEdgeNodeCollisions, edgeNode);
  }

  for (let i = 0; i < finalEdges.length; i += 1) {
    for (let j = i + 1; j < finalEdges.length; j += 1) {
      const a = finalEdges[i]!;
      const b = finalEdges[j]!;
      const { crossings, overlaps } = classifyEdgeEdgeIntersections(a.edgeId, a.points, b.edgeId, b.points);
      edgeOverlapByEdge.set(a.edgeId, (edgeOverlapByEdge.get(a.edgeId) ?? 0) + overlaps.length);
      edgeOverlapByEdge.set(b.edgeId, (edgeOverlapByEdge.get(b.edgeId) ?? 0) + overlaps.length);
      edgeCrossingByEdge.set(a.edgeId, (edgeCrossingByEdge.get(a.edgeId) ?? 0) + crossings.length);
      edgeCrossingByEdge.set(b.edgeId, (edgeCrossingByEdge.get(b.edgeId) ?? 0) + crossings.length);
      maxEdgeEdgeOverlaps = Math.max(
        maxEdgeEdgeOverlaps,
        edgeOverlapByEdge.get(a.edgeId) ?? 0,
        edgeOverlapByEdge.get(b.edgeId) ?? 0
      );
      totalCrossings += crossings.length;
      totalHops += crossings.length;
    }
  }

  for (const edge of finalEdges) {
    const edgeNode = edgeNodeByEdge.get(edge.edgeId) ?? 0;
    const edgeOverlap = edgeOverlapByEdge.get(edge.edgeId) ?? 0;
    totalCollisions += edgeNode + edgeOverlap;
    maxEdgeEdgeOverlaps = Math.max(maxEdgeEdgeOverlaps, edgeOverlap);
  }

  let minClearance = Number.POSITIVE_INFINITY;
  for (const edge of finalEdges) {
    const excluded = [edge.sourceNodeId, edge.targetNodeId];
    minClearance = Math.min(minClearance, minEdgeNodeClearance(edge.points, nodeBBoxes, excluded));
  }
  if (!Number.isFinite(minClearance)) minClearance = Number.POSITIVE_INFINITY;

  return {
    totalCollisions,
    totalCrossings,
    totalHops,
    maxEdgeNodeCollisions,
    maxEdgeEdgeOverlaps,
    minClearance,
    deterministic: true,
    elapsedMs: 0,
  };
}

function computeCrossingCountForEdge(finalEdges: readonly RoutedEdge[], edgeId: string): number {
  let count = 0;
  for (const edge of finalEdges) {
    if (edge.edgeId === edgeId) continue;
    const { crossings } = classifyEdgeEdgeIntersections(
      edgeId,
      finalEdges.find((entry) => entry.edgeId === edgeId)?.points ?? [],
      edge.edgeId,
      edge.points
    );
    count += crossings.length;
  }
  return count;
}

function boundsOfPoints(points: readonly Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function rectsOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return (
    a.minX <= b.maxX + 1e-9 && a.maxX >= b.minX - 1e-9 && a.minY <= b.maxY + 1e-9 && a.maxY >= b.minY - 1e-9
  );
}

function now(): number {
  if (typeof performance !== 'undefined' && 'now' in performance) {
    return performance.now();
  }
  return Date.now();
}
