import { useRef, useLayoutEffect, useSyncExternalStore } from 'react';
import { useStore, useStoreApi, type Node, type Edge } from 'reactflow';
import { routeAllCables, type RouteEdgeRef } from './routeAll';
import type { PathResult } from './pathfinding';

/**
 * R-9 (Cache-/Re-Routing-Korrektheit): Layout-Signaturen.
 *
 * Die alte `nodeVersion` war die SUMME aller Positionen und Maße — ein
 * Verschieben um (+10, −10) ließ sie unverändert, und die Kabel blieben
 * auf der alten Trasse (stiller Stale-Pfad). Die Signaturen hier sind
 * vollständig: jede Positions-, Größen- oder Topologie-Änderung ändert
 * den String. Move, Resize, Delete, Connect und Undo/Redo laufen damit
 * über dieselbe, inhaltsbasierte Invalidierung.
 */

/** Signatur aller Node-Geometrien (positionAbsolute, width, height). */
export function nodeLayoutSignature(nodes: Node[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (!node) continue;
    parts.push(
      `${node.id}:${node.positionAbsolute?.x ?? node.position.x},${node.positionAbsolute?.y ?? node.position.y}` +
        `:${node.width ?? ''}x${node.height ?? ''}`
    );
  }
  return parts.sort().join('|');
}

/** Signatur der Kantentopologie (id, Enden, Handles). */
export function edgeTopologySignature(
  edges: Pick<Edge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle'>[]
): string {
  return edges
    .map((e) => `${e.id}:${e.source}:${e.target}:${e.sourceHandle ?? ''}:${e.targetHandle ?? ''}`)
    .sort()
    .join('|');
}

/**
 * Drossel für das Live-Re-Routing beim Draggen (R-9): Aufrufe innerhalb
 * des Fensters werden auf einen einzigen trailing-Run zusammengefasst —
 * der Pfad bleibt während des Draggens logisch, ohne jede Frame neu zu
 * rechnen; nach dem Loslassen läuft immer der Endzustand.
 */
export function createThrottledRunner(
  run: () => void,
  windowMs: number
): {
  schedule: () => void;
  cancel: () => void;
} {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(): void {
      const now = Date.now();
      const elapsed = now - last;
      if (elapsed >= windowMs) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        last = now;
        run();
        return;
      }
      if (!timer) {
        timer = setTimeout(
          () => {
            timer = null;
            last = Date.now();
            run();
          },
          Math.max(0, windowMs - elapsed)
        );
      }
    },
    cancel(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/** Drossel-Fenster des Live-Re-Routings (ms). */
export const ROUTE_THROTTLE_MS = 100;

let current = new Map<string, PathResult>();
const listeners = new Set<() => void>();

/** Alle zwischengespeicherten Routen verwerfen (Reset/Tests, R-9). */
export const clearCableRoutes = (): void => {
  current = new Map<string, PathResult>();
};

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
  // R-9: inhaltsbasierte Signatur (Move/Resize/Delete/Connect/Undo/Redo
  // ändern sie zuverlässig — die alte Positionssumme tat das nicht).
  const signature = useStore((s) => {
    const nodes = nodeLayoutSignature([...s.nodeInternals.values()]);
    const edges = edgeTopologySignature(s.edges);
    return `${nodes}#${edges}`;
  });

  // R-9: Live-Re-Routing gedrosselt — während des Draggens ändert sich die
  // Signatur pro Frame; Rechnen UND Veröffentlichen laufen so höchstens
  // alle ROUTE_THROTTLE_MS plus ein garantiertes trailing nach dem
  // Loslassen (Endzustand immer aktuell).
  const runnerRef = useRef<ReturnType<typeof createThrottledRunner> | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createThrottledRunner(() => {
      const state = store.getState();
      publishCableRoutes(routeAllCables(state.getNodes(), state.edges as RouteEdgeRef[]));
    }, ROUTE_THROTTLE_MS);
  }

  useLayoutEffect(() => {
    const runner = runnerRef.current;
    if (runner) runner.schedule();
    return () => runner?.cancel();
  }, [signature]);

  return null;
}
