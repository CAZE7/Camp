/**
 * CAMP Global Routing Engine — Kern (Phase 2).
 *
 * Ablauf (§5 der Spezifikation):
 *
 *   1. Ports auflösen, Lanes deterministisch vergeben, Stubs reservieren
 *   2. Gitter bauen, Hindernis-Index bauen
 *   3. Startlösung: Kanten in ID-Reihenfolge, je Kante A* (Stufe 0: Katalog
 *      für gerade Lagen, sonst Gittersuche)
 *   4. Verhandlung (Negotiated Congestion): Rip-up aller Kanten, Neuverlegung
 *      mit Überlastpreisen + History, bis keine Gitterkante doppelt belegt ist
 *   5. Kreuzungs-Refinement: Kanten mit den meisten Kreuzungen zuerst neu
 *      verlegen, Kreuzungen bepreist
 *   6. Geometrische Nachbearbeitung (Kollinear-Merge, Dogleg-Kürzung,
 *      Bend-Merge) — nur akzeptierend
 *   7. Ausgabe in sortierter ID-Reihenfolge (Determinismus, I9)
 *
 * Der Kern ist frei von React, Store und Bestandsrouting. Er benutzt nur
 * Tokens, Geometrie und (in `validate.ts`) die eingefrorene Prüfinstanz.
 */

import {
  countBends,
  isOrthogonalPath,
  mergeCloseBends,
  pathLength,
  simplifyWaypoints,
  type Point,
} from '../routing/geometry';
import { compareIds } from '../sortOrder';
import { gridAStar } from './astar';
import {
  applyRoute,
  buildGrid,
  handleKey,
  ObstacleIndex,
  Occupancy,
  sideDir,
  stubPoint,
  type Grid,
  type StubReservation,
} from './grid';
import type {
  CoreEdge,
  CoreHandle,
  CoreInput,
  CoreMetrics,
  CoreResult,
  CoreRoute,
  CoreUnroutable,
} from './model';
import { CORE_TOKENS } from './tokens';

const EPS = 1e-6;

type ResolvedEnd = {
  readonly handle: CoreHandle;
  readonly nodeId: string;
  readonly stub: Point;
  readonly lane: number;
  readonly handleKey: string;
};

type ResolvedEdge = {
  readonly edge: CoreEdge;
  readonly source: ResolvedEnd;
  readonly target: ResolvedEnd;
  readonly ownNodeIds: ReadonlySet<string>;
  readonly ownHandleKeys: ReadonlySet<string>;
};

/** Kantenkosten wie im Bestandsrouter: Länge + 80·Knick + 120·Kreuzung. */
const routeCost = (waypoints: readonly Point[], crossings: number): number =>
  pathLength(waypoints) + CORE_TOKENS.bendCost * countBends(waypoints) + CORE_TOKENS.crossingCost * crossings;


/**
 * Lane-Vergabe: je (Bauteil, Anschluss) werden die beteiligten Kanten nach ID
 * sortiert und symmetrisch um die Portachse verteilt (I8: deterministisch,
 * unabhängig von der Laufreihenfolge).
 */
function assignLanes(
  input: CoreInput,
  handleOf: (nodeId: string, handleId: string) => CoreHandle | undefined
): Map<string, { sourceLane: number; targetLane: number }> {
  const groups = new Map<string, { edgeId: string; end: 'source' | 'target'; side: CoreHandle['side'] }[]>();
  for (const edge of input.edges) {
    const source = handleOf(edge.source, edge.sourceHandle);
    const target = handleOf(edge.target, edge.targetHandle);
    if (source) {
      const key = handleKey(edge.source, edge.sourceHandle);
      const list = groups.get(key) ?? [];
      list.push({ edgeId: edge.id, end: 'source', side: source.side });
      groups.set(key, list);
    }
    if (target) {
      const key = handleKey(edge.target, edge.targetHandle);
      const list = groups.get(key) ?? [];
      list.push({ edgeId: edge.id, end: 'target', side: target.side });
      groups.set(key, list);
    }
  }
  const lanes = new Map<string, { sourceLane: number; targetLane: number }>();
  for (const edge of input.edges) lanes.set(edge.id, { sourceLane: 0, targetLane: 0 });
  const keys = [...groups.keys()].sort();
  for (const key of keys) {
    const members = groups.get(key) as { edgeId: string; end: 'source' | 'target'; side: CoreHandle['side'] }[];
    members.sort((a, b) => compareIds(a.edgeId, b.edgeId));
    members.forEach((member, i) => {
      const offset = (i - (members.length - 1) / 2) * CORE_TOKENS.laneGrid;
      const entry = lanes.get(member.edgeId) as { sourceLane: number; targetLane: number };
      if (member.end === 'source') entry.sourceLane = offset;
      else entry.targetLane = offset;
    });
  }
  return lanes;
}

/** Baut die Geometrie einer Route: Handle → Stub → Gitterpfad → Stub → Handle. */
function assemble(source: ResolvedEnd, target: ResolvedEnd, gridPath: readonly Point[]): Point[] {
  const points: Point[] = [{ x: source.handle.x, y: source.handle.y }, { x: source.stub.x, y: source.stub.y }];
  for (const point of gridPath) {
    const last = points[points.length - 1] as Point;
    if (Math.abs(last.x - point.x) > EPS || Math.abs(last.y - point.y) > EPS) points.push({ x: point.x, y: point.y });
  }
  const tail: Point = { x: target.stub.x, y: target.stub.y };
  const last = points[points.length - 1] as Point;
  if (Math.abs(last.x - tail.x) > EPS || Math.abs(last.y - tail.y) > EPS) points.push(tail);
  points.push({ x: target.handle.x, y: target.handle.y });
  return simplifyWaypoints(points);
}

/**
 * Dogleg-Kürzung: ein mittleres Segment kürzer als `segmentMin` wird
 * entfernt, indem die beiden Nachbarn auf die Achse des kürzeren Segments
 * gezogen werden. Nur akzeptierend: bei nicht-orthogonalem Ergebnis verworfen.
 */
function dropShortDoglegs(waypoints: readonly Point[]): Point[] {
  if (waypoints.length < 4) return [...waypoints];
  const out = waypoints.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 1; i + 1 < out.length - 0; i += 1) {
    const a = out[i - 1] as Point;
    const b = out[i] as Point;
    const c = out[i + 1] as Point;
    const vertical = Math.abs(b.x - c.x) < EPS;
    const short = Math.abs(vertical ? c.y - b.y : c.x - b.x);
    if (short >= CORE_TOKENS.segmentMin - EPS) continue;
    if (i + 2 >= out.length) continue;
    const d = out[i + 2] as Point;
    if (vertical) {
      // b→c ist senkrecht: a und d auf die x-Achse von b ziehen, b/c entfernen.
      const candidate: Point[] = [
        ...out.slice(0, i).map((p) => ({ ...p })),
        { x: b.x, y: a.y },
        { x: b.x, y: d.y },
        ...out.slice(i + 3).map((p) => ({ ...p })),
      ];
      const merged = simplifyWaypoints(candidate);
      if (isOrthogonalPath(merged)) return merged;
    } else {
      const candidate: Point[] = [
        ...out.slice(0, i).map((p) => ({ ...p })),
        { x: a.x, y: b.y },
        { x: d.x, y: b.y },
        ...out.slice(i + 3).map((p) => ({ ...p })),
      ];
      const merged = simplifyWaypoints(candidate);
      if (isOrthogonalPath(merged)) return merged;
    }
  }
  return out;
}

export function routeCore(input: CoreInput): CoreResult {
  const started = Date.now();
  const nodes = [...input.nodes].sort((a, b) => compareIds(a.id, b.id));
  const edges = [...input.edges].sort((a, b) => compareIds(a.id, b.id));
  const handleLookup = new Map<string, CoreHandle>();
  for (const node of nodes) {
    for (const handle of node.handles) handleLookup.set(handleKey(node.id, handle.id), handle);
  }
  const handleOf = (nodeId: string, handleId: string): CoreHandle | undefined =>
    handleLookup.get(handleKey(nodeId, handleId));

  const lanes = assignLanes({ nodes, edges }, handleOf);
  const unroutable: CoreUnroutable[] = [];
  const resolved: ResolvedEdge[] = [];

  for (const edge of edges) {
    const sourceHandle = handleOf(edge.source, edge.sourceHandle);
    const targetHandle = handleOf(edge.target, edge.targetHandle);
    if (!sourceHandle) {
      unroutable.push({ id: edge.id, reason: `Quell-Anschluss ${edge.source}/${edge.sourceHandle} fehlt` });
      continue;
    }
    if (!targetHandle) {
      unroutable.push({ id: edge.id, reason: `Ziel-Anschluss ${edge.target}/${edge.targetHandle} fehlt` });
      continue;
    }
    const lane = lanes.get(edge.id) ?? { sourceLane: 0, targetLane: 0 };
    resolved.push({
      edge,
      source: {
        handle: sourceHandle,
        nodeId: edge.source,
        stub: stubPoint(sourceHandle, lane.sourceLane),
        lane: lane.sourceLane,
        handleKey: handleKey(edge.source, edge.sourceHandle),
      },
      target: {
        handle: targetHandle,
        nodeId: edge.target,
        stub: stubPoint(targetHandle, lane.targetLane),
        lane: lane.targetLane,
        handleKey: handleKey(edge.target, edge.targetHandle),
      },
      ownNodeIds: new Set([edge.source, edge.target]),
      ownHandleKeys: new Set([
        handleKey(edge.source, edge.sourceHandle),
        handleKey(edge.target, edge.targetHandle),
      ]),
    });
  }

  const grid: Grid = buildGrid(
    nodes,
    resolved.map((entry) => ({ source: entry.source.stub, target: entry.target.stub }))
  );
  const obstacles = new ObstacleIndex(nodes);
  const reservations: StubReservation[] = [];
  for (const entry of resolved) {
    reservations.push({ handleKey: entry.source.handleKey, segment: [entry.source.handle, entry.source.stub] });
    reservations.push({ handleKey: entry.target.handleKey, segment: [entry.target.handle, entry.target.stub] });
  }

  const occupancy = new Occupancy();
  const locked = new Map<string, Point[]>();
  for (const entry of resolved) {
    if (entry.edge.locked && entry.edge.lockedWaypoints && entry.edge.lockedWaypoints.length >= 2) {
      const lockedWaypoints = entry.edge.lockedWaypoints.map((p) => ({ x: p.x, y: p.y }));
      locked.set(entry.edge.id, lockedWaypoints);
      applyRoute(occupancy, grid, lockedWaypoints, 1);
    }
  }

  const solveOne = (entry: ResolvedEdge): Point[] | null => {
    // Freigabe-Leiter: volle Clearance zuerst, dann engere Stufen. Die erste
    // Stufe, die einen Pfad liefert, gewinnt — I1 (Rohbox) bleibt in jeder
    // Stufe garantiert, nur I3 (12 px) wird auf den engen Stufen weich.
    for (const margin of CORE_TOKENS.marginLadder) {
      const result = gridAStar({
        grid,
        obstacles,
        occupancy,
        reservations,
        start: entry.source.stub,
        goal: entry.target.stub,
        startDir: sideDir(entry.source.handle.side),
        goalDir: ((sideDir(entry.target.handle.side) + 2) % 4) as 0 | 1 | 2 | 3,
        ownNodeIds: entry.ownNodeIds,
        ownHandleKeys: entry.ownHandleKeys,
        margin,
      });
      if (result) return assemble(entry.source, entry.target, result.waypoints);
    }
    return null;
  };

  // --- Verhandlung -------------------------------------------------------
  let bestSolution: Map<string, Point[]> | null = null;
  let iterations = 0;

  const routable = resolved.filter((entry) => !locked.has(entry.edge.id));

  for (let iteration = 0; iteration <= CORE_TOKENS.maxNegotiationIterations; iteration += 1) {
    iterations = iteration;
    // Rip-up: nur die gesperrten Routen bleiben stehen.
    occupancy.clear();
    for (const waypoints of locked.values()) {
      applyRoute(occupancy, grid, waypoints, 1);
    }
    const solution = new Map<string, Point[]>(locked);
    let failed = false;
    for (const entry of routable) {
      const waypoints = solveOne(entry);
      if (!waypoints) {
        failed = true;
        break;
      }
      solution.set(entry.edge.id, waypoints);
      applyRoute(occupancy, grid, waypoints, 1);
    }
    const maxUsage = occupancy.maxUsage();
    if (failed) break;
    if (maxUsage <= 1) {
      bestSolution = solution;
      break;
    }
    if (iteration === CORE_TOKENS.maxNegotiationIterations) {
      bestSolution = solution;
      break;
    }
    for (const overload of occupancy.overloaded()) {
      occupancy.raiseHistory(overload.a.x, overload.a.y, overload.b.x, overload.b.y, CORE_TOKENS.historyIncrement);
    }
  }

  if (!bestSolution) {
    for (const entry of routable) {
      unroutable.push({
        id: entry.edge.id,
        reason: `keine kollisionsfreie Route im Gitter (${grid.xs.length}×${grid.ys.length})`,
      });
    }
    const metrics: CoreMetrics = {
      iterations,
      maxCongestion: 0,
      totalHistoryCost: 0,
      crossingPasses: 0,
      totalLength: 0,
      totalBends: 0,
      totalCrossings: 0,
      gridNodes: grid.xs.length * grid.ys.length,
      durationMs: Date.now() - started,
    };
    return { routes: new Map(), unroutable, metrics };
  }

  const solution = bestSolution;

  // --- Kreuzungs-Refinement ---------------------------------------------
  // Solange die Belegung zulässig ist, werden Kanten mit den meisten
  // Kreuzungen zuerst neu verlegt; Kreuzungen sind im A* bepreist.
  const countCrossings = (id: string): number => {
    const mine = solution.get(id) as Point[];
    let count = 0;
    for (const [otherId, other] of solution) {
      if (otherId === id) continue;
      count += crossingPairs(mine, other);
    }
    return count;
  };

  let crossingPasses = 0;
  for (let pass = 0; pass < CORE_TOKENS.maxCrossingPasses; pass += 1) {
    crossingPasses = pass + 1;
    const order = [...solution.keys()]
      .filter((id) => !locked.has(id))
      .map((id) => ({ id, crossings: countCrossings(id), cost: routeCost(solution.get(id) as Point[], 0) }))
      .sort((a, b) => b.crossings - a.crossings || b.cost - a.cost || compareIds(a.id, b.id));
    if (order.length > 0 && (order[0] as { crossings: number }).crossings === 0) break;
    let improved = false;
    for (const item of order) {
      const entry = routable.find((candidate) => candidate.edge.id === item.id);
      if (!entry) continue;
      const current = solution.get(item.id) as Point[];
      const currentCost = routeCost(current, countCrossings(item.id));
      applyRoute(occupancy, grid, current, -1);
      const candidate = solveOne(entry);
      if (!candidate) {
        applyRoute(occupancy, grid, current, 1);
        continue;
      }
      applyRoute(occupancy, grid, candidate, 1);
      if (occupancy.maxUsage() > 1) {
        applyRoute(occupancy, grid, candidate, -1);
        applyRoute(occupancy, grid, current, 1);
        continue;
      }
      const candidateCost = routeCost(candidate, countCrossings(item.id));
      if (candidateCost < currentCost - EPS) {
        solution.set(item.id, candidate);
        improved = true;
      } else {
        applyRoute(occupancy, grid, candidate, -1);
        applyRoute(occupancy, grid, current, 1);
      }
    }
    if (!improved) break;
  }

  // --- Geometrische Nachbearbeitung --------------------------------------
  for (const [id, waypoints] of solution) {
    if (locked.has(id)) continue;
    let refined = dropShortDoglegs(waypoints);
    refined = simplifyWaypoints(mergeCloseBends(refined, 2 * CORE_TOKENS.bendRadius));
    if (!isOrthogonalPath(refined) || refined.length < 4) refined = waypoints;
    solution.set(id, refined);
  }

  // --- Ausgabe ------------------------------------------------------------
  const routes = new Map<string, CoreRoute>();
  let totalLength = 0;
  let totalBends = 0;
  let totalCrossings = 0;
  for (const id of [...solution.keys()].sort(compareIds)) {
    const waypoints = solution.get(id) as Point[];
    const crossings = countCrossings(id);
    const length = pathLength(waypoints);
    const bends = countBends(waypoints);
    totalLength += length;
    totalBends += bends;
    totalCrossings += crossings;
    routes.set(id, {
      id,
      waypoints: waypoints.map((p) => ({ x: p.x, y: p.y })),
      length,
      bends,
      crossings,
      lane: resolved.find((entry) => entry.edge.id === id)?.source.lane ?? 0,
      kind: locked.has(id) ? 'locked' : 'grid',
    });
  }

  const metrics: CoreMetrics = {
    iterations,
    maxCongestion: occupancy.maxUsage(),
    totalHistoryCost: occupancy.totalHistory(),
    crossingPasses,
    totalLength,
    totalBends,
    totalCrossings,
    gridNodes: grid.xs.length * grid.ys.length,
    durationMs: Date.now() - started,
  };
  return { routes, unroutable, metrics };
}

/** Zahl der echten Kreuzungen zwischen zwei orthogonalen Polylinien. */
export function crossingPairs(a: readonly Point[], b: readonly Point[]): number {
  let count = 0;
  for (let i = 0; i + 1 < a.length; i += 1) {
    const p1 = a[i] as Point;
    const p2 = a[i + 1] as Point;
    for (let j = 0; j + 1 < b.length; j += 1) {
      const q1 = b[j] as Point;
      const q2 = b[j + 1] as Point;
      const aVert = Math.abs(p1.x - p2.x) < EPS;
      const bVert = Math.abs(q1.x - q2.x) < EPS;
      if (aVert === bVert) continue; // parallel: keine Kreuzung
      const v1 = aVert ? p1 : q1;
      const v2 = aVert ? p2 : q2;
      const h1 = aVert ? q1 : p1;
      const h2 = aVert ? q2 : p2;
      const vx = v1.x;
      const vy = h1.y;
      const vLo = Math.min(v1.y, v2.y);
      const vHi = Math.max(v1.y, v2.y);
      const hLo = Math.min(h1.x, h2.x);
      const hHi = Math.max(h1.x, h2.x);
      if (vx > hLo + EPS && vx < hHi - EPS && vy > vLo + EPS && vy < vHi - EPS) count += 1;
    }
  }
  return count;
}
