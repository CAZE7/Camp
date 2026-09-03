import { type Node, Position } from 'reactflow';
import {
  findCablePath,
  nodesToObstacles,
  edgesToCrossingSegments,
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
  polarityPathOffset,
  parallelLaneOffset,
  PARALLEL_LANE_SPREAD,
} from './pathUtils';
import { nudgeOrthogonalPaths } from './nudge';
import { crossingSegmentsNear } from './routingCache';

export type RouteEdgeRef = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

type HandleBounds = {
  id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  position: Position;
};

type NodeWithHandles = Node & {
  handleBounds?: { source?: HandleBounds[]; target?: HandleBounds[] };
};

const NODE_W = 192;
const NODE_H = 120;

export function resolveHandlePoint(
  node: NodeWithHandles | undefined,
  handleId: string | null | undefined,
  kind: 'source' | 'target'
): { x: number; y: number; position: Position } {
  if (!node) {
    return { x: 0, y: 0, position: kind === 'source' ? Position.Right : Position.Left };
  }
  const originX = node.positionAbsolute?.x ?? node.position.x;
  const originY = node.positionAbsolute?.y ?? node.position.y;
  const group = node.handleBounds?.[kind] ?? node.handleBounds?.[kind === 'source' ? 'target' : 'source'];
  const wanted = handleId ?? null;
  const hb = group?.find((h) => (h.id ?? null) === wanted) ?? group?.[0];
  if (hb) {
    return {
      x: originX + hb.x + hb.width / 2,
      y: originY + hb.y + hb.height / 2,
      position: hb.position,
    };
  }
  const w = node.width || NODE_W;
  const h = node.height || NODE_H;
  const t = handleId?.includes('minus') ? 0.7 : handleId?.includes('plus') ? 0.3 : 0.5;
  if (kind === 'source') {
    return { x: originX + w, y: originY + h * t, position: Position.Right };
  }
  return { x: originX, y: originY + h * t, position: Position.Left };
}

const rebuild = (waypoints: Point[], crossings: number, usedSearch: PathResult['usedSearch']): PathResult => {
  const mid = polylineMidpoint(waypoints);
  return {
    path: waypointsToPath(waypoints, ROUTE_BORDER_RADIUS),
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

/** Halbe Lane (8 px) — das Halbton-Raster, auf das Korridore ausgerichtet werden. */
const LANE_GRID = 8;

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
  const offsets = new Map<string, number>();
  const groups = new Map<string, { id: string; order: number }[]>();
  for (const edge of edges) {
    for (const kind of ['source', 'target'] as const) {
      const point = resolve(edge, kind);
      const far = resolve(edge, kind === 'source' ? 'target' : 'source');
      const horizontal = point.position === Position.Left || point.position === Position.Right;
      const key = `${kind}|${Math.round(point.x)}:${Math.round(point.y)}`;
      const group = groups.get(key) ?? [];
      group.push({ id: edge.id, order: horizontal ? far.y : far.x });
      groups.set(key, group);
    }
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    sorted.forEach((item, idx) => {
      offsets.set(item.id, (idx - (sorted.length - 1) / 2) * PARALLEL_LANE_SPREAD);
    });
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

  // Cluster je Achse: nach Koordinate sortieren, Nachbarn ≤ Toleranz bündeln.
  for (const horizontal of [true, false]) {
    const axis = items.filter((item) => item.horizontal === horizontal).sort((a, b) => a.coord - b.coord);
    let cluster: Item[] = [];
    const flush = () => {
      if (cluster.length >= 2) {
        const target = cluster[0]!.coord; // deterministisch: kleinste Koordinate
        const perId = new Map<string, Item[]>();
        for (const item of cluster) {
          const list = perId.get(item.id) ?? [];
          list.push(item);
          perId.set(item.id, list);
        }
        // Nur Cluster mit ≥ 2 verschiedenen Kanten bündeln.
        if (perId.size >= 2) {
          for (const item of cluster) {
            if (item.coord === target) continue;
            const points = out.get(item.id);
            if (!points) continue;
            const a = points[item.segIndex];
            const b = points[item.segIndex + 1];
            if (!a || !b) continue;
            const moved = horizontal ? { x: a.x, y: target } : { x: target, y: a.y };
            const movedB = horizontal ? { x: b.x, y: target } : { x: target, y: b.y };
            const candidate = [...points];
            candidate[item.segIndex] = moved;
            candidate[item.segIndex + 1] = movedB;
            if (!pathHitsObstacles(candidate, obstacles)) {
              out.set(item.id, candidate);
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
export function routeAllCables(nodes: Node[], edges: RouteEdgeRef[]): Map<string, PathResult> {
  const out = new Map<string, PathResult>();
  if (edges.length === 0) return out;

  const nodeById = new Map<string, Node>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node) nodeById.set(node.id, node);
  }

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
  function planBounds(nodeList: Node[]): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeList) {
      const x = node.positionAbsolute?.x ?? node.position.x;
      const y = node.positionAbsolute?.y ?? node.position.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + (node.width || 192));
      maxY = Math.max(maxY, y + (node.height || 120));
    }
    return { x: minX - 200, y: minY - 200, width: maxX - minX + 400, height: maxY - minY + 400 };
  }

  const siblingEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
  }));

  // R-6: Port-Reihenfolge vor dem Einzel-Routing festlegen (deterministisch).
  const portOffsets = portOrderedLaneOffsets(edges, (edge, kind) =>
    kind === 'source'
      ? resolveHandlePoint(nodeById.get(edge.source), edge.sourceHandle, 'source')
      : resolveHandlePoint(nodeById.get(edge.target), edge.targetHandle, 'target')
  );

  const raw: { id: string; waypoints: Point[]; result: PathResult }[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge) continue;
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const src = resolveHandlePoint(srcNode, edge.sourceHandle, 'source');
    const tgt = resolveHandlePoint(tgtNode, edge.targetHandle, 'target');
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
  for (const id of order) {
    const item = byId.get(id);
    if (!item) continue;
    const wp = nudged.get(id) ?? aligned.get(id) ?? item.waypoints;
    const crossings = countCrossings(wp, crossingAll);
    out.set(id, rebuild(wp, crossings, item.result.usedSearch));
  }
  return out;
}
