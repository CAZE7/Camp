import type { Point, Rect } from './pathfinding';
import {
  isOrthogonalPath,
  pathHitsObstacles,
  segmentHitsAny,
  containsPoint,
  stitchOrthogonal,
  routeDefectScore,
  pathLength,
  simplifyWaypoints,
  waypointsToSegments,
  type Segment,
} from './pathfinding';
import { countBends, hasMinimumStubs, segmentsCross, segmentsOverlap } from '../../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';
import { compareIds } from '../../../lib/sortOrder';

/**
 * Globales orthogonales Nudging (libavoid-Phase 2).
 *
 * Parallele Innenstücke werden deterministisch auf Lanes verteilt.
 * Handle-Punkte bleiben. Wo ein Stub nicht mitwandern darf, setzt
 * `stitchOrthogonal` einen Ellbogen — der Pfad bleibt rechtwinklig.
 */

export const NUDGE_GAP = ROUTING_TOKENS.laneGrid; // WP-1: Token `laneGrid`
export const NUDGE_THRESHOLD = 10;
export const NUDGE_MIN_OVERLAP = ROUTING_TOKENS.cableClearance; // WP-1: Token `cableClearance`
const MAX_NUDGE_REFLOW_STEPS = 3;
const MAX_NUDGE_REFLOW_PASSES = 2;

const EPS = 1e-6;

/** Gebundener Lesezugriff in abgesicherten Schleifen — siehe pathfinding.at. */
const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) {
    throw new RangeError(`nudge.at: Index ${i} außerhalb (Länge ${arr.length})`);
  }
  return v;
};

export type NudgePath = { id: string; waypoints: Point[] };

type Seg = {
  path: number;
  i0: number;
  i1: number;
  lo: number;
  hi: number;
  perp: number;
};

const clonePaths = (paths: NudgePath[]): Point[][] =>
  paths.map((p) => p.waypoints.map((pt) => ({ x: pt.x, y: pt.y })));

const rangesOverlap = (aLo: number, aHi: number, bLo: number, bHi: number): boolean =>
  aHi >= bLo + NUDGE_MIN_OVERLAP && bHi >= aLo + NUDGE_MIN_OVERLAP;

/**
 * Segmente zwischen Stub und Gegen-Stub (i = 1 .. n-3).
 * Der lange Lauf eines 5-Punkt-L (Elbow→T2) ist damit dabei.
 * Handles (0, n-1) bleiben unangetastet.
 */
const collectInterior = (pts: Point[], axis: 'h' | 'v'): Seg[] => {
  const n = pts.length;
  if (n < 4) return [];
  const segs: Seg[] = [];
  const last = n - 3;
  for (let i = 1; i <= last; i++) {
    const a = at(pts, i);
    const b = at(pts, i + 1);
    if (axis === 'h') {
      if (Math.abs(a.y - b.y) > EPS) continue;
      segs.push({
        path: -1,
        i0: i,
        i1: i + 1,
        lo: Math.min(a.x, b.x),
        hi: Math.max(a.x, b.x),
        perp: a.y,
      });
    } else {
      if (Math.abs(a.x - b.x) > EPS) continue;
      segs.push({
        path: -1,
        i0: i,
        i1: i + 1,
        lo: Math.min(a.y, b.y),
        hi: Math.max(a.y, b.y),
        perp: a.x,
      });
    }
  }
  return segs;
};

const clustersOf = (segs: Seg[]): number[][] => {
  const n = segs.length;
  const parent = new Array<number>(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number): number => {
    while (at(parent, a) !== a) {
      parent[a] = at(parent, at(parent, a));
      a = at(parent, a);
    }
    return a;
  };
  const union = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };

  const cells = new Map<number, Map<number, number[]>>();
  const seen = new Set<number>();
  const candidateIndices: number[] = [];
  const alongCellSize = NUDGE_MIN_OVERLAP;

  for (let i = 0; i < n; i++) {
    const segment = at(segs, i);
    if (segment.hi - segment.lo < alongCellSize) continue;
    const perpendicularCell = Math.floor(segment.perp / NUDGE_THRESHOLD);
    const minAlongCell = Math.floor(segment.lo / alongCellSize);
    const maxAlongCell = Math.floor(segment.hi / alongCellSize);
    seen.clear();
    candidateIndices.length = 0;

    // Any pair close enough in the perpendicular axis occupies either the
    // same perpendicular cell or one of its neighbors. Overlap >= one along
    // cell guarantees at least one shared along cell. Restore ascending input
    // order before unioning so component roots and downstream lane order match
    // the previous all-pairs scan exactly.
    for (let neighborPerp = perpendicularCell - 1; neighborPerp <= perpendicularCell + 1; neighborPerp++) {
      const perpBuckets = cells.get(neighborPerp);
      if (!perpBuckets) continue;
      for (let alongCell = minAlongCell; alongCell <= maxAlongCell; alongCell++) {
        const bucket = perpBuckets.get(alongCell);
        if (!bucket) continue;
        for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex++) {
          const j = at(bucket, bucketIndex);
          if (seen.has(j)) continue;
          seen.add(j);
          candidateIndices.push(j);
        }
      }
    }
    candidateIndices.sort((a, b) => a - b);
    for (let candidateIndex = 0; candidateIndex < candidateIndices.length; candidateIndex++) {
      const j = at(candidateIndices, candidateIndex);
      const other = at(segs, j);
      if (Math.abs(segment.perp - other.perp) > NUDGE_THRESHOLD) continue;
      if (!rangesOverlap(segment.lo, segment.hi, other.lo, other.hi)) continue;
      union(i, j);
    }

    let perpBuckets = cells.get(perpendicularCell);
    if (!perpBuckets) {
      perpBuckets = new Map<number, number[]>();
      cells.set(perpendicularCell, perpBuckets);
    }
    for (let alongCell = minAlongCell; alongCell <= maxAlongCell; alongCell++) {
      const bucket = perpBuckets.get(alongCell);
      if (bucket) bucket.push(i);
      else perpBuckets.set(alongCell, [i]);
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = buckets.get(r);
    if (list) list.push(i);
    else buckets.set(r, [i]);
  }
  return Array.from(buckets.values()).filter((g) => g.length > 1);
};

/**
 * Bewegt innere Punkte sowie Stub-Endpunkte nur entlang ihrer Stub-Achse.
 * Damit bleiben Quell-/Ziel-Handle und Austrittsrichtung erhalten.
 */
const isSafeNudgeVertex = (points: Point[], index: number, axis: 'h' | 'v', delta: number): boolean => {
  const n = points.length;
  if (index < 1 || index > n - 2) return false;
  if (index !== 1 && index !== n - 2) return true;
  const first = at(points, index === 1 ? 0 : n - 2);
  const last = at(points, index === 1 ? 1 : n - 1);
  const verticalStub = Math.abs(first.x - last.x) <= EPS;
  if (axis === 'h' ? !verticalStub : verticalStub) return false;
  const before = axis === 'h' ? last.y - first.y : last.x - first.x;
  const after = before + (index === 1 ? delta : -delta);
  return Math.sign(after) === Math.sign(before) && Math.abs(after) >= ROUTING_TOKENS.stubMin - EPS;
};

const obstaclesForPath = (obstacles: Rect[], start: Point, end: Point): Rect[] => {
  const out: Rect[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const r = at(obstacles, i);
    if (containsPoint(r, start) || containsPoint(r, end)) continue;
    out.push(r);
  }
  return out;
};

const groupSegmentsAt = (points: Point[], segs: Seg[], indices: number[], axis: 'h' | 'v'): Seg[] => {
  const out: Seg[] = [];
  for (let i = 0; i < indices.length; i++) {
    const seg = at(segs, at(indices, i));
    const a = at(points, seg.i0);
    const b = at(points, seg.i1);
    const aAlong = axis === 'h' ? a.x : a.y;
    const bAlong = axis === 'h' ? b.x : b.y;
    out.push({
      ...seg,
      lo: Math.min(aAlong, bAlong),
      hi: Math.max(aAlong, bAlong),
      perp: axis === 'h' ? a.y : a.x,
    });
  }
  return out;
};

const sameLaneOverlap = (a: Seg, b: Seg): boolean =>
  Math.abs(a.perp - b.perp) <= EPS && Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > EPS;

/** Wie pathfinding.countCrossings, aber ohne die für Nudge irrelevante Clearance-Distanz. */
const crossingOrOverlapCount = (points: Point[], others: Segment[]): number => {
  const own = waypointsToSegments(points);
  let count = 0;
  for (let i = 0; i < others.length; i++) {
    const other = at(others, i);
    const oMinX = Math.min(other[0].x, other[1].x);
    const oMaxX = Math.max(other[0].x, other[1].x);
    const oMinY = Math.min(other[0].y, other[1].y);
    const oMaxY = Math.max(other[0].y, other[1].y);
    for (let j = 0; j < own.length; j++) {
      const self = at(own, j);
      if (
        Math.max(self[0].x, self[1].x) < oMinX ||
        oMaxX < Math.min(self[0].x, self[1].x) ||
        Math.max(self[0].y, self[1].y) < oMinY ||
        oMaxY < Math.min(self[0].y, self[1].y)
      ) {
        continue;
      }
      if (segmentsOverlap(self, other) || segmentsCross(self, other)) {
        count++;
        break;
      }
    }
  }
  return count;
};

const conflictsWithPlacedSegments = (candidate: Seg[], placed: Map<number, Seg[]>): boolean => {
  for (const [otherPath, otherSegments] of placed) {
    if (candidate.length > 0 && at(candidate, 0).path === otherPath) continue;
    for (let i = 0; i < candidate.length; i++) {
      for (let j = 0; j < otherSegments.length; j++) {
        if (sameLaneOverlap(at(candidate, i), at(otherSegments, j))) return true;
      }
    }
  }
  return false;
};

type CandidateSafetyContext = {
  relevantObstacles: Rect[];
  originalDefect: number;
  originalHitsObstacles: boolean;
};

const pathHitsChangedSegments = (points: Point[], original: Point[], obstacles: Rect[]): boolean => {
  if (points.length !== original.length) return pathHitsObstacles(points, obstacles);
  for (let i = 0; i < points.length - 1; i++) {
    const start = at(points, i);
    const end = at(points, i + 1);
    const originalStart = at(original, i);
    const originalEnd = at(original, i + 1);
    if (
      start.x !== originalStart.x ||
      start.y !== originalStart.y ||
      end.x !== originalEnd.x ||
      end.y !== originalEnd.y
    ) {
      if (segmentHitsAny(start, end, obstacles)) return true;
    }
  }
  return false;
};

const candidateIsSafe = (
  candidate: Point[],
  original: Point[],
  context: CandidateSafetyContext
): Point[] | null => {
  const repaired = stitchOrthogonal(candidate);
  if (!isOrthogonalPath(repaired) || !hasMinimumStubs(repaired)) return null;
  if (context.relevantObstacles.length > 0) {
    const hitsObstacles = context.originalHitsObstacles
      ? pathHitsObstacles(repaired, context.relevantObstacles)
      : pathHitsChangedSegments(repaired, original, context.relevantObstacles);
    if (hitsObstacles) return null;
  }
  return routeDefectScore(repaired) <= context.originalDefect + EPS ? repaired : null;
};

const applyAxisPass = (
  clones: Point[][],
  originals: Point[][],
  pathIds: string[],
  axis: 'h' | 'v',
  gap: number,
  safetyByPath: CandidateSafetyContext[],
  fixedIds: ReadonlySet<string>
): boolean => {
  let changed = false;
  const segs: Seg[] = [];
  for (let p = 0; p < originals.length; p++) {
    const found = collectInterior(at(originals, p), axis);
    for (let k = 0; k < found.length; k++) {
      const seg = at(found, k);
      seg.path = p;
      segs.push(seg);
    }
  }
  if (segs.length < 2) return false;

  const segmentsByPath = clones.map((path) => waypointsToSegments(path));
  const groups = clustersOf(segs);
  for (let g = 0; g < groups.length; g++) {
    const group = at(groups, g);
    const byPath = new Map<number, number[]>();
    for (let t = 0; t < group.length; t++) {
      const si = at(group, t);
      const p = at(segs, si).path;
      const list = byPath.get(p);
      if (list) list.push(si);
      else byPath.set(p, [si]);
    }
    if (byPath.size < 2) continue;

    const firstSegIndexOf = (pathIdx: number): number => at(byPath.get(pathIdx)!, 0);
    const pathOrder = Array.from(byPath.keys()).sort((pa, pb) => {
      const da = at(segs, firstSegIndexOf(pa)).perp - at(segs, firstSegIndexOf(pb)).perp;
      if (Math.abs(da) > EPS) return da;
      return compareIds(at(pathIds, pa), at(pathIds, pb));
    });

    let mean = 0;
    for (let i = 0; i < pathOrder.length; i++) {
      mean += at(segs, firstSegIndexOf(at(pathOrder, i))).perp;
    }
    mean /= pathOrder.length;

    // A centered assignment can be locally impossible: the lane may shorten
    // a target stub below stubMin, or an obstacle may occupy it. Reflow in
    // stable laneGrid increments instead of reverting each blocked path to
    // its overlapping original lane (the Camper I2 regression).
    const placed = new Map<number, Seg[]>();
    // Locked routes keep their exact geometry but still reserve their lane so
    // movable siblings route around the user's fixed choice.
    for (const p of pathOrder) {
      if (!fixedIds.has(at(pathIds, p))) continue;
      placed.set(p, groupSegmentsAt(at(clones, p), segs, byPath.get(p)!, axis));
    }
    const laneStep = Math.abs(gap);
    for (let k = 0; k < pathOrder.length; k++) {
      const p = at(pathOrder, k);
      if (fixedIds.has(at(pathIds, p))) continue;
      const first = at(segs, firstSegIndexOf(p));
      const ideal = mean + (k - (pathOrder.length - 1) / 2) * gap;
      const originalPath = at(originals, p);
      const currentPath = at(clones, p);
      const list = byPath.get(p)!;
      const otherSegments: Segment[] = [];
      for (let other = 0; other < segmentsByPath.length; other++) {
        if (other !== p) otherSegments.push(...at(segmentsByPath, other));
      }
      const currentCrossings = crossingOrOverlapCount(currentPath, otherSegments);
      let accepted: Point[] | undefined;
      let acceptedSegments: Seg[] | undefined;
      // Bound the local search in laneGrid units. If no candidate survives all
      // geometry, obstacle, stub, crossing and placed-lane checks, keep this
      // member's existing route rather than accepting an unsafe detour.
      const maxSearch = Math.min(pathOrder.length, MAX_NUDGE_REFLOW_STEPS);

      for (let distance = 0; distance <= maxSearch && !accepted; distance++) {
        const offsets = distance === 0 ? [0] : [distance * laneStep, -distance * laneStep];
        for (let oi = 0; oi < offsets.length; oi++) {
          const target = ideal + at(offsets, oi);
          const currentLane = axis === 'h' ? at(currentPath, first.i0).y : at(currentPath, first.i0).x;
          const delta = target - currentLane;
          const candidate = currentPath.map((point) => ({ x: point.x, y: point.y }));
          const moved = new Set<number>();

          for (let s = 0; s < list.length; s++) {
            const seg = at(segs, at(list, s));
            const ends = [seg.i0, seg.i1];
            let movable = true;
            for (let e = 0; e < 2; e++) {
              if (!isSafeNudgeVertex(originalPath, at(ends, e), axis, delta)) movable = false;
            }
            if (!movable) continue;
            for (let e = 0; e < 2; e++) {
              const idx = at(ends, e);
              if (moved.has(idx)) continue;
              moved.add(idx);
              if (axis === 'h') at(candidate, idx).y += delta;
              else at(candidate, idx).x += delta;
            }
          }

          if (moved.size === 0 && Math.abs(delta) > EPS) continue;
          const repaired = candidateIsSafe(candidate, originalPath, at(safetyByPath, p));
          if (!repaired) continue;
          const candidateCrossings = crossingOrOverlapCount(repaired, otherSegments);
          if (candidateCrossings > currentCrossings) continue;
          const candidateSegments = groupSegmentsAt(candidate, segs, list, axis);
          if (conflictsWithPlacedSegments(candidateSegments, placed)) continue;
          accepted = candidate;
          acceptedSegments = candidateSegments;
          break;
        }
      }

      if (accepted && acceptedSegments) {
        for (let i = 0; i < currentPath.length; i++) {
          if (at(currentPath, i).x !== at(accepted, i).x || at(currentPath, i).y !== at(accepted, i).y) {
            changed = true;
          }
          at(currentPath, i).x = at(accepted, i).x;
          at(currentPath, i).y = at(accepted, i).y;
        }
        segmentsByPath[p] = waypointsToSegments(currentPath);
        placed.set(p, acceptedSegments);
      } else {
        // Keep the existing path, but reserve its actual lane so later members
        // do not choose the same blocked slot.
        placed.set(p, groupSegmentsAt(currentPath, segs, list, axis));
      }
    }
  }
  return changed;
};

/**
 * A single greedy pass can reject a lane only because a later member of the
 * same cluster has not moved yet. Revisit once after all members settle; this
 * bounded second pass uses the updated obstacles/crossing context and cannot
 * loop or change the electrical plan.
 */
const applyAxis = (
  clones: Point[][],
  originals: Point[][],
  pathIds: string[],
  axis: 'h' | 'v',
  gap: number,
  safetyByPath: CandidateSafetyContext[],
  fixedIds: ReadonlySet<string>
): void => {
  for (let pass = 0; pass < MAX_NUDGE_REFLOW_PASSES; pass++) {
    if (!applyAxisPass(clones, originals, pathIds, axis, gap, safetyByPath, fixedIds)) break;
  }
};

type NudgeQuality = { overlaps: number; crossings: number; bends: number; length: number };

const hasCollinearOverlap = (a: Segment, b: Segment): boolean => {
  const aHorizontal = Math.abs(a[0].y - a[1].y) <= EPS;
  const bHorizontal = Math.abs(b[0].y - b[1].y) <= EPS;
  if (aHorizontal !== bHorizontal) return false;
  if (aHorizontal) {
    if (Math.abs(a[0].y - b[0].y) > EPS) return false;
    return (
      Math.min(Math.max(a[0].x, a[1].x), Math.max(b[0].x, b[1].x)) -
        Math.max(Math.min(a[0].x, a[1].x), Math.min(b[0].x, b[1].x)) >
      EPS
    );
  }
  if (Math.abs(a[0].x - b[0].x) > EPS) return false;
  return (
    Math.min(Math.max(a[0].y, a[1].y), Math.max(b[0].y, b[1].y)) -
      Math.max(Math.min(a[0].y, a[1].y), Math.min(b[0].y, b[1].y)) >
    EPS
  );
};

const nudgeQuality = (paths: Point[][]): NudgeQuality => {
  const segments = paths.map((points) => waypointsToSegments(simplifyWaypoints(points)));
  let overlaps = 0;
  let crossings = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = at(segments, i);
      const b = at(segments, j);
      let hasOverlap = false;
      for (let ai = 1; ai < a.length - 1; ai++) {
        for (let bi = 1; bi < b.length - 1; bi++) {
          if (hasCollinearOverlap(at(a, ai), at(b, bi))) hasOverlap = true;
        }
      }
      if (hasOverlap) overlaps++;
      for (let ai = 0; ai < a.length; ai++) {
        for (let bi = 0; bi < b.length; bi++) {
          if (segmentsCross(at(a, ai), at(b, bi))) crossings++;
        }
      }
    }
  }
  return {
    overlaps,
    crossings,
    bends: paths.reduce((sum, points) => sum + countBends(points), 0),
    length: paths.reduce((sum, points) => sum + pathLength(points), 0),
  };
};

const nudgeImprovesQuality = (before: NudgeQuality, after: NudgeQuality): boolean => {
  if (before.overlaps !== after.overlaps) return after.overlaps < before.overlaps;
  if (before.crossings !== after.crossings) return after.crossings < before.crossings;
  if (before.bends !== after.bends) return after.bends < before.bends;
  return after.length < before.length - EPS;
};

/**
 * Schiebt parallele Innenstücke auseinander. Start- und Zielpunkte bleiben.
 * Pfade, die danach ein fremdes Hindernis schneiden, fallen auf das Original zurück.
 */
export function nudgeOrthogonalPaths(
  paths: NudgePath[],
  options?: { obstacles?: Rect[]; gap?: number; fixedIds?: ReadonlySet<string> }
): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  if (paths.length === 0) return out;

  const originals = clonePaths(paths);
  const clones = clonePaths(paths);
  const ids = paths.map((p) => p.id);
  const gap = options?.gap ?? NUDGE_GAP;
  const obstacles = options?.obstacles ?? [];
  const fixedIds = options?.fixedIds ?? new Set<string>();
  const safetyByPath = originals.map((original) => {
    const relevantObstacles = obstaclesForPath(obstacles, at(original, 0), at(original, original.length - 1));
    return {
      relevantObstacles,
      originalDefect: routeDefectScore(original),
      originalHitsObstacles: relevantObstacles.length > 0 && pathHitsObstacles(original, relevantObstacles),
    };
  });
  applyAxis(clones, originals, ids, 'h', gap, safetyByPath, fixedIds);
  applyAxis(clones, originals, ids, 'v', gap, safetyByPath, fixedIds);

  for (let i = 0; i < paths.length; i++) {
    const id = at(ids, i);
    const orig = at(originals, i);
    const clone = at(clones, i);
    const start = at(orig, 0);
    const end = at(orig, orig.length - 1);
    clone[0] = { x: start.x, y: start.y };
    clone[clone.length - 1] = { x: end.x, y: end.y };

    const changed = clone.some(
      (p, j) => Math.abs(p.x - at(orig, j).x) > EPS || Math.abs(p.y - at(orig, j).y) > EPS
    );
    const repaired = changed ? stitchOrthogonal(clone) : orig;
    const safety = at(safetyByPath, i);
    const relevant = safety.relevantObstacles;
    // ROUTE-BUG-8: Nudging darf eine Route nur verbessern. Ein verschobener
    // Punkt kann den Ellbogen neben einem Stub entstehen lassen — der Pfad
    // bleibt dann zwar orthogonal, kehrt aber am Handle um (I4) oder baut ein
    // Kurzsegment ein (I6). Solche Varianten werden verworfen: Akzeptiert
    // wird nur, was orthogonal UND hindernisfrei ist und die Mängel-Strafe
    // nicht erhöht.
    const ok =
      isOrthogonalPath(repaired) &&
      hasMinimumStubs(repaired) &&
      (relevant.length === 0 ||
        !(safety.originalHitsObstacles
          ? pathHitsObstacles(repaired, relevant)
          : pathHitsChangedSegments(repaired, orig, relevant))) &&
      routeDefectScore(repaired) <= safety.originalDefect + EPS;
    out.set(id, ok ? repaired : orig);
  }

  const finalPaths = paths.map((path, index) => out.get(path.id) ?? at(originals, index));
  const changed = finalPaths.some((points, index) => {
    const original = at(originals, index);
    if (points.length !== original.length) return true;
    return points.some(
      (point, pointIndex) =>
        Math.abs(point.x - at(original, pointIndex).x) > EPS ||
        Math.abs(point.y - at(original, pointIndex).y) > EPS
    );
  });
  if (changed && !nudgeImprovesQuality(nudgeQuality(originals), nudgeQuality(finalPaths))) {
    for (let i = 0; i < paths.length; i++) out.set(at(ids, i), at(originals, i));
  }
  return out;
}
