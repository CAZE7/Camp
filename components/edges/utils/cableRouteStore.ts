import { useRef, useLayoutEffect, useSyncExternalStore } from 'react';
import { useStore, useStoreApi, type Edge } from '@xyflow/react';
import {
  nodeHandleBounds,
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type GeometryNode,
  type RoutableNode,
} from './nodeGeometry';
import { NODE_FALLBACK_HEIGHT, NODE_FALLBACK_WIDTH, nodeObstacleMap } from './pathfinding';
import { collectRoutableNodes } from './routableNodes';
import {
  createRoutingTraceSnapshot,
  describeRoutingStateChange,
  detectAlternatingRoutingCycle,
  logRoutingInputChange,
  logRoutingResult,
  routingDebugEnabled,
  routingDebugGeometrySignature,
  type RoutingDebugNode,
  type RoutingTraceSnapshot,
  type RoutingTraceTriggerReference,
} from './routingDebug';
import { validateFinalRouting, type FinalValidationReport } from '../../../lib/routing/finalValidation';
import {
  createRouteGenerationTracker,
  routingInputHash,
  type RouteGenerationStatus,
} from '../../../lib/routing/generation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';
import { routeAllCables, type RouteEdgeRef } from './routeAll';
import type { PathResult } from './pathfinding';

/**
 * R-9 (Cache-/Re-Routing-Korrektheit): Layout-Signaturen.
 *
 * Die alte `nodeVersion` war die SUMME aller Positionen und Maße — ein
 * Verschieben um (+10, −10) ließ sie unverändert, und die Kabel blieben
 * auf der alten Trasse (stiller Stale-Pfad). Die Signaturen hier sind
 * vollständig: jede Routing-relevante Positions-, Größen-, Handle-, Typ-,
 * Topologie- oder Hop-Prioritätsänderung ändert den String. Move, Resize,
 * Delete, Connect, Undo/Redo und Hop-Änderungen laufen damit über dieselbe,
 * inhaltsbasierte Invalidierung.
 */

/** Signatur aller routingrelevanten Node-Eingaben: Geometrie, Handles und Typ. */
export function nodeLayoutSignature(
  nodes: readonly ({ id: string; type?: string | null } & GeometryNode)[]
): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (!node) continue;
    const handles = nodeHandleBounds(node);
    parts.push(
      JSON.stringify([
        node.id,
        nodeOriginX(node),
        nodeOriginY(node),
        nodeWidth(node, NODE_FALLBACK_WIDTH),
        nodeHeight(node, NODE_FALLBACK_HEIGHT),
        node.type ?? null,
        // Die Listenreihenfolge bleibt erhalten: resolveHandlePoint nimmt
        // bei fehlender/unerwarteter ID das erste Handle der Gruppe.
        handles?.source == null
          ? null
          : handles.source.map((handle) => [
              handle.id ?? null,
              handle.x,
              handle.y,
              handle.width,
              handle.height,
              handle.position,
            ]),
        handles?.target == null
          ? null
          : handles.target.map((handle) => [
              handle.id ?? null,
              handle.x,
              handle.y,
              handle.width,
              handle.height,
              handle.position,
            ]),
      ]) ?? ''
    );
  }
  return JSON.stringify(parts.sort()) ?? '[]';
}

/** Signatur der Topologie und aller von resolveHops gelesenen Edge-Merkmale.
 *
 *  Spec #17 (Routing Input Hash) verlangt mindestens:
 *    edge IDs, edge endpoints, edge intent, obstacles (via nodes),
 *    routing settings, routing constraints.
 *  Obstacles sind bereits in `nodeLayoutSignature` enthalten (Knoten-Geometrie).
 *  Routing-Tokens werden über `ROUTING_TOKENS_VERSION` einbezogen (s. unten).
 */
type EdgeTopologySignatureInput = Pick<Edge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle'> & {
  data?: unknown;
};

/**
 * Versionierung der Routing-Tokens. Bei Änderungen an `ROUTING_TOKENS`
 * (clearance, Biegeradius, Lane-Grid …) MUSS dieser Zähler hochgezählt
 * werden, damit alte Caches nicht für neue Parameter wiederverwendet werden.
 * So fließen die Routing-Einstellungen in den Hash ein — ohne Abhängigkeit
 * von der Geometrie-Schicht.
 */
export const ROUTING_TOKENS_VERSION = 2;

export function edgeTopologySignature(edges: readonly EdgeTopologySignatureInput[]): string {
  const parts: string[] = [];
  for (const edge of edges) {
    // Breiter Cast: EdgeTopologySignatureInput.data ist `unknown` (React-Flow-
    // Edge trägt alle CableEdgeData-Felder). Die Routing-Eingabe sind die
    // echten Kanten aus dem Store, nicht die verengte RouteEdgeRef-Sicht —
    // der Hash muss ALLE routingrelevanten Felder sehen.
    const data = edge.data as Record<string, unknown> | null | undefined;
    const locked = data?.locked === true;
    const autoWired = data?.autoWired === true;
    const declaredIntent = typeof data?.intent === 'string' ? data.intent : null;
    const intent = declaredIntent ?? (locked ? 'locked' : autoWired ? 'auto' : 'user');
    const waypointCount =
      locked && Array.isArray((data as { waypoints?: unknown }).waypoints)
        ? (data as { waypoints: unknown[] }).waypoints.length
        : 0;
    parts.push(
      JSON.stringify([
        edge.id,
        edge.source,
        edge.target,
        edge.sourceHandle ?? null,
        edge.targetHandle ?? null,
        (data?.edgeDomain as string | null | undefined) ?? null,
        (data?.crossSection as number | null | undefined) ?? null,
        locked,
        // Spec #17: Edge-Intent muss den Hash ändern, damit eine Sperrung
        // oder ein Pin die Trasse invalidiert (locked = andere Regeln).
        intent,
        // Spec #24: Eine gesperrte Route (waypoints) ist eine andere
        // Eingabe als eine freie Kante — der Hash muss sie unterscheiden.
        waypointCount,
      ]) ?? ''
    );
  }
  // Token-Version an den Anfang, damit ein Token-Change den gesamten
  // Hash ändert (einfacher vergleichbar, keine Mischung mit Geometrie).
  return `tv=${ROUTING_TOKENS_VERSION}|${JSON.stringify(parts.sort()) ?? '[]'}`;
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
const EMPTY_ROUTES: ReadonlyMap<string, PathResult> = new Map();
const listeners = new Set<() => void>();

/** Final-Validation-Report des zuletzt gerouteten Plans (AUDIT F-07). */
let currentValidation: FinalValidationReport | undefined;
const validationListeners = new Set<() => void>();

/**
 * V2: Stand der zuletzt veröffentlichten Routen.
 *
 * Vorher war nicht feststellbar, zu WELCHER Eingabe die angezeigten Kabel
 * gehören. Mit Hash und Generation ist das prüfbar — und die
 * Konvergenzschranke (`MAX_ROUTE_REVISIONS_PER_GRAPH`) wird sichtbar, statt
 * als endlose Wiederholung im Hintergrund zu laufen.
 */
let currentGeneration: RouteGenerationStatus | undefined;
const generationListeners = new Set<() => void>();

export const getCableRouteGeneration = (): RouteGenerationStatus | undefined => currentGeneration;

export const publishCableRouteGeneration = (status: RouteGenerationStatus | undefined): void => {
  currentGeneration = status;
  generationListeners.forEach((l) => l());
};

const subscribeGeneration = (cb: () => void): (() => void) => {
  generationListeners.add(cb);
  return () => {
    generationListeners.delete(cb);
  };
};

export function useCableRouteGeneration(): RouteGenerationStatus | undefined {
  return useSyncExternalStore(subscribeGeneration, getCableRouteGeneration, () => undefined);
}

/** Alle zwischengespeicherten Routen verwerfen (Reset/Tests, R-9). */
export const clearCableRoutes = (): void => {
  current = new Map<string, PathResult>();
  currentValidation = undefined;
  currentGeneration = undefined;
  listeners.forEach((l) => l());
  validationListeners.forEach((l) => l());
  generationListeners.forEach((l) => l());
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
  // Reine Darstellungs-Knoten sind kein Prüfgegenstand: Würde der Rahmen des
  // Hauptstromkreises ungefiltert übergeben, könnte eine Leitung, die ein
  // Kern-Bauteil verlässt, den Rahmenrand schneiden und als I1 erscheinen,
  // obwohl kein Kabel durch ein Bauteil läuft (siehe `routableNodes.ts`).
  nodes = collectRoutableNodes(nodes).routable;
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

/** Subscribe to the whole immutable route snapshot (e.g. FlowCanvas diagnostics). */
export function useCableRoutes(): ReadonlyMap<string, PathResult> {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY_ROUTES
  );
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
  // v12: `nodeLookup` enthält gemessene Maße, absolute Position und Handles.
  // Nur routbare Bauteile bilden die Route-Signatur; separat halten wir die
  // Presentation-Signatur, aber nur mit aktivierter Diagnose.
  const signatureState = useStore(
    (s) => {
      const { routable } = collectRoutableNodes(s.nodeLookup.values());
      return {
        routing: `${nodeLayoutSignature(routable)}#${edgeTopologySignature(s.edges)}`,
        diagnosticGeometry: routingDebugEnabled()
          ? routingDebugGeometrySignature(s.nodeLookup.values() as Iterable<RoutingDebugNode>)
          : '',
      };
    },
    (before, after) =>
      before.routing === after.routing &&
      (!routingDebugEnabled() || before.diagnosticGeometry === after.diagnosticGeometry)
  );

  const previousSignatureRef = useRef<string | undefined>(undefined);
  const previousTraceSnapshotRef = useRef<RoutingTraceSnapshot | undefined>(undefined);
  const recentSignatureHashesRef = useRef<string[]>([]);
  const pendingTriggersRef = useRef<RoutingTraceTriggerReference[]>([]);

  // Diagnostic observation is intentionally separate from route scheduling:
  // a measured/changed presentation-only node gets a trace record but can
  // never cancel a pending route or schedule a new one.
  useLayoutEffect(() => {
    const state = store.getState();
    const all = [...state.nodeLookup.values()] as unknown as RoutableNode[];
    const edgeRefs = state.edges as RouteEdgeRef[];
    const { routable } = collectRoutableNodes(all);
    const routingSignature = `${nodeLayoutSignature(routable)}#${edgeTopologySignature(edgeRefs)}`;
    const routingChanged = previousSignatureRef.current !== routingSignature;

    if (routingDebugEnabled()) {
      const snapshot = createRoutingTraceSnapshot(all, edgeRefs, routingSignature);
      const change = describeRoutingStateChange(previousTraceSnapshotRef.current, snapshot);
      if (
        previousTraceSnapshotRef.current === undefined ||
        change.changedNodes.length > 0 ||
        change.changedEdges.length > 0
      ) {
        const cycle = routingChanged
          ? detectAlternatingRoutingCycle(recentSignatureHashesRef.current, snapshot.routingSignatureHash)
          : undefined;
        const trigger = logRoutingInputChange(snapshot, change, cycle);
        if (routingChanged) {
          pendingTriggersRef.current.push(trigger);
          recentSignatureHashesRef.current = [
            ...recentSignatureHashesRef.current,
            snapshot.routingSignatureHash,
          ].slice(-6);
        }
        previousTraceSnapshotRef.current = snapshot;
      }
    }

    previousSignatureRef.current = routingSignature;
  }, [signatureState.routing, signatureState.diagnosticGeometry, store]);

  // R-9: Routing input changes use the existing leading + trailing throttle.
  // Presentation-only state never reaches the scheduling effect.
  const runnerRef = useRef<ReturnType<typeof createThrottledRunner> | null>(null);
  const generationRef = useRef(createRouteGenerationTracker());
  useLayoutEffect(() => {
    const tracker = generationRef.current;
    const runner = createThrottledRunner(() => {
      const startedAt = Date.now();
      const state = store.getState();
      // InternalNodes tragen die vom Router konsumierten Maße und Handle-Bounds.
      const all = [...state.nodeLookup.values()] as unknown as RoutableNode[];
      const { routable: nodes } = collectRoutableNodes(all);
      const edgeRefs = state.edges as RouteEdgeRef[];
      const nodeSignature = nodeLayoutSignature(nodes);
      const edgeSignature = edgeTopologySignature(edgeRefs);
      const routingSignature = `${nodeSignature}#${edgeSignature}`;

      // V2-ROUTE-001: Jeder Lauf meldet sich an. Wiederholt dieselbe Eingabe
      // die Schranke, wird NICHT erneut geroutet — die bestehenden Routen
      // bleiben stehen und der Zustand wird als „nicht konvergiert"
      // veröffentlicht. Kein Timer, keine wachsende Toleranz: ein Zähler.
      const status = tracker.begin(routingInputHash(nodeSignature, edgeSignature));
      publishCableRouteGeneration(status);
      if (!status.allowed) return;

      const routes = routeAllCables(nodes, edgeRefs);

      // AUDIT F-07: Die Validierung prüft genau die Routen, die die UI zeichnet.
      const report = computeCableRouteFinalValidation(nodes, edgeRefs, routes);
      publishCableRoutes(routes);
      publishCableRouteFinalValidation(report);

      if (routingDebugEnabled()) {
        const snapshot = createRoutingTraceSnapshot(all, edgeRefs, routingSignature);
        logRoutingResult(snapshot, routes, report, pendingTriggersRef.current, Date.now() - startedAt);
        pendingTriggersRef.current = [];
      }
    }, ROUTE_THROTTLE_MS);
    runnerRef.current = runner;
    return () => {
      runner.cancel();
      runnerRef.current = null;
    };
  }, [store]);

  useLayoutEffect(() => {
    const runner = runnerRef.current;
    if (runner) runner.schedule();
    return () => runner?.cancel();
  }, [signatureState.routing]);

  return null;
}
