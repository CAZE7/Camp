/**
 * lib/planner/routingV2/orchestrator.ts
 *
 * Der Routing-V2-Orchestrator.
 *
 * Verbindet alle Bausteine zu einer kohärenten Pipeline:
 *
 *   1. Layout (ELK oder dagre-Fallback) → deterministische Knotenpositionen
 *   2. Lane Registry  → deterministische Trassen-Zuordnung
 *   3. Collision Engine → geometrische Kollisionsprüfung
 *   4. Crossing-Hopping → Kreuzungen auflösen (wer springt, bleibt gerade)
 *   5. Cost Model    → Kostenbewertung der Route
 *   6. Result        → positionierte Knoten + Routed Edges + Report
 *
 * Damit existiert das zuvor fehlende "geometrische Routing V2" als zentrale
 * Wahrheit — ohne dass ein einzelner Wert verstreut ist.
 */

import type { CableFunction, CablePlannerEdge, PlannerEdge, PlannerNode } from '../domain';
import {
  GEOMETRY,
  aabbFromPoints,
  orthogonalLPath,
  point,
  type AABB,
  type OrthogonalPath,
  type Point,
  type RoutedEdge,
} from '../geometry';
import { routeCost, cheapestRoute, DEFAULT_COST_WEIGHTS } from './costModel';
import {
  detectCollisions,
  type Collision,
  type CollisionNode,
} from './collision';
import {
  DagreLayoutEngine,
  createLayoutEngine,
  snapLayoutToGrid,
  toLayoutEdges,
  toLayoutNodes,
  type LayoutEngine,
  type LayoutResult,
} from './elkAdapter';
import { applyHopPlan, planHopping, type HopPlan } from './hopping';
import { LaneRegistry } from './laneRegistry';

/** Priorität einer Kabelfunktion (höher = eher Backbone). */
const CABLE_PRIORITY: Record<CableFunction, number> = {
  main: 10,
  positive: 9,
  ground: 8,
  busbar: 7,
  inverter: 6,
  solar: 5,
  charging: 4,
  shore: 3,
  secondary: 2,
  consumer: 1,
  negative: 2,
};

/** Default-Knotengröße, falls ein Knoten keine Angabe hat. */
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;

/** Ergebnis-Eingabe für `analyzeRoutingV2` / `routeSchematicV2`. */
export type RoutingV2Input<E extends PlannerEdge = PlannerEdge> = {
  nodes: PlannerNode[];
  edges: E[];
  direction?: 'LR' | 'TB';
  layoutEngine?: LayoutEngine;
};

/** Ein gerouteter Knoten (Knoten mit berechneter Position). */
export type RoutedNode = PlannerNode & { position: { x: number; y: number } };

/** Vollständiges Ergebnis eines Routing-V2-Laufs. */
export type RoutingV2Result<E extends PlannerEdge = PlannerEdge> = {
  nodes: RoutedNode[];
  edges: E[];
  routedEdges: RoutedEdge[];
  collisions: Collision[];
  hops: HopPlan;
  laneRegistry: LaneRegistry;
  layoutResult: LayoutResult;
};

/** Baut die AABB für einen Knoten. */
export function nodeAABB(node: PlannerNode): AABB {
  const width = node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.height ?? DEFAULT_NODE_HEIGHT;
  return aabbFromPoints(node.position, point(node.position.x + width, node.position.y + height));
}

/** Ordnet einer Kante anhand ihrer Kabelfunktion eine Priorität zu. */
export function edgePriority(edge: PlannerEdge): number {
  const fn = (edge.data as { cableFunction?: CableFunction } | undefined)?.cableFunction;
  return fn ? CABLE_PRIORITY[fn] ?? 1 : 1;
}

/** Entfernt doppelte/kollineare aufeinanderfolgende Punkte aus einem Pfad. */
function dedupePoints(path: OrthogonalPath): OrthogonalPath {
  const result: Point[] = [];
  for (const p of path) {
    const prev = result[result.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 1e-9 || Math.abs(prev.y - p.y) > 1e-9) {
      result.push(p);
    }
  }
  return result;
}

/**
 * Baut einen orthogonalen Pfad zwischen zwei Knoten-Grenzen (AABBs).
 *
 * Die Kante verlässt die Quelle an der dem Ziel zugewandten AABB-Kante und
 * erreicht das Ziel an dessen zugewandter Kante. Der `laneOffset` verschiebt
 * die mittlere Trasse senkrecht, sodass parallele Kanten getrennt verlaufen
 * (Routing V2: deterministischer Lane-Versatz).
 */
export function orthogonalRoute(source: AABB, target: AABB, laneOffset: number): OrthogonalPath {
  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;
  const dirX = dx >= 0 ? 1 : -1;
  const dirY = dy >= 0 ? 1 : -1;

  let raw: Point[];
  if (Math.abs(dx) >= Math.abs(dy)) {
    // horizontale Trasse
    const exitX = dirX > 0 ? source.x + source.width : source.x;
    const enterX = dirX > 0 ? target.x : target.x + target.width;
    const laneY = scy + laneOffset;
    raw = [
      point(exitX, scy),
      point(exitX, laneY),
      point(enterX, laneY),
      point(enterX, tcy),
    ];
  } else {
    // vertikale Trasse
    const exitY = dirY > 0 ? source.y + source.height : source.y;
    const enterY = dirY > 0 ? target.y : target.y + target.height;
    const laneX = scx + laneOffset;
    raw = [
      point(scx, exitY),
      point(laneX, exitY),
      point(laneX, enterY),
      point(tcx, enterY),
    ];
  }

  return dedupePoints(raw);
}

/**
 * Erzeugt eine Handvoll ortogonaler Kandidaten-Routen zwischen zwei Knoten.
 *
 * Die Kandidaten unterscheiden sich im Lane-Versatz (Grund-Lane ± clearance
 * sowie eine mittige Überleitung), sodass das Cost-Modell tatsächlich
 * zwischen alternativen Trassen wählen kann.
 */
export function orthogonalRouteCandidates(
  source: AABB,
  target: AABB,
  laneOffset: number
): OrthogonalPath[] {
  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;
  const dirX = dx >= 0 ? 1 : -1;
  const dirY = dy >= 0 ? 1 : -1;
  const step = GEOMETRY.cableClearance;

  // Verschiedene Lane-Versätze als Alternativen (0 = Grundachse).
  const offsets = [laneOffset, laneOffset - step, laneOffset + step, 0];
  const candidates: OrthogonalPath[] = [];

  if (Math.abs(dx) >= Math.abs(dy)) {
    const exitX = dirX > 0 ? source.x + source.width : source.x;
    const enterX = dirX > 0 ? target.x : target.x + target.width;
    for (const off of offsets) {
      const laneY = scy + off;
      candidates.push(
        dedupePoints([
          point(exitX, scy),
          point(exitX, laneY),
          point(enterX, laneY),
          point(enterX, tcy),
        ])
      );
    }
  } else {
    const exitY = dirY > 0 ? source.y + source.height : source.y;
    const enterY = dirY > 0 ? target.y : target.y + target.height;
    for (const off of offsets) {
      const laneX = scx + off;
      candidates.push(
        dedupePoints([
          point(scx, exitY),
          point(laneX, exitY),
          point(laneX, enterY),
          point(tcx, enterY),
        ])
      );
    }
  }

  return candidates;
}

/**
 * Wählt aus einer Menge ortogonaler Kandidaten die kostengünstigste Route.
 *
 * Das Cost-Modell (Länge + Biegungen) wird hier AKTIV als Entscheider
 * verwendet — es ist nicht mehr Test-Deadcode.
 */
export function selectBestPath(candidates: OrthogonalPath[]): OrthogonalPath {
  if (candidates.length === 0) return [];
  const costs = candidates.map((c) => routeCost({ path: c }, DEFAULT_COST_WEIGHTS));
  const best = cheapestRoute(costs);
  if (!best) return candidates[0];
  return candidates[costs.indexOf(best)];
}

/** Baut einen orthogonalen Pfad zwischen zwei Knotenzentren. */
export function buildStraightPath(a: { x: number; y: number }, b: { x: number; y: number }): OrthogonalPath {
  const startFromA =
    a.x < b.x || (a.x === b.x && a.y <= b.y);
  const from = startFromA ? a : b;
  const to = startFromA ? b : a;
  return orthogonalLPath(point(from.x, from.y), point(to.x, to.y), 0.5);
}

/** Verschiebt einen Pfad um einen (dx, dy)-Offset. */
export function shiftPath(path: OrthogonalPath, dx: number, dy: number): OrthogonalPath {
  return path.map((p) => point(p.x + dx, p.y + dy));
}

/**
 * Analysiert das Routing eines bereits positionierten Schaltplans (ohne
 * erneutes Layout). Nützlich, um den aktuellen Stand zu validieren.
 */
export function analyzeRoutingV2<E extends PlannerEdge = PlannerEdge>(
  input: RoutingV2Input<E>
): Omit<RoutingV2Result<E>, 'nodes' | 'layoutResult'> {
  const { nodes, edges } = input;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const laneRegistry = new LaneRegistry();

  const routedEdges: RoutedEdge[] = edges
    .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
    .map((e) => {
      const source = nodeById.get(e.source)!;
      const target = nodeById.get(e.target)!;

      const lane = laneRegistry.acquire(e.id, e.source, e.target);

      // Routing V2: orthogonale Trasse zwischen den Knoten-Grenzen mit
      // deterministischem Lane-Versatz. Das Cost-Modell entscheidet aktiv
      // zwischen den alternativen Trassen-Kandidaten (Länge + Biegungen).
      const candidates = orthogonalRouteCandidates(
        nodeAABB(source),
        nodeAABB(target),
        lane.offset
      );
      const path = selectBestPath(candidates);

      return {
        edgeId: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        priority: edgePriority(e),
        lane: lane.lane,
        path,
      };
    });

  const collisionNodes: CollisionNode[] = nodes.map((n) => ({
    id: n.id,
    aabb: nodeAABB(n),
  }));

  const collisions = detectCollisions(routedEdges, collisionNodes);
  const hops = planHopping(routedEdges, collisions);
  const resolvedEdges = applyHopPlan(routedEdges, hops);

  return {
    edges,
    routedEdges: resolvedEdges,
    collisions,
    hops,
    laneRegistry,
  };
}

/**
 * Führt die vollständige Routing-V2-Pipeline aus: Layout → Lanes →
 * Collision → Hopping.
 */
export async function routeSchematicV2<E extends PlannerEdge = PlannerEdge>(
  input: RoutingV2Input<E>
): Promise<RoutingV2Result<E>> {
  const { nodes, edges, direction } = input;
  const engine = input.layoutEngine ?? (await createLayoutEngine());

  const layoutResult = await engine.layout(
    toLayoutNodes(nodes),
    toLayoutEdges(edges),
    { direction }
  );
  const snapped = snapLayoutToGrid(layoutResult);

  const positionedNodes: RoutedNode[] = nodes.map((node) => {
    const pos = snapped.positions.get(node.id) ?? node.position;
    return { ...node, position: pos };
  });

  const analysis = analyzeRoutingV2({ nodes: positionedNodes, edges });
  const attachedEdges = stampRoutedEdgeData(edges, analysis.routedEdges);

  return {
    nodes: positionedNodes,
    edges: attachedEdges,
    routedEdges: analysis.routedEdges,
    collisions: analysis.collisions,
    hops: analysis.hops,
    laneRegistry: analysis.laneRegistry,
    layoutResult: snapped,
  };
}

/** Bequemer Zugriff auf die Standard-Layout-Engine (ELK, sonst dagre). */
export async function defaultLayoutEngine(): Promise<LayoutEngine> {
  return createLayoutEngine();
}

/** Bequemer Zugriff auf die dagre-Fallback-Engine (deterministisch, synchron nutzbar). */
export function fallbackLayoutEngine(): LayoutEngine {
  return new DagreLayoutEngine();
}

/** Wandelt eine Punktfolge in ein flaches [x0,y0,x1,y1,...]-Array. */
export function pathToFlat(path: OrthogonalPath): number[] {
  const flat: number[] = [];
  for (const p of path) {
    flat.push(p.x, p.y);
  }
  return flat;
}

/**
 * Stempelt Routing-V2-Pfade (data.routedPath + data.lane) auf Planner-Kanten.
 * Die Kanten werden NICHT mutiert — es entstehen neue Objekte.
 *
 * @param edges       Aktuelle Kanten
 * @param routedEdges Die im Routing berechneten RoutedEdges
 * @returns           Neue Kanten mit `routedPath` (flach) und `lane`
 */
export function stampRoutedEdgeData<E extends PlannerEdge = PlannerEdge>(
  edges: E[],
  routedEdges: RoutedEdge[]
): E[] {
  const routedById = new Map(routedEdges.map((e) => [e.edgeId, e]));

  return edges.map((edge) => {
    const routed = routedById.get(edge.id);
    if (!routed || !edge.data) return edge;
    return {
      ...edge,
      data: {
        ...edge.data,
        routedPath: pathToFlat(routed.path),
        lane: routed.lane,
      },
    };
  });
}

/**
 * Reichert Planner-Kanten mit den Routing-V2-Pfaden an (data.routedPath +
 * data.lane). Die Kanten werden NICHT mutiert — es entstehen neue Objekte.
 *
 * @param nodes Aktuelle Knoten (mit Positionen)
 * @param edges Aktuelle Kanten
 * @returns     Neue Kanten mit `routedPath` (flach) und `lane`
 */
export function attachRoutedPaths(
  nodes: PlannerNode[],
  edges: CablePlannerEdge[]
): CablePlannerEdge[] {
  const { routedEdges } = analyzeRoutingV2({ nodes, edges });
  return stampRoutedEdgeData(edges, routedEdges);
}
