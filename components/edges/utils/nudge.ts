import type { Point, Rect } from './pathfinding';
import { isOrthogonalPath, pathHitsObstacles } from './pathfinding';

/**
 * Globales orthogonales Nudging (libavoid-Phase 2).
 *
 * Nach dem Einzel-Routing liegen parallele Innenstücke oft auf derselben
 * Trasse. Diese Phase schiebt sie deterministisch auseinander, ohne
 * Handle-Punkte zu bewegen und ohne die Orthogonalität zu brechen.
 */

export const NUDGE_GAP = 16;
export const NUDGE_THRESHOLD = 10;
export const NUDGE_MIN_OVERLAP = 12;

const EPS = 1e-6;

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

const collectInterior = (pts: Point[], axis: 'h' | 'v'): Seg[] => {
  const n = pts.length;
  // Bewegliche Punkte: 2 .. n-3 (nicht Start, Stub, Ziel-Stub, Ziel).
  if (n < 6) return [];
  const segs: Seg[] = [];
  for (let i = 2; i <= n - 4; i++) {
    const a = pts[i];
    const b = pts[i + 1];
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
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
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
      if (Math.abs(segs[i].perp - segs[j].perp) > NUDGE_THRESHOLD) continue;
      if (!rangesOverlap(segs[i].lo, segs[i].hi, segs[j].lo, segs[j].hi)) continue;
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

const applyAxis = (
  clones: Point[][],
  originals: Point[][],
  pathIds: string[],
  axis: 'h' | 'v',
  gap: number
): void => {
  const segs: Seg[] = [];
  for (let p = 0; p < originals.length; p++) {
    const found = collectInterior(originals[p], axis);
    for (let k = 0; k < found.length; k++) {
      found[k].path = p;
      segs.push(found[k]);
    }
  }
  if (segs.length < 2) return;

  const groups = clustersOf(segs);
  for (let g = 0; g < groups.length; g++) {
    const idxs = groups[g].slice().sort((a, b) => {
      const da = segs[a].perp - segs[b].perp;
      if (Math.abs(da) > EPS) return da;
      const id = pathIds[segs[a].path].localeCompare(pathIds[segs[b].path]);
      if (id !== 0) return id;
      return segs[a].i0 - segs[b].i0;
    });

    let mean = 0;
    for (let i = 0; i < idxs.length; i++) mean += segs[idxs[i]].perp;
    mean /= idxs.length;

    for (let k = 0; k < idxs.length; k++) {
      const seg = segs[idxs[k]];
      const target = mean + (k - (idxs.length - 1) / 2) * gap;
      const delta = target - seg.perp;
      if (Math.abs(delta) < EPS) continue;
      const pts = clones[seg.path];
      if (axis === 'h') {
        pts[seg.i0].y += delta;
        pts[seg.i1].y += delta;
      } else {
        pts[seg.i0].x += delta;
        pts[seg.i1].x += delta;
      }
    }
  }
};

/**
 * Schiebt parallele Innenstücke auseinander. Start- und Zielpunkte bleiben.
 * Pfade, die danach ein Hindernis schneiden, werden auf das Original zurückgesetzt.
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
    const id = ids[i];
    const start = originals[i][0];
    const end = originals[i][originals[i].length - 1];
    clones[i][0] = { x: start.x, y: start.y };
    clones[i][clones[i].length - 1] = { x: end.x, y: end.y };

    const candidate = clones[i];
    const ok =
      isOrthogonalPath(candidate) &&
      (obstacles.length === 0 || !pathHitsObstacles(candidate, obstacles));
    out.set(id, ok ? candidate : originals[i]);
  }
  return out;
}
