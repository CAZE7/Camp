/**
 * Scope-fähiges orthogonales Nudging (libavoid-Phase 2) — Industrie-Version.
 *
 * Unterschied zur globalen Version:
 *   - Nur betroffene Pfade (nach Dirty-Region) dürfen verschoben werden.
 *   - Korridore, die von betroffenen UND unbeffected Pfaden geteilt werden,
 *     bekommen nur den betroffenen Teil verschoben; der unbeffected Teil bleibt.
 *   - Pfade ohne betroffene Segmente im Korridor bleiben unverändert.
 *
 * Volle Qualität wird mit globalem Nudging beim Drag-Ende nachgerüstet.
 */

import type { Point, Rect } from './pathfinding';
import { isOrthogonalPath, pathHitsObstacles, containsPoint, stitchOrthogonal } from './pathfinding';

export const NUDGE_GAP = 16;
export const NUDGE_THRESHOLD = 10;
const NUDGE_MIN_OVERLAP = 12;

const EPS = 1e-6;

/** Gebundener Lesezugriff in abgesicherten Schleifen — siehe pathfinding.at. */
const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) {
    throw new RangeError(`nudge.at: Index ${i} außerhalb (Länge ${arr.length})`);
  }
  return v as T;
};

export type NudgePath = { id: string; waypoints: Point[] };

type Seg = {
  path: number;
  i0: number;
  i1: number;
  lo: number;
  hi: number;
  perp: number;
  clusterKey: number;
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
        clusterKey: -1,
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
        clusterKey: -1,
      });
    }
  }
  return segs;
};

/** Union-Find für Segment-Cluster. */
const clusterSegments = (
  segs: Seg[],
  threshold: number,
  _minOverlap: number
): { parent: number[]; _groupIds: Map<number, number>; clusterCount: number } => {
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
      if (Math.abs(at(segs, i).perp - at(segs, j).perp) > threshold) continue;
      if (!rangesOverlap(at(segs, i).lo, at(segs, i).hi, at(segs, j).lo, at(segs, j).hi)) continue;
      union(i, j);
    }
  }

  const _groupIds = new Map<number, number>();
  const clusterCount = new Set<number>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    clusterCount.add(root);
    if (!_groupIds.has(root)) {
      _groupIds.set(root, _groupIds.size);
    }
    at(segs, i).clusterKey = _groupIds.get(root)!;
  }

  return { parent, _groupIds, clusterCount: clusterCount.size };
};

/** Nur echte Innenpunkte verschieben — Stubs bekommen später einen Ellbogen. */
const isFreeVertex = (index: number, n: number): boolean => index >= 2 && index <= n - 3;

/**
 * Apply Nudging auf betroffene Lanes.
 *
 * `affectedPathIds` — Menge der Kanten-IDs, die verschoben werden dürfen
 * (alle anderen bleiben unverändert, auch wenn sie denselben Korridor teilen).
 *
 * Korridore, die von betroffenen UND unbeffected Pfaden geteilt werden,
 * werden nur für den betroffenen Teil verschoben.
 */
const applyAxisScoped = (
  clones: Point[][],
  originals: Point[][],
  pathIds: string[],
  pathIndexById: Map<string, number>,
  affectedPathIds: ReadonlySet<string>,
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

  // Cluster bilden
  const { parent, _groupIds } = clusterSegments(segs, NUDGE_THRESHOLD, NUDGE_MIN_OVERLAP);

  // Cluster-Gruppen (wiederkehrende Indices)
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < segs.length; i++) {
    const root = at(parent, i);
    const list = buckets.get(root);
    if (list) list.push(i);
    else buckets.set(root, [i]);
  }

  // Nur große Cluster (mind. 2 Segmente) weiterverarbeiten
  const groups = Array.from(buckets.values()).filter((g) => g.length > 1);

  for (let g = 0; g < groups.length; g++) {
    const group = at(groups, g);

    // Welche Pfade sind in diesem Cluster betroffen?
    const byPath = new Map<number, number[]>();
    for (let t = 0; t < group.length; t++) {
      const si = at(group, t);
      const p = at(segs, si).path;
      const list = byPath.get(p);
      if (list) list.push(si);
      else byPath.set(p, [si]);
    }

    // Nur wenn mindestens 2 verschiedene Pfade im Cluster sind UND
    // mindestens einer davon betroffen ist
    const affectedPathsInCluster = new Set<number>();
    for (const [, pathIndices] of byPath) {
      for (const si of pathIndices) {
        const pathId = at(pathIds, at(segs, si).path) || '';
        if (affectedPathIds.has(pathId)) {
          affectedPathsInCluster.add(at(segs, si).path);
          break;
        }
      }
    }

    if (affectedPathsInCluster.size < 1) continue;

    // Pfad-Reihenfolge: nach Perp-Koordinate, dann ID
    const pathOrder = Array.from(byPath.keys()).sort((pa, pb) => {
      const da = at(segs, at(byPath.get(pa)!, 0)).perp - at(segs, at(byPath.get(pb)!, 0)).perp;
      if (Math.abs(da) > EPS) return da;
      const pathA = at(pathIds, pa);
      const pathB = at(pathIds, pb);
      return (pathA || '').localeCompare(pathB || '');
    });

    // Mittelwert aller betroffenen Pfade im Cluster
    let affectedMean = 0;
    let affectedCount = 0;
    for (const p of pathOrder) {
      if (!affectedPathsInCluster.has(p)) continue;
      affectedMean += at(segs, at(byPath.get(p)!, 0)).perp;
      affectedCount++;
    }
    if (affectedCount === 0) continue;
    affectedMean /= affectedCount;

    // Verschiebe nur betroffene Pfade auf Lane-Positionen
    for (let k = 0; k < pathOrder.length; k++) {
      const p = at(pathOrder, k);
      if (!affectedPathsInCluster.has(p)) continue;

      const target = affectedMean + (k - (affectedCount - 1) / 2) * gap;
      const delta = target - at(segs, at(byPath.get(p)!, 0)).perp;
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
 * Schiebt nur betroffene parallele Innenstücke auseinander.
 * Start- und Zielpunkte bleiben. Pfade, die danach ein fremdes Hindernis
 * schneiden, fallen auf das Original zurück.
 *
 * `affectedPathIds` — nur diese Pfade dürfen verschoben werden.
 * Korridore ohne betroffene Pfade werden nicht berührt.
 */
export function nudgeOrthogonalPaths(
  paths: NudgePath[],
  options?: {
    obstacles?: Rect[];
    gap?: number;
    affectedPathIds?: ReadonlySet<string>;
  }
): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  if (paths.length === 0) return out;

  const originals = clonePaths(paths);
  const clones = clonePaths(paths);
  const ids = paths.map((p) => p.id);
  const gap = options?.gap ?? NUDGE_GAP;
  const obstacles = options?.obstacles ?? [];

  // AffectedPathIds: wenn nicht angegeben, alle betroffen (globales Verhalten)
  const affected = options?.affectedPathIds ?? new Set(ids);

  // PathIndex map für schnellen Lookup
  const pathIndexById = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) {
    pathIndexById.set(ids[i]!, i);
  }

  // Nur betroffene Achsen verarbeiten
  applyAxisScoped(clones, originals, ids, pathIndexById, affected, 'h', gap);
  applyAxisScoped(clones, originals, ids, pathIndexById, affected, 'v', gap);

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
