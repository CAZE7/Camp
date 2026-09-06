import { useRef, useLayoutEffect, useSyncExternalStore } from 'react';
import { useStore, useStoreApi, type Node } from 'reactflow';
import { routeAllCables, type RouteEdgeRef } from './routeAll';
import { reroutePreviewAffected } from './routePreview';
import type { PathResult } from './pathfinding';
import { edgeTopologySignature, nodeLayoutSignature } from './orthogonalRouting';

export { edgeTopologySignature, nodeLayoutSignature } from './orthogonalRouting';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DirtyRegion {
  readonly topologicalChange: boolean;
  readonly directlyAffected: ReadonlySet<string>;
  readonly regionalAffected: ReadonlySet<string>;
  readonly allAffectedEdgeIds: ReadonlySet<string>;
}

type NodeSnapshot = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

// ---------------------------------------------------------------------------
// Bounding-Box-Operationen
// ---------------------------------------------------------------------------

const NODE_FALLBACK_W = 192;
const NODE_FALLBACK_H = 120;

const nodeBBox = (node: Node | NodeSnapshot): Rect => {
  const isNodeObj = node instanceof Object && 'positionAbsolute' in node;
  const x = isNodeObj ? (node.positionAbsolute?.x ?? node.position.x) : (node as NodeSnapshot).x;
  const y = isNodeObj ? (node.positionAbsolute?.y ?? node.position.y) : (node as NodeSnapshot).y;
  const width = isNodeObj ? (node.width ?? NODE_FALLBACK_W) : (node as NodeSnapshot).width;
  const height = isNodeObj ? (node.height ?? NODE_FALLBACK_H) : (node as NodeSnapshot).height;
  return { x, y, width, height };
};

const pathBBox = (waypoints: readonly { x: number; y: number }[]): Rect | null => {
  if (!waypoints || waypoints.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of waypoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

// ---------------------------------------------------------------------------
// Snapshot- und Diff-Helfer
// ---------------------------------------------------------------------------

const buildSnapshot = (nodes: Node[]): Map<string, NodeSnapshot> => {
  const map = new Map<string, NodeSnapshot>();
  for (const node of nodes) {
    if (!node) continue;
    map.set(node.id, {
      id: node.id,
      x: node.positionAbsolute?.x ?? node.position.x,
      y: node.positionAbsolute?.y ?? node.position.y,
      width: node.width ?? NODE_FALLBACK_W,
      height: node.height ?? NODE_FALLBACK_H,
    });
  }
  return map;
};

const diffSnapshots = (prev: Map<string, NodeSnapshot>, cur: Map<string, NodeSnapshot>): Set<string> => {
  const changed = new Set<string>();
  for (const [id, curNode] of cur) {
    const prevNode = prev.get(id);
    if (!prevNode) {
      changed.add(id);
    } else if (
      prevNode.x !== curNode.x ||
      prevNode.y !== curNode.y ||
      prevNode.width !== curNode.width ||
      prevNode.height !== curNode.height
    ) {
      changed.add(id);
    }
  }
  for (const id of prev.keys()) {
    if (!cur.has(id)) changed.add(id);
  }
  return changed;
};

// ---------------------------------------------------------------------------
// Dirty-Region-Berechnung (Hebel 1)
// ---------------------------------------------------------------------------

export const computeDirtyRegion = (
  prevSnapshot: Map<string, NodeSnapshot>,
  curNodes: Node[],
  curEdges: RouteEdgeRef[],
  cachedRoutes: Map<string, PathResult>
): DirtyRegion => {
  const curSnapshot = buildSnapshot(curNodes);
  const movedIds = diffSnapshots(prevSnapshot, curSnapshot);

  const directlyAffected = new Set<string>();
  const regionalAffected = new Set<string>();

  const curEdgeIds = new Set<string>(curEdges.map((e) => e.id));
  const cachedIds = new Set<string>(cachedRoutes.keys());
  let topologicalChange = curEdgeIds.size !== cachedIds.size;
  if (!topologicalChange) {
    for (const id of curEdgeIds) {
      if (!cachedIds.has(id)) {
        topologicalChange = true;
        break;
      }
    }
  }
  if (!topologicalChange) {
    for (const id of cachedIds) {
      if (!curEdgeIds.has(id)) {
        topologicalChange = true;
        break;
      }
    }
  }

  if (movedIds.size === 0 && !topologicalChange) {
    return {
      topologicalChange: false,
      directlyAffected,
      regionalAffected,
      allAffectedEdgeIds: regionalAffected,
    };
  }

  if (topologicalChange) {
    for (const edge of curEdges) {
      directlyAffected.add(edge.id);
    }
    return {
      topologicalChange: true,
      directlyAffected,
      regionalAffected: new Set<string>(),
      allAffectedEdgeIds: directlyAffected,
    };
  }

  for (const edge of curEdges) {
    if (movedIds.has(edge.source) || movedIds.has(edge.target)) {
      directlyAffected.add(edge.id);
    }
  }

  const movedNodeRects = new Map<string, { old: Rect | null; neu: Rect | null }>();
  for (const id of movedIds) {
    const prevItem = prevSnapshot.get(id);
    const curItem = curNodes.find((n) => n.id === id) ?? null;
    const oldRect = prevItem ? nodeBBox(prevItem) : null;
    const neuRect = curItem ? nodeBBox(curItem) : null;
    movedNodeRects.set(id, { old: oldRect, neu: neuRect });
  }

  for (const edge of curEdges) {
    if (directlyAffected.has(edge.id)) continue;
    const route = cachedRoutes.get(edge.id);
    if (!route) continue;
    const bbox = pathBBox(route.waypoints);
    if (!bbox) continue;
    for (const [, rects] of movedNodeRects) {
      if ((rects.old && rectsIntersect(bbox, rects.old)) || (rects.neu && rectsIntersect(bbox, rects.neu))) {
        regionalAffected.add(edge.id);
        break;
      }
    }
  }

  const allAffected = new Set<string>([...directlyAffected, ...regionalAffected]);
  return {
    topologicalChange: false,
    directlyAffected,
    regionalAffected,
    allAffectedEdgeIds: allAffected,
  };
};

// ---------------------------------------------------------------------------
// Routing-Qualitätsstufen (Hebel 2)
// ---------------------------------------------------------------------------

/** Volles Routing — volle Qualität mit Nudging, Alignment, Kreuzungsminimierung. */
export const rerouteFull = (nodes: Node[], edges: RouteEdgeRef[]): Map<string, PathResult> =>
  routeAllCables(nodes, edges);

// ---------------------------------------------------------------------------
// Throttling- und Debounce-Helfer
// ---------------------------------------------------------------------------

export const ROUTE_THROTTLE_MS = 100;
export const FULL_REROUTE_DEBOUNCE_MS = 120;

export const createThrottledRunner = (
  run: () => void,
  windowMs: number
): { schedule: () => void; cancel: () => void } => {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule: () => {
      const now = Date.now();
      const elapsed = now - lastRun;
      if (elapsed >= windowMs) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        lastRun = now;
        run();
        return;
      }
      if (!timer) {
        timer = setTimeout(
          () => {
            timer = null;
            lastRun = Date.now();
            run();
          },
          Math.max(0, windowMs - elapsed)
        );
      }
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
};

// ---------------------------------------------------------------------------
// Shared Route-Cache-Store
// ---------------------------------------------------------------------------

let currentRoutes = new Map<string, PathResult>();
const routeListeners = new Set<() => void>();

export const clearCableRoutes = (): void => {
  currentRoutes = new Map<string, PathResult>();
};

export const getCableRoute = (id: string): PathResult | undefined => currentRoutes.get(id);

const subscribe = (cb: () => void): (() => void) => {
  routeListeners.add(cb);
  return () => {
    routeListeners.delete(cb);
  };
};

export const publishCableRoutes = (routes: Map<string, PathResult>): void => {
  currentRoutes = routes;
  routeListeners.forEach((l) => l());
};

export const useCableRoute = (id: string): PathResult | undefined =>
  useSyncExternalStore(
    subscribe,
    () => getCableRoute(id),
    () => undefined
  );

// ---------------------------------------------------------------------------
// Drag-Detektor
// ---------------------------------------------------------------------------

const _DRAG_DETECTION_WINDOW_MS = 200;

type DragDetector = {
  readonly lastTouchMs: number;
  readonly isActive: boolean;
  touch: (now: number) => boolean;
  release: () => void;
};

const createDragDetector = (): DragDetector => {
  let lastTouchMs = 0;
  let isActive = false;
  return {
    get lastTouchMs() {
      return lastTouchMs;
    },
    get isActive() {
      return isActive;
    },
    touch(now: number): boolean {
      const wasActive = isActive;
      lastTouchMs = now;
      isActive = true;
      return wasActive;
    },
    release() {
      isActive = false;
    },
  };
};

// ---------------------------------------------------------------------------
// CableRouteSync — Orchestrierung (Hebel 1 + 2)
// ---------------------------------------------------------------------------

/** `CableRouteSync` orchestrates re-routing with dirty-region awareness and
 * two quality tiers:
 *
 * During drag:
 *   - Compute dirty region (affected edges only)
 *   - Run preview routing (L-stub, no A*, no nudging) on affected edges
 *   - Throttled to max once per 100ms
 *
 * After drag end (120ms debounce):
 *   - Run full routing (all optimizations) on all edges
 *
 * Topological changes (edge add/remove) always trigger full routing immediately.
 */
export const CableRouteSync = () => {
  const plannerStore = useStoreApi();

  const signature = useStore((s) => {
    const nodes = nodeLayoutSignature([...s.nodeInternals.values()]);
    const edges = edgeTopologySignature(s.edges);
    return `${nodes}#${edges}`;
  });

  const snapshotRef = useRef<Map<string, NodeSnapshot>>(new Map<string, NodeSnapshot>());
  const dragDetectorRef = useRef<DragDetector>(createDragDetector());

  // Preview runner (throttled, for during drag)
  const previewRunnerRef = useRef<ReturnType<typeof createThrottledRunner> | null>(null);
  if (previewRunnerRef.current === null) {
    previewRunnerRef.current = createThrottledRunner(() => {
      const state = plannerStore.getState();
      const curNodes = state.getNodes();
      const curEdges = state.edges as RouteEdgeRef[];
      const prevSnapshot = snapshotRef.current;

      const dirty = computeDirtyRegion(prevSnapshot, curNodes, curEdges, currentRoutes);

      if (dirty.topologicalChange) {
        publishCableRoutes(rerouteFull(curNodes, curEdges));
        snapshotRef.current = buildSnapshot(curNodes);
        return;
      }

      if (dirty.allAffectedEdgeIds.size === 0) {
        return;
      }

      const previewRoutes = reroutePreviewAffected(
        curNodes,
        curEdges,
        dirty.allAffectedEdgeIds,
        currentRoutes
      );
      publishCableRoutes(previewRoutes);
      snapshotRef.current = buildSnapshot(curNodes);
    }, ROUTE_THROTTLE_MS);
  }

  // Full runner (throttled, for after drag end)
  const fullRunnerRef = useRef<ReturnType<typeof createThrottledRunner> | null>(null);
  if (fullRunnerRef.current === null) {
    fullRunnerRef.current = createThrottledRunner(() => {
      const state = plannerStore.getState();
      const curNodes = state.getNodes();
      const curEdges = state.edges as RouteEdgeRef[];
      const prevSnapshot = snapshotRef.current;

      const dirty = computeDirtyRegion(prevSnapshot, curNodes, curEdges, currentRoutes);

      if (dirty.topologicalChange) {
        publishCableRoutes(rerouteFull(curNodes, curEdges));
        snapshotRef.current = buildSnapshot(curNodes);
        return;
      }

      if (dirty.allAffectedEdgeIds.size === 0) {
        return;
      }

      publishCableRoutes(rerouteFull(curNodes, curEdges));
      snapshotRef.current = buildSnapshot(curNodes);
    }, ROUTE_THROTTLE_MS);
  }

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRunner = previewRunnerRef.current;
  const fullRunner = fullRunnerRef.current;

  useLayoutEffect(() => {
    const state = plannerStore.getState();
    const curNodes = state.getNodes();
    const curEdges = state.edges as RouteEdgeRef[];
    const curSnapshot = buildSnapshot(curNodes);
    const prevSnapshot = snapshotRef.current;
    const now = Date.now();
    const dragDetector = dragDetectorRef.current;

    const dirty = computeDirtyRegion(prevSnapshot, curNodes, curEdges, currentRoutes);
    snapshotRef.current = curSnapshot;

    if (dirty.topologicalChange) {
      publishCableRoutes(rerouteFull(curNodes, curEdges));
      dragDetector.release();
      return;
    }

    if (dirty.allAffectedEdgeIds.size === 0) {
      if (dragDetector.isActive) {
        dragDetector.release();
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          const state2 = plannerStore.getState();
          const cn2 = state2.getNodes();
          const ce2 = state2.edges as RouteEdgeRef[];
          publishCableRoutes(rerouteFull(cn2, ce2));
          debounceTimerRef.current = null;
        }, FULL_REROUTE_DEBOUNCE_MS);
      }
      return;
    }

    const wasActive = dragDetector.touch(now);

    if (wasActive) {
      // Drag läuft: Preview-Qualität (nur betroffene Kanten, L-Stub, kein A*/Nudge)
      previewRunner.schedule();
    } else {
      // Drag gestoppt: Vollqualität nach Debounce (alle Kanten, mit A*/Nudge/Alignment)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const state2 = plannerStore.getState();
        const cn2 = state2.getNodes();
        const ce2 = state2.edges as RouteEdgeRef[];
        publishCableRoutes(rerouteFull(cn2, ce2));
        debounceTimerRef.current = null;
      }, FULL_REROUTE_DEBOUNCE_MS);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [signature, previewRunner, fullRunner, plannerStore]);

  return null;
};
