import { Position } from '@xyflow/react';
import {
  nodeHandleBounds,
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type RoutableNode,
} from './nodeGeometry';
import {
  findCablePath,
  nodesToObstacles,
  inflateRect,
  pathLength,
  countBends,
  countCrossings,
  OBSTACLE_MARGIN,
  ROUTE_BORDER_RADIUS,
  segmentHitsRect,
  type Point,
  type PathResult,
  type Rect,
} from './pathfinding';
import {
  polylineMidpoint,
  waypointsToPath,
  waypointsToPathWithHops,
  polarityPathOffset,
  parallelLaneOffset,
  type PathHop,
} from './pathUtils';
import { nudgeOrthogonalPaths } from './nudge';
import { crossingSegmentsNear } from './routingCache';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';
import { assignFanOut, type FanOutRequest, type PortAxis } from '../../../lib/routing/rules/portFanOut';
import { hopRadius, resolveHops, type HopDomain, type HopEdge } from '../../../lib/routing/rules/hopping';
import { isBackboneConnection } from '../../planner/utils/backbone';

export type RouteEdgeRef = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  /**
   * Fachliche Merkmale der Leitung. Nur für die Hop-Priorität (WP-7) gelesen,
   * alle Felder optional: Kanten aus Fixtures, `knownPlans/` und älteren
   * Plänen bringen sie nicht zwingend mit, und die Route darf davon nicht
   * abhängen — ohne Angabe zählt die Leitung als rangloser Abzweig.
   */
  data?: {
    edgeDomain?: HopDomain;
    crossSection?: number;
    /**
     * Vom Nutzer fixierte Leitung — hoppt nie (`docs/ROUTING-V2.md` §8).
     * Ein Lock-Feature gibt es in der UI noch nicht; die Regel ist hier
     * bereits umgesetzt, damit sie nicht später nachgereicht werden muss.
     */
    locked?: boolean;
  } | null;
};

type NodeWithHandles = RoutableNode;

const NODE_W = 192;
const NODE_H = 120;

export function resolveHandlePoint(
  node: NodeWithHandles | undefined,
  handleId: string | null | undefined,
  kind: 'source' | 'target',
  /** R-7: Flussrichtung zum Gegenüber (Zentrum → Zentrum). Optional. */
  flow?: { x: number; y: number }
): { x: number; y: number; position: Position } {
  if (!node) {
    return { x: 0, y: 0, position: kind === 'source' ? Position.Right : Position.Left };
  }
  const originX = nodeOriginX(node);
  const originY = nodeOriginY(node);
  const bounds = nodeHandleBounds(node);
  const group = bounds?.[kind] ?? bounds?.[kind === 'source' ? 'target' : 'source'];
  const wanted = handleId ?? null;
  const hb = group?.find((h) => (h.id ?? null) === wanted) ?? group?.[0];
  if (hb) {
    return {
      x: originX + hb.x + hb.width / 2,
      y: originY + hb.y + hb.height / 2,
      position: hb.position,
    };
  }
  // R-7: Ohne gemessene Handles liegt der Anschluss auf der Seite, die der
  // FLUSSRICHTUNG entspricht (Quelle → Verteilung → Verbraucher). Ohne
  // Flussangabe gilt die konventionelle Seite (Quelle rechts, Ziel links).
  const w = nodeWidth(node, NODE_W);
  const h = nodeHeight(node, NODE_H);
  const t = handleId?.includes('minus') ? 0.7 : handleId?.includes('plus') ? 0.3 : 0.5;
  const horizontal = !flow || Math.abs(flow.x) >= Math.abs(flow.y);
  if (horizontal) {
    // Quelle verlässt stromabwärts, Ziel wird stromaufwärts betreten —
    // beide Anschlüsse liegen auf der Seite, die dem Flusszugewandt ist.
    const right = flow ? flow.x > 0 : kind === 'source';
    return right
      ? { x: originX + w, y: originY + h * t, position: Position.Right }
      : { x: originX, y: originY + h * t, position: Position.Left };
  }
  const down = flow.y > 0;
  return down
    ? { x: originX + w * t, y: originY + h, position: Position.Bottom }
    : { x: originX + w * t, y: originY, position: Position.Top };
}

const rebuild = (
  waypoints: Point[],
  crossings: number,
  usedSearch: PathResult['usedSearch'],
  hops: PathHop[] = []
): PathResult => {
  const mid = polylineMidpoint(waypoints);
  return {
    path:
      hops.length > 0
        ? waypointsToPathWithHops(waypoints, ROUTE_BORDER_RADIUS, hops, hopRadius())
        : waypointsToPath(waypoints, ROUTE_BORDER_RADIUS),
    hops,
    waypoints,
    labelX: mid.x,
    labelY: mid.y,
    offsetX: 0,
    offsetY: 0,
    length: pathLength(waypoints),
    bends: countBends(waypoints),
    crossings,
    usedSearch,
  };
};

/** R-7: Zentrums-Differenz zweier Nodes (Flussrichtung Quelle → Ziel). */
function centerDelta(
  from: RoutableNode | undefined,
  to: RoutableNode | undefined
): { x: number; y: number } | undefined {
  if (!from || !to) return undefined;
  const fc = nodeCenter(from);
  const tc = nodeCenter(to);
  return { x: tc.x - fc.x, y: tc.y - fc.y };
}

function nodeCenter(node: RoutableNode): { x: number; y: number } {
  return {
    x: nodeOriginX(node) + nodeWidth(node, NODE_W) / 2,
    y: nodeOriginY(node) + nodeHeight(node, NODE_H) / 2,
  };
}

/** Halbe Lane (8 px) — das Halbton-Raster, auf das Korridore ausgerichtet werden. */
const LANE_GRID = ROUTING_TOKENS.laneGrid / 2; // WP-1: aus Token `laneGrid`

/** Korridor-Cluster: Segmente näher als das kommen auf dieselbe Lane. */
const CORRIDOR_MERGE_TOLERANCE = 6;

/** Mindestüberlappung entlang der Achse, damit zwei Segmente „denselben Korridor“ fahren. */
const CORRIDOR_MIN_OVERLAP = 32;

/**
 * R-6: Lane-Offsets nach Port-Flussreihenfolge.
 *
 * Kanten an demselben Handle (gleicher Punkt) verlassen den Port als
 * Bündel. Statt der id-basierten Reihenfolge sortiert diese Stufe nach der
 * Quer-Koordinate des Gegenübers: Wer weiter oben ankommt, verlässt den
 * Port auch oben — die Stubs überkreuzen sich nicht („Kantenreihenfolge
 * an Ports tauschen“). Deterministisch: Gleichstand per Edge-ID.
 */
export function portOrderedLaneOffsets(
  edges: RouteEdgeRef[],
  resolve: (edge: RouteEdgeRef, kind: 'source' | 'target') => { x: number; y: number; position: Position }
): Map<string, number> {
  // WP-9 (#398): Sortierung und Versatz kommen aus der zentralen
  // Fan-Out-Mechanik (lib/routing/rules/portFanOut) — dieselbe Quelle wie
  // die ELK-Portindizes (FIXED_ORDER). Verhalten identisch zur bisherigen
  // Inline-Implementierung (Zielposition, dann Edge-ID; symmetrische Lanes).
  const offsets = new Map<string, number>();
  const groups = new Map<string, { axis: PortAxis; requests: FanOutRequest[] }>();
  for (const edge of edges) {
    for (const kind of ['source', 'target'] as const) {
      const point = resolve(edge, kind);
      const far = resolve(edge, kind === 'source' ? 'target' : 'source');
      const horizontal = point.position === Position.Left || point.position === Position.Right;
      const key = `${kind}|${Math.round(point.x)}:${Math.round(point.y)}`;
      const group = groups.get(key) ?? { axis: horizontal ? 'horizontal' : 'vertical', requests: [] };
      group.requests.push({ edgeId: edge.id, farEnd: { x: far.x, y: far.y } });
      groups.set(key, group);
    }
  }
  for (const group of groups.values()) {
    if (group.requests.length <= 1) continue;
    for (const assignment of assignFanOut(group.axis, group.requests)) {
      offsets.set(assignment.edgeId, assignment.offset);
    }
  }
  return offsets;
}

/**
 * R-6: Gemeinsame Segmente auf gemeinsame Lanes ausrichten.
 *
 * Innere Segmente mehrerer Kanten, die denselben Korridor fahren
 * (achsenparallel, ≤ 6 px Versatz, ≥ 32 px Überlappung), werden auf
 * dasselbe 8-px-Halbton-Raster gezogen — sie liegen danach exakt nebenei-
 * nander statt fast übereinander. Jeder Zugrif bleibt hindernisfrei geprüft;
 * Endpunkte und Stubs werden nie verändert.
 */
export function alignSharedCorridors(
  paths: { id: string; waypoints: Point[] }[],
  obstacles: Rect[]
): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  for (const path of paths) out.set(path.id, path.waypoints);

  type Item = { id: string; segIndex: number; coord: number; from: number; to: number; horizontal: boolean };
  const items: Item[] = [];
  for (const path of paths) {
    for (let i = 1; i < path.waypoints.length - 2; i++) {
      const a = path.waypoints[i];
      const b = path.waypoints[i + 1];
      if (!a || !b) continue;
      const horizontal = Math.abs(a.y - b.y) <= 1e-6 && Math.abs(a.x - b.x) > 1e-6;
      const vertical = Math.abs(a.x - b.x) <= 1e-6 && Math.abs(a.y - b.y) > 1e-6;
      if (!horizontal && !vertical) continue;
      items.push({
        id: path.id,
        segIndex: i,
        coord: horizontal ? a.y : a.x,
        from: horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
        to: horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
        horizontal,
      });
    }
  }

  // Cluster je Achse: nach Koordinate sortieren, Nachbarn ≤ Toleranz
  // bündeln und nur bei ausreichender Überlappung (> 32 px entlang der
  // Achse) auf dasselbe 8-px-Raster ziehen.
  const snapToLane = (value: number): number => Math.round(value / LANE_GRID) * LANE_GRID;
  for (const horizontal of [true, false]) {
    const axis = items.filter((item) => item.horizontal === horizontal).sort((a, b) => a.coord - b.coord);
    let cluster: Item[] = [];
    const flush = () => {
      if (cluster.length >= 2) {
        // Ziel-Lane: kleinste Koordinate im Cluster, auf 8 px gerastet —
        // deterministisch unabhängig von der Eingabereihenfolge.
        const minCoord = cluster.reduce((min, item) => Math.min(min, item.coord), Infinity);
        const target = Math.max(minCoord, snapToLane(minCoord));
        // Paare mit ≥ CORRIDOR_MIN_OVERLAP gemeinsamer Länge aus jeweils
        // ZWEI verschiedenen Kanten ausrichten.
        for (let i = 0; i < cluster.length; i++) {
          for (let j = 0; j < cluster.length; j++) {
            if (i === j) continue;
            const a = cluster[i]!;
            const b = cluster[j]!;
            if (a.id === b.id) continue;
            const overlap = Math.min(a.to, b.to) - Math.max(a.from, b.from);
            if (overlap < CORRIDOR_MIN_OVERLAP) continue;
            for (const item of [a, b]) {
              if (item.coord === target) continue;
              const points = out.get(item.id);
              if (!points) continue;
              const p1 = points[item.segIndex];
              const p2 = points[item.segIndex + 1];
              if (!p1 || !p2) continue;
              const moved1 = horizontal ? { x: p1.x, y: target } : { x: target, y: p1.y };
              const moved2 = horizontal ? { x: p2.x, y: target } : { x: target, y: p2.y };
              const candidate = [...points];
              candidate[item.segIndex] = moved1;
              candidate[item.segIndex + 1] = moved2;
              if (!pathHitsObstacles(candidate, obstacles)) {
                out.set(item.id, candidate);
              }
            }
          }
        }
      }
      cluster = [];
    };
    for (const item of axis) {
      const prev = cluster[cluster.length - 1];
      if (prev && Math.abs(item.coord - prev.coord) > CORRIDOR_MERGE_TOLERANCE) flush();
      cluster.push(item);
    }
    flush();
  }
  return out;

  function pathHitsObstacles(points: Point[], rects: Rect[]): boolean {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      for (const rect of rects) {
        if (segmentHitsRect(a, b, rect)) return true;
      }
    }
    return false;
  }
}

/**
 * Routet alle Kanten in einem Durchgang und schiebt parallele Trassen global.
 */
export function routeAllCables(nodes: RoutableNode[], edges: RouteEdgeRef[]): Map<string, PathResult> {
  const out = new Map<string, PathResult>();
  if (edges.length === 0) return out;

  const nodeById = new Map<string, RoutableNode>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node) nodeById.set(node.id, node);
  }

  const edgeById = new Map<string, RouteEdgeRef>(edges.map((edge) => [edge.id, edge]));

  const allObstacles = nodesToObstacles(nodes, new Set());
  // R-4: Kreuzungsbasis über den gecachten Spatial-Index — kein 120er-Limit mehr.
  const edgeRefs = edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
  const crossingAll =
    edgeRefs.length > 0
      ? crossingSegmentsNear(
          nodes,
          edgeRefs,
          { id: '\u0000-none', source: '', target: '' },
          planBounds(nodes)
        )
      : [];
  /** Gemeinsame BBox aller Nodes (für die globale Kreuzungszählung, R-6). */
  function planBounds(nodeList: RoutableNode[]): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeList) {
      const x = nodeOriginX(node);
      const y = nodeOriginY(node);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nodeWidth(node, NODE_W));
      maxY = Math.max(maxY, y + nodeHeight(node, NODE_H));
    }
    return { x: minX - 200, y: minY - 200, width: maxX - minX + 400, height: maxY - minY + 400 };
  }

  const siblingEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
  }));

  // R-6/R-7: Port-Reihenfolge vor dem Einzel-Routing festlegen
  // (deterministisch); die Handle-Seite folgt der Flussrichtung.
  const portOffsets = portOrderedLaneOffsets(edges, (edge, kind) => {
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const flow = centerDelta(srcNode, tgtNode);
    return kind === 'source'
      ? resolveHandlePoint(srcNode, edge.sourceHandle, 'source', flow)
      : resolveHandlePoint(
          tgtNode,
          edge.targetHandle,
          'target',
          flow ? { x: -flow.x, y: -flow.y } : undefined
        );
  });

  const raw: { id: string; waypoints: Point[]; result: PathResult }[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge) continue;
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const flow = centerDelta(srcNode, tgtNode);
    const src = resolveHandlePoint(srcNode, edge.sourceHandle, 'source', flow);
    const tgt = resolveHandlePoint(
      tgtNode,
      edge.targetHandle,
      'target',
      flow ? { x: -flow.x, y: -flow.y } : undefined
    );
    const exclude = new Set([edge.source, edge.target]);
    const obstacles = nodesToObstacles(nodes, exclude);
    const lane =
      portOffsets.get(edge.id) ??
      parallelLaneOffset({
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        siblingEdges,
      });
    const result = findCablePath({
      sourceX: src.x,
      sourceY: src.y,
      sourcePosition: src.position,
      targetX: tgt.x,
      targetY: tgt.y,
      targetPosition: tgt.position,
      offset: polarityPathOffset(edge.sourceHandle) + lane,
      obstacles,
      crossingSegments: crossingSegmentsNear(
        nodes,
        edgeRefs,
        { id: edge.id, source: edge.source, target: edge.target },
        {
          x: Math.min(src.x, tgt.x) - 120,
          y: Math.min(src.y, tgt.y) - 120,
          width: Math.abs(src.x - tgt.x) + 240,
          height: Math.abs(src.y - tgt.y) + 240,
        }
      ),
    });
    raw.push({ id: edge.id, waypoints: result.waypoints, result });
  }

  const inflated: Rect[] = allObstacles.map((r) => inflateRect(r, OBSTACLE_MARGIN));
  // R-6: gemeinsame Korridore zuerst auf gemeinsame Lanes ausrichten,
  // danach löst der Nudge nur noch echte Rest-Überlappungen auf.
  const aligned = alignSharedCorridors(
    raw.map((r) => ({ id: r.id, waypoints: r.waypoints })),
    inflated
  );
  const nudged = nudgeOrthogonalPaths(
    raw.map((r) => ({ id: r.id, waypoints: aligned.get(r.id) ?? r.waypoints })),
    { obstacles: inflated }
  );

  // Deterministische Ausgabereihenfolge: nach Edge-ID, nicht nach Eingabereihenfolge.
  const order = raw.map((r) => r.id).sort((a, b) => a.localeCompare(b));
  const byId = new Map(raw.map((r) => [r.id, r]));
  const finalWaypoints = new Map<string, Point[]>(
    order.map((id) => {
      const item = byId.get(id);
      return [id, nudged.get(id) ?? aligned.get(id) ?? item?.waypoints ?? []];
    })
  );

  // WP-7 (#395): Hops erst NACH Ausrichtung und Nudge bestimmen — vorher
  // liegen die Kreuzungen noch woanders. Reine Darstellung: die Waypoints
  // bleiben unangetastet, Länge/Knicke/Kreuzungen ändern sich nicht.
  const hopsByEdge = resolveHops(
    order.map<HopEdge>((id) => {
      const edge = edgeById.get(id);
      return {
        id,
        waypoints: finalWaypoints.get(id) ?? [],
        domain: edge?.data?.edgeDomain,
        crossSection: edge?.data?.crossSection,
        locked: edge?.data?.locked,
        backbone: isBackboneConnection(
          nodeById.get(edge?.source ?? '')?.type,
          nodeById.get(edge?.target ?? '')?.type
        ),
      };
    })
  );

  for (const id of order) {
    const item = byId.get(id);
    if (!item) continue;
    const wp = finalWaypoints.get(id) ?? item.waypoints;
    const crossings = countCrossings(wp, crossingAll);
    out.set(id, rebuild(wp, crossings, item.result.usedSearch, hopsByEdge.get(id) ?? []));
  }
  return out;
}
