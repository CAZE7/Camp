import { useRef, useLayoutEffect, useSyncExternalStore } from 'react';
import { useStore, useStoreApi, type Edge } from '@xyflow/react';
import {
  measuredHeight,
  measuredWidth,
  nodeOriginX,
  nodeOriginY,
  type GeometryNode,
  type RoutableNode,
} from './nodeGeometry';
import { nodeObstacleMap } from './pathfinding';
import { validateFinalRouting, type FinalValidationReport } from '../../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';
import {
  routeAllCables,
  routeIncrementalCables,
  topoKeyOf,
  type RouteEdgeRef,
  type RoutePrevState,
} from './routeAll';
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

/** Signatur aller Node-Geometrien (absolute Position, gemessene Maße). */
export function nodeLayoutSignature(nodes: ({ id: string } & GeometryNode)[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (!node) continue;
    parts.push(
      `${node.id}:${nodeOriginX(node)},${nodeOriginY(node)}` +
        `:${measuredWidth(node) ?? ''}x${measuredHeight(node) ?? ''}`
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

/**
 * Präsentations-Nodes nehmen nicht am Routing teil.
 *
 * Die Backbone-Gruppe (`BACKBONE_GROUP_TYPE` in
 * `planner/utils/backboneGroup.ts`, hier bewusst als Literal mit Rückverweis
 * statt als Import — diese Schicht hängt an keinen Präsentations-Modulen)
 * ist eine reine Darstellungs-Box HINTER dem Hauptstromkreis. Lief sie in den
 * Routing-Pass, wurde sie zum Hindernis: Ihre Box umschließt Batterie, Shunt
 * und Sammelschienen — jede Kern-Leitung startete IN einem Hindernis und wich
 * in weiten Bögen aus. Da sich die Box mit jeder Messungs-Runde ihrer
 * Mitglieder verschob, routete der globale Pass wiederholt um („Kabel
 * springen nach Auto-Wire dauerhaft um“) und die Final-Validation meldete
 * Geister-Kollisionen gegen die Gruppe. Filterung an dieser einen Stelle
 * heilt Signatur, Routing und Validation gleichzeitig.
 */
const PRESENTATION_NODE_TYPE = 'backboneGroup';

export function isPresentationNode(node: { type?: unknown }): boolean {
  return node.type === PRESENTATION_NODE_TYPE;
}

export function withoutPresentationNodes<T extends { type?: unknown }>(nodes: readonly T[]): T[] {
  return nodes.filter((node) => !isPresentationNode(node));
}

let current = new Map<string, PathResult>();
const listeners = new Set<() => void>();

/** Final-Validation-Report des zuletzt gerouteten Plans (AUDIT F-07). */
let currentValidation: FinalValidationReport | undefined;
const validationListeners = new Set<() => void>();

/**
 * P-1 (#397): Stand des letzten Laufs für inkrementelles Re-Routing. Der
 * Erstlauf (oder ein Reset) routet voll, alle Folgeläufe verlegen nur
 * betroffene Kanten neu — unveränderte Trassen behalten Wege UND
 * Objekt-Identität (kein Springen, kein Re-Render).
 */
let prevIncremental: RoutePrevState | null = null;

/** Alle zwischengespeicherten Routen verwerfen (Reset/Tests, R-9). */
export const clearCableRoutes = (): void => {
  current = new Map<string, PathResult>();
  currentValidation = undefined;
  prevIncremental = null;
  listeners.forEach((l) => l());
  validationListeners.forEach((l) => l());
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

export const publishCableRouteFinalValidation = (report: FinalValidationReport): void => {
  currentValidation = report;
  validationListeners.forEach((l) => l());
};

export const getCableRouteFinalValidation = (): FinalValidationReport | undefined => currentValidation;

/**
 * AUDIT F-07: Baut aus genau den Waypoints, die `routeAllCables` für die UI
 * geliefert hat, den Final-Validation-Report. Reine Funktion, damit der
 * Router-Kontext nicht gemockt werden muss und der Report im Test
 * deterministisch reproduzierbar ist.
 */
export function computeCableRouteFinalValidation(
  nodes: RoutableNode[],
  edges: readonly RouteEdgeRef[],
  routes: Map<string, PathResult>
): FinalValidationReport {
  const routed: RoutedEdge[] = [];
  for (const edge of edges) {
    const route = routes.get(edge.id);
    if (route)
      routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: route.waypoints });
  }
  const obstacleById = nodeObstacleMap(nodes);
  const rects: NodeRect[] = [];
  for (const node of nodes) {
    const rect = obstacleById.get(node.id);
    if (rect) rects.push({ id: node.id, ...rect });
  }
  const report = validateFinalRouting(routed, rects);
  let tight = 0;
  for (const edge of edges) {
    if (routes.get(edge.id)?.tightMarginUsed) tight += 1;
  }
  return { ...report, tightMarginRoutes: tight };
}
const subscribeValidation = (cb: () => void): (() => void) => {
  validationListeners.add(cb);
  return () => {
    validationListeners.delete(cb);
  };
};

export function useCableRouteFinalValidation(): FinalValidationReport | undefined {
  return useSyncExternalStore(subscribeValidation, getCableRouteFinalValidation, () => undefined);
}

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
    // v12: `nodeLookup` ersetzt `nodeInternals` und liefert InternalNodes —
    // gemessene Maße unter `measured`, absolute Position unter `internals`.
    // Präsentations-Nodes (Backbone-Gruppe) sind kein Layout — ohne Filter
    // würde jede Gruppen-Neuberechnung ein globales Re-Routing auslösen.
    const nodes = nodeLayoutSignature(withoutPresentationNodes([...s.nodeLookup.values()]));
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
      // InternalNodes statt `getNodes()` (in v12 nicht mehr am Store):
      // sie tragen gemessene Größe UND Handle-Rechtecke. Ohne die
      // Backbone-Gruppe — sie ist Darstellungs-Box, kein Hindernis
      // (siehe `withoutPresentationNodes`).
      const nodes = withoutPresentationNodes([...state.nodeLookup.values()]) as unknown as RoutableNode[];
      const edgeRefs = state.edges as RouteEdgeRef[];
      // P-1 (#397): Erstlauf voll, Folgeläufe inkrementell — nur betroffene
      // Kanten werden neu verlegt, der Rest bleibt pixel- und referenzstabil.
      const routes = prevIncremental
        ? routeIncrementalCables(nodes, edgeRefs, prevIncremental)
        : routeAllCables(nodes, edgeRefs);
      prevIncremental = {
        routes,
        rects: nodeObstacleMap(nodes),
        topo: new Map(edgeRefs.map((edge) => [edge.id, topoKeyOf(edge)])),
      };
      publishCableRoutes(routes);

      // AUDIT F-07: Die finale Routing-Invariante (I1/I2/I3) wird im Rendering
      // mitgeführt statt nur im CI. `routeAllCables` liefert bereits exakt
      // die Waypoints, die die UI zeichnet — derselbe Report erscheint damit
      // sichtbar, solange der Plan Rest-Überdeckungen hat.
      publishCableRouteFinalValidation(computeCableRouteFinalValidation(nodes, edgeRefs, routes));
    }, ROUTE_THROTTLE_MS);
  }

  useLayoutEffect(() => {
    const runner = runnerRef.current;
    if (runner) runner.schedule();
    return () => runner?.cancel();
  }, [signature]);

  return null;
}
