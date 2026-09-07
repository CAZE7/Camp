/**
 * lib/planner/geometry/lanes.ts
 *
 * Deterministic LaneRegistry.
 *
 * The lane of an edge is derived from a stable key:
 *   topologicalRank(source):topologicalRank(target):normalizedHandle:kind:edgeId
 *
 * It is intentionally independent of the order in which acquire() was called.
 */

import type { PlannerEdge } from '../domainModel';
import { topologicalRank } from '../graph/topology';
import { GEOMETRY } from '../tokens';

export type Lane = number;

export type LaneRegistryOptions = {
  /** Maximum number of lanes per corridor. */
  maxLaneSegments?: number;
};

export class LaneRegistry {
  private readonly laneByEdgeId = new Map<string, Lane>();
  private readonly order: string[] = [];
  private readonly options: Required<LaneRegistryOptions>;

  constructor(edges: readonly PlannerEdge[], options: LaneRegistryOptions = {}) {
    this.options = {
      maxLaneSegments: options.maxLaneSegments ?? GEOMETRY.maxLaneSegments,
    };
    this.assignStableLanes(edges);
  }

  /** Deterministic lane for an already registered edge. */
  laneFor(edgeId: string): Lane {
    const lane = this.laneByEdgeId.get(edgeId);
    if (lane === undefined) {
      throw new Error(`LaneRegistry: edge "${edgeId}" is not registered.`);
    }
    return lane;
  }

  /** Canonical processing order for the edges. */
  routeOrder(): readonly string[] {
    return this.order;
  }

  /** Number of lanes currently in use. */
  laneCount(): number {
    return new Set(this.laneByEdgeId.values()).size;
  }

  /** Maximum supported lane segments per corridor. */
  maxLaneSegments(): number {
    return this.options.maxLaneSegments;
  }

  /**
   * Stable key used for ordering. The key is computed from graph topology,
   * normalized handles, kind and finally the edge id. It never depends on the
   * order of the input array.
   */
  static stableKey(
    edge: PlannerEdge,
    rankByNodeId: ReadonlyMap<string, number>,
  ): string {
    const sourceRank = rankByNodeId.get(edge.source) ?? Number.MAX_SAFE_INTEGER;
    const targetRank = rankByNodeId.get(edge.target) ?? Number.MAX_SAFE_INTEGER;
    const sourceHandle = normalizeHandle(edge.sourceHandle);
    const targetHandle = normalizeHandle(edge.targetHandle);
    const kind = edge.kind ?? (edge.type === 'waterPipe' ? 'waterPipe' : 'cable');
    return [sourceRank, targetRank, sourceHandle, targetHandle, kind, edge.id].join(':');
  }

  private assignStableLanes(edges: readonly PlannerEdge[]): void {
    const nodePlaceholder = Array.from(
      new Set(edges.flatMap((edge) => [edge.source, edge.target])),
    ).map(
      (id) => ({ id, type: 'unknown', position: { x: 0, y: 0 }, data: {} }),
    );

    // We only need ranks over ids present in the edge list. If a caller wants
    // ranks for physical nodes too, pass a full graph through the orchestrator.
    const { rankById } = topologicalRank(nodePlaceholder, edges);

    const keys = edges.map((edge) => ({
      edgeId: edge.id,
      key: LaneRegistry.stableKey(edge, rankById),
    }));

    keys.sort((a, b) => compareKeys(a.key, b.key));

    const bucketToLane = new Map<string, Lane>();
    let nextBucket = 0;
    for (const item of keys) {
      let lane = bucketToLane.get(item.key);
      if (lane === undefined) {
        // Use a bounded set of corridor lanes. This keeps lane congestion
        // meaningful while remaining deterministic because the bucket order is
        // based on the stable key, not on the input insertion order.
        lane = nextBucket % this.options.maxLaneSegments;
        nextBucket += 1;
        bucketToLane.set(item.key, lane);
      }
      this.laneByEdgeId.set(item.edgeId, lane);
      this.order.push(item.edgeId);
    }
  }
}

function normalizeHandle(handle: string | undefined | null): string {
  if (!handle) return 'x';
  const lower = handle.toLowerCase();
  if (lower.includes('plus') || lower.includes('right') || lower.includes('input')) return '0';
  if (lower.includes('minus') || lower.includes('left') || lower.includes('output')) return '1';
  if (lower.includes('ground')) return '2';
  return lower
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
