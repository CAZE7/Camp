import { useMemo, useLayoutEffect, useSyncExternalStore } from 'react';
import { useStore, useStoreApi } from 'reactflow';
import { routeAllCables, type RouteEdgeRef } from './routeAll';
import type { PathResult } from './pathfinding';

let current = new Map<string, PathResult>();
const listeners = new Set<() => void>();

export const getCableRoute = (id: string): PathResult | undefined => current.get(id);

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const publishCableRoutes = (routes: Map<string, PathResult>): void => {
  current = routes;
  listeners.forEach((l) => l());
};

export const clearCableRoutes = (): void => {
  current = new Map();
};

export function useCableRoute(id: string): PathResult | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getCableRoute(id),
    () => undefined
  );
}

/**
 * Sitzt als Kind von <ReactFlow>, sieht gemessene Nodes/Handles,
 * routet alle Kanten einmal und veröffentlicht das Ergebnis zum Nudging.
 */
export function CableRouteSync() {
  const store = useStoreApi();
  const nodeVersion = useStore((s) => {
    let v = 0;
    s.nodeInternals.forEach((n) => {
      v += n.position.x + n.position.y + (n.width ?? 0) + (n.height ?? 0);
    });
    return v;
  });
  const edgeVersion = useStore((s) =>
    s.edges.map((e) => `${e.id}:${e.source}:${e.target}:${e.sourceHandle}:${e.targetHandle}`).join('|')
  );

  const routes = useMemo(() => {
    const state = store.getState();
    return routeAllCables(state.getNodes(), state.edges as RouteEdgeRef[]);
  }, [nodeVersion, edgeVersion, store]);

  useLayoutEffect(() => {
    publishCableRoutes(routes);
  }, [routes]);

  return null;
}
