import type { Point, Rect } from './pathfinding';
import { isOrthogonalPath, pathHitsObstacles, containsPoint, stitchOrthogonal } from './pathfinding';

/**
 * Globales orthogonales Nudging (libavoid-Phase 2).
 *
 * Parallele Innenstücke werden deterministisch auf Lanes verteilt.
 * Handle-Punkte bleiben. Wo ein Stub nicht mitwandern darf, setzt
 * `stitchOrthogonal` einen Ellbogen — der Pfad bleibt rechtwinklig.
 */

export const NUDGE_GAP = 16;
export const NUDGE_THRESHOLD = 10;
export const NUDGE_MIN_OVERLAP = 12;

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

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(at(segs, i).perp - at(segs, j).perp) > NUDGE_THRESHOLD) continue;
      if (!rangesOverlap(at(segs, i).lo, at(segs, i).hi, at(segs, j).lo, at(segs, j).hi)) continue;
      union(i, j);
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

/** Nur echte Innenpunkte verschieben — Stubs bekommen später einen Ellbogen. */
const isFreeVertex = (index: number, n: number): boolean => index >= 2 && index <= n - 3;

const applyAxis = (
  clones: Point[][],
  originals: Point[][],
  pathIds: string[],
  axis: 'h' | 'v',
  gap: number
): void => {
  const segs: Seg[] = [];
  for (let p = 0; p < originals.length; p++) {
    const found = collectInterior(at(originals, p), axis);
    for (let k = 0; k < found.length; k++) {
      const seg = at(found, k);
      seg.path = p;
      segs.push(seg);
    }
  }
  if (segs.length < 2) return;

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
      return at(pathIds, pa).localeCompare(at(pathIds, pb));
    });

    let mean = 0;
    for (let i = 0; i < pathOrder.length; i++) {
      mean += at(segs, firstSegIndexOf(at(pathOrder, i))).perp;
    }
    mean /= pathOrder.length;

    for (let k = 0; k < pathOrder.length; k++) {
      const p = at(pathOrder, k);
      const target = mean + (k - (pathOrder.length - 1) / 2) * gap;
      const delta = target - at(segs, firstSegIndexOf(p)).perp;
      if (Math.abs(delta) < EPS) continue;
      const pts = at(clones, p);
      const n = pts.length;
      const moved = new Set<number>();
      const list = byPath.get(p)!;
      for (let s = 0; s < list.length; s++) {
        const seg = at(segs, at(list, s));
        const ends = [seg.i0, seg.i1];
        for (let e = 0; e < 2; e++) {
          const idx = at(ends, e);
          if (moved.has(idx) || !isFreeVertex(idx, n)) continue;
          moved.add(idx);
          if (axis === 'h') at(pts, idx).y += delta;
          else at(pts, idx).x += delta;
        }
      }
    }
  }
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

/**
 * Schiebt parallele Innenstücke auseinander. Start- und Zielpunkte bleiben.
 * Pfade, die danach ein fremdes Hindernis schneiden, fallen auf das Original zurück.
 */
export function nudgeOrthogonalPaths(
  paths: NudgePath[],
  options?: { obstacles?: Rect[]; gap?: number }
): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  if (paths.length === 0) return out;

  const originals = clonePaths(paths);
  const clones = clonePaths(paths);
  const ids = paths.map((p) => p.id);
  const gap = options?.gap ?? NUDGE_GAP;
  const obstacles = options?.obstacles ?? [];

  applyAxis(clones, originals, ids, 'h', gap);
  applyAxis(clones, originals, ids, 'v', gap);

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
    const relevant = obstaclesForPath(obstacles, start, end);
    const ok =
      isOrthogonalPath(repaired) && (relevant.length === 0 || !pathHitsObstacles(repaired, relevant));
    out.set(id, ok ? repaired : orig);
  }
  return out;
}
