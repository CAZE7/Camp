import { Node, Edge } from 'reactflow';
import { NODE_FALLBACK_WIDTH, NODE_FALLBACK_HEIGHT, Point, Rect, Segment } from './orthogonalRouting';

/**
 * Caches the node bounding boxes once per `nodes` array reference.
 *
 * Why this matters (Mission 5 / Performance): every `CableEdge` needs the
 * obstacle rectangle of every *other* node to route around it. Previously each
 * of the E edges rebuilt the full N-rectangle list on every render, i.e.
 * O(E × N) per frame. During a node drag React Flow hands the store a new
 * `nodes` array on every frame (applyNodeChanges), so the cache below is
 * recomputed once per frame — but every edge in that frame shares the same
 * array reference and therefore reuses the same Map. The hot-path cost drops
 * from O(E × N) rectangle constructions to O(N) once + O(E) cheap filters.
 *
 * `WeakMap` keys by array reference: the moment the previous array is garbage
 * collected the entry is too, so there is no unbounded growth across drags.
 * Reference identity is a safe proxy for content because applyNodeChanges /
 * setNodes always hand out a *new* array on update.
 */
const OBSTACLE_MAP_CACHE = new WeakMap<Node[], Map<string, Rect>>();

/** Returns the nodeId → bounding-box map, built once per `nodes` array. */
export function getObstacleMap(nodes: Node[]): Map<string, Rect> {
  let map = OBSTACLE_MAP_CACHE.get(nodes);
  if (!map) {
    map = new Map<string, Rect>();
    for (const node of nodes) {
      if (!node) continue;
      map.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: node.width || NODE_FALLBACK_WIDTH,
        height: node.height || NODE_FALLBACK_HEIGHT,
      });
    }
    OBSTACLE_MAP_CACHE.set(nodes, map);
  }
  return map;
}

/** Obstacle rectangles of all nodes except the given excluded ids. */
export function obstaclesExcluding(nodes: Node[], excludeIds: Set<string>): Rect[] {
  const map = getObstacleMap(nodes);
  const out: Rect[] = [];
  map.forEach((rect, id) => {
    if (excludeIds.has(id)) return;
    out.push(rect);
  });
  return out;
}

/**
 * ---- Crossing-scan cache (PERF-04) ----
 *
 * `CableEdge` previously called `edgesToCrossingSegments` per edge on every
 * render. That function rebuilt the node-centre map (O(N)) and iterated *all*
 * edges (O(E)) for *each* of the E edges → O(E·(N+E)) per frame, and in the
 * active scan range (≤ CROSSING_SCAN_EDGE_LIMIT) that quadratic term is what
 * dominates a node drag.
 *
 * Here we build the invariant base ONCE per (nodes, edges) array reference —
 * the node centres and one centre-to-centre segment per edge — and only apply
 * the caller's per-edge `skip` predicate on top. The geometry does not depend
 * on which edge asks, so it is safe to share across all E edges of the same
 * frame. `WeakMap` keys on the array references, which React Flow replaces on
 * every update, so a stale entry is never reused and collections are reclaimed
 * when the previous arrays are garbage collected.
 */
type CrossingBase = {
  /** nodeId → centre of the node's bounding box. */
  centers: Map<string, Point>;
  /** One entry per edge: the segment plus its endpoint ids (for the skip). */
  items: CrossingItem[];
};

type CrossingItem = {
  /** Endpunkt-IDs, wie sie die Kante führt (used by the skip predicate). */
  source: string;
  target: string;
  segment: Segment;
};

/** Key is the `edges` array; value is keyed by the `nodes` array of that snapshot. */
const CROSSING_BASE_CACHE = new WeakMap<Edge[], WeakMap<Node[], CrossingBase>>();

type CrossingEdgeRef = { id: string; source: string; target: string };

function buildCrossingBase(nodes: Node[], edges: CrossingEdgeRef[]): CrossingBase {
  const centers = new Map<string, Point>();
  for (const node of nodes) {
    if (!node) continue;
    centers.set(node.id, {
      x: node.position.x + (node.width || NODE_FALLBACK_WIDTH) / 2,
      y: node.position.y + (node.height || NODE_FALLBACK_HEIGHT) / 2,
    });
  }

  const items: CrossingItem[] = [];
  for (const edge of edges) {
    const a = centers.get(edge.source);
    const b = centers.get(edge.target);
    if (!a || !b) continue;
    items.push({ source: edge.source, target: edge.target, segment: [a, b] });
  }
  return { centers, items };
}

function getCrossingBase(nodes: Node[], edges: CrossingEdgeRef[]): CrossingBase {
  let byNodes = CROSSING_BASE_CACHE.get(edges as unknown as Edge[]);
  if (!byNodes) {
    byNodes = new WeakMap<Node[], CrossingBase>();
    CROSSING_BASE_CACHE.set(edges as unknown as Edge[], byNodes);
  }
  let base = byNodes.get(nodes);
  if (!base) {
    base = buildCrossingBase(nodes, edges);
    byNodes.set(nodes, base);
  }
  return base;
}

/**
 * Crossing line segments of *other* edges, excluding the current edge and any
 * edge sharing the same node pair. Equivalent to the old per-edge
 * `edgesToCrossingSegments(...)` call, but the expensive base (node centres +
 * segments) is computed once per frame instead of once per edge. The per-edge
 * work reduces to an O(E) filter over the shared segment list.
 */
export function crossingSegmentsExcluding(
  nodes: Node[],
  edges: CrossingEdgeRef[],
  current: CrossingEdgeRef
): Segment[] {
  const { items } = getCrossingBase(nodes, edges);

  const included: Segment[] = [];
  for (const item of items) {
    const samePair =
      (item.source === current.source && item.target === current.target) ||
      (item.source === current.target && item.target === current.source);
    if (samePair) continue;
    included.push(item.segment);
  }
  return included;
}
