import { Position, Node } from 'reactflow';
import { polylineMidpoint, waypointsToPath } from './pathUtils';

/**
 * Orthogonaler Kabel-Router — Hanan-Grid-A* mit Knickkosten.
 *
 * Marktüblicher Stand für Schaltplan-/Diagramm-Routing (libavoid, ELK, yFiles):
 *
 * 1. Katalog (Gerade / L / Z / U) — wenn kollisionsfrei, ist die Länge
 *    manhattan-optimal. Wird zuerst versucht.
 * 2. Sonst A* auf dem Hanan-Grid der Hindernis-Kanten plus Start/Ziel.
 *    Das Grid enthält einen kürzesten rechtwinkligen Pfad zwischen Rechtecken
 *    (Hanan 1966; Larson/Li). Zustand ist (x, y, heading), damit Knicke
 *    korrekt bepreist werden.
 * 3. Port-Zwang: erste/letzte Kante folgen der Handle-Richtung.
 * 4. Clearance: Hindernisse werden aufgebläht, Routing läuft auf dem Rand.
 * 5. Deterministisch, ohne Zufall, mit LRU-Cache für den Render-Hot-Pfad.
 *
 * Kein 8-connected JPS: bei Knickkosten würde Springen optimale Abbiegungen
 * überspringen. 4-connected A* auf dem Hanan-Grid ist vollständig und schnell.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Segment = [Point, Point];

export const ROUTE_BORDER_RADIUS = 10;
export const ROUTE_MIN_STUB = 24;
export const OBSTACLE_MARGIN = 14;
export const NODE_FALLBACK_WIDTH = 192;
export const NODE_FALLBACK_HEIGHT = 120;
export const BEND_COST = 80;
export const U_TURN_COST = 400;
export const MAX_EXPANSIONS = 48_000;
export const MAX_ACCEPTABLE_CROSSINGS = 2;
export const ALTERNATIVE_ROUTE_GAP = 40;

const EPS = 1e-6;
const QUANT = 2; // 0.5 px
const CACHE_LIMIT = 256;

export const quantize = (n: number): number => Math.round(n * QUANT) / QUANT;

export const manhattan = (a: Point, b: Point): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const inflateRect = (r: Rect, margin: number): Rect => ({
  x: r.x - margin,
  y: r.y - margin,
  width: r.width + margin * 2,
  height: r.height + margin * 2,
});

export const containsPoint = (r: Rect, p: Point): boolean =>
  p.x > r.x + EPS && p.x < r.x + r.width - EPS && p.y > r.y + EPS && p.y < r.y + r.height - EPS;

/** Echter Schnitt eines achsenparallelen Segments mit dem Inneren der Box. */
export function segmentHitsRect(a: Point, b: Point, r: Rect): boolean {
  if (Math.abs(a.x - b.x) <= EPS) {
    const x = a.x;
    if (x <= r.x + EPS || x >= r.x + r.width - EPS) return false;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return hi > r.y + EPS && lo < r.y + r.height - EPS;
  }
  if (Math.abs(a.y - b.y) <= EPS) {
    const y = a.y;
    if (y <= r.y + EPS || y >= r.y + r.height - EPS) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return hi > r.x + EPS && lo < r.x + r.width - EPS;
  }
  return true;
}

export function segmentHitsAny(a: Point, b: Point, obstacles: Rect[]): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    if (segmentHitsRect(a, b, obstacles[i])) return true;
  }
  return false;
}

export function pathHitsObstacles(points: Point[], obstacles: Rect[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentHitsAny(points[i], points[i + 1], obstacles)) return true;
  }
  return false;
}

export function isOrthogonalPath(points: Point[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

export function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) len += manhattan(points[i], points[i + 1]);
  return len;
}

export function countBends(points: Point[]): number {
  let bends = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inH = Math.abs(curr.y - prev.y) <= EPS;
    const outH = Math.abs(next.y - curr.y) <= EPS;
    if (inH !== outH) bends++;
  }
  return bends;
}

export function simplifyWaypoints(points: Point[]): Point[] {
  if (points.length <= 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Point[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const last = out[out.length - 1];
    if (Math.abs(last.x - p.x) <= EPS && Math.abs(last.y - p.y) <= EPS) continue;
    out.push({ x: p.x, y: p.y });
  }
  const collapsed: Point[] = [];
  for (let i = 0; i < out.length; i++) {
    if (collapsed.length >= 2) {
      const a = collapsed[collapsed.length - 2];
      const b = collapsed[collapsed.length - 1];
      const c = out[i];
      const vertical = Math.abs(a.x - b.x) <= EPS && Math.abs(b.x - c.x) <= EPS;
      const horizontal = Math.abs(a.y - b.y) <= EPS && Math.abs(b.y - c.y) <= EPS;
      if (vertical || horizontal) {
        const sameDir = vertical
          ? (b.y - a.y) * (c.y - b.y) >= -EPS
          : (b.x - a.x) * (c.x - b.x) >= -EPS;
        if (sameDir) {
          collapsed[collapsed.length - 1] = c;
          continue;
        }
      }
    }
    collapsed.push(out[i]);
  }
  return collapsed;
}

export const sourceExitVector = (position?: Position): Point => {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
    case Position.Right:
    default:
      return { x: 1, y: 0 };
  }
};

export const targetEntryVector = (position?: Position): Point => {
  const d = sourceExitVector(position);
  return { x: d.x === 0 ? 0 : -d.x, y: d.y === 0 ? 0 : -d.y };
};

const headingFromDir = (d: Point): number => {
  if (d.x > 0) return 0;
  if (d.y < 0) return 1;
  if (d.x < 0) return 2;
  return 3;
};

const DIR: Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
];

const turnCost = (from: number, to: number): number => {
  if (from === to) return 0;
  if (((from + 2) & 3) === to) return U_TURN_COST;
  return BEND_COST;
};

const lowerBound = (arr: number[], value: number): number => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value - EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const snapIndex = (arr: number[], value: number): number => {
  const i = lowerBound(arr, value);
  if (i < arr.length && Math.abs(arr[i] - value) <= 0.51) return i;
  if (i > 0 && Math.abs(arr[i - 1] - value) <= 0.51) return i - 1;
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < arr.length; k++) {
    const d = Math.abs(arr[k] - value);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
};

type HeapItem = { f: number; g: number; h: number; ix: number; iy: number; hd: number };

class MinHeap {
  private data: HeapItem[] = [];

  get size(): number {
    return this.data.length;
  }

  push(item: HeapItem): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapItem | undefined {
    const data = this.data;
    if (data.length === 0) return undefined;
    const top = data[0];
    const last = data.pop()!;
    if (data.length > 0) {
      data[0] = last;
      this.sink(0);
    }
    return top;
  }

  private less(a: HeapItem, b: HeapItem): boolean {
    if (a.f !== b.f) return a.f < b.f;
    if (a.h !== b.h) return a.h < b.h;
    if (a.ix !== b.ix) return a.ix < b.ix;
    if (a.iy !== b.iy) return a.iy < b.iy;
    return a.hd < b.hd;
  }

  private bubbleUp(i: number): void {
    const data = this.data;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(data[i], data[p])) break;
      const tmp = data[i];
      data[i] = data[p];
      data[p] = tmp;
      i = p;
    }
  }

  private sink(i: number): void {
    const data = this.data;
    const n = data.length;
    while (true) {
      const l = i * 2 + 1;
      const r = l + 1;
      let smallest = i;
      if (l < n && this.less(data[l], data[smallest])) smallest = l;
      if (r < n && this.less(data[r], data[smallest])) smallest = r;
      if (smallest === i) break;
      const tmp = data[i];
      data[i] = data[smallest];
      data[smallest] = tmp;
      i = smallest;
    }
  }
}

const uniqueSorted = (values: number[]): number[] => {
  const rounded = values.map(quantize).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < rounded.length; i++) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - rounded[i]) > 1 / QUANT / 2) {
      out.push(rounded[i]);
    }
  }
  return out;
};

const stubPoint = (p: Point, dir: Point, stub: number): Point => ({
  x: quantize(p.x + dir.x * stub),
  y: quantize(p.y + dir.y * stub),
});

/**
 * Klassischer orthogonaler Katalog: Gerade, L, Z, U — port-treu.
 * Länge ist manhattan (bzw. manhattan + 2*loop bei U). Wenn frei, optimal.
 */
export function catalogWaypoints(input: {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  offset?: number;
}): Point[] {
  const ds = sourceExitVector(input.sourcePosition);
  const dt = targetEntryVector(input.targetPosition);
  const offset = input.offset ?? 0;
  const stub = ROUTE_MIN_STUB + Math.abs(offset) * 0.15;
  const S: Point = { x: input.sourceX, y: input.sourceY };
  const T: Point = { x: input.targetX, y: input.targetY };
  const S2 = stubPoint(S, ds, stub);
  const T2 = stubPoint(T, { x: -dt.x, y: -dt.y }, stub);

  const points: Point[] = [S, S2];
  const horizS = Math.abs(ds.x) === 1;
  const horizT = Math.abs(dt.x) === 1;

  if (horizS && horizT) {
    if (ds.x === dt.x) {
      const midX = quantize((S2.x + T2.x) / 2 + offset);
      points.push({ x: midX, y: S2.y });
      points.push({ x: midX, y: T2.y });
    } else {
      const sameRow = Math.abs(S2.y - T2.y) <= EPS;
      const facing =
        (ds.x > 0 && T2.x >= S2.x - EPS) || (ds.x < 0 && T2.x <= S2.x + EPS);
      if (sameRow && facing && offset === 0) {
        // gerade
      } else if (facing) {
        const midX = quantize((S2.x + T2.x) / 2 + offset);
        points.push({ x: midX, y: S2.y });
        points.push({ x: midX, y: T2.y });
      } else {
        const dir = ds.x > 0 ? 1 : -1;
        const loopX = quantize(
          (dir > 0 ? Math.max(S2.x, T2.x) : Math.min(S2.x, T2.x)) +
            dir * (ROUTE_MIN_STUB * 2 + Math.abs(offset))
        );
        points.push({ x: loopX, y: S2.y });
        points.push({ x: loopX, y: T2.y });
      }
    }
  } else if (!horizS && !horizT) {
    if (ds.y === dt.y) {
      const midY = quantize((S2.y + T2.y) / 2 + offset);
      points.push({ x: S2.x, y: midY });
      points.push({ x: T2.x, y: midY });
    } else {
      const sameCol = Math.abs(S2.x - T2.x) <= EPS;
      const facing =
        (ds.y > 0 && T2.y >= S2.y - EPS) || (ds.y < 0 && T2.y <= S2.y + EPS);
      if (sameCol && facing && offset === 0) {
        // gerade
      } else if (facing) {
        const midY = quantize((S2.y + T2.y) / 2 + offset);
        points.push({ x: S2.x, y: midY });
        points.push({ x: T2.x, y: midY });
      } else {
        const dir = ds.y > 0 ? 1 : -1;
        const loopY = quantize(
          (dir > 0 ? Math.max(S2.y, T2.y) : Math.min(S2.y, T2.y)) +
            dir * (ROUTE_MIN_STUB * 2 + Math.abs(offset))
        );
        points.push({ x: S2.x, y: loopY });
        points.push({ x: T2.x, y: loopY });
      }
    }
  } else if (horizS) {
    points.push({ x: T2.x, y: S2.y });
  } else {
    points.push({ x: S2.x, y: T2.y });
  }

  points.push(T2, T);
  return simplifyWaypoints(points);
}

const orientation = (a: Point, b: Point, c: Point): number => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (a: Point, b: Point, c: Point): boolean =>
  b.x <= Math.max(a.x, c.x) + 1e-9 &&
  b.x >= Math.min(a.x, c.x) - 1e-9 &&
  b.y <= Math.max(a.y, c.y) + 1e-9 &&
  b.y >= Math.min(a.y, c.y) - 1e-9;

export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const [p1, q1] = s1;
  const [p2, q2] = s2;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

export function waypointsToSegments(points: Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].x !== points[i + 1].x || points[i].y !== points[i + 1].y) {
      segments.push([points[i], points[i + 1]]);
    }
  }
  return segments;
}

export function countCrossings(waypoints: Point[], others: Segment[]): number {
  if (others.length === 0 || waypoints.length < 2) return 0;
  const own = waypointsToSegments(waypoints);
  let count = 0;
  for (let i = 0; i < others.length; i++) {
    const other = others[i];
    for (let j = 0; j < own.length; j++) {
      if (segmentsIntersect(own[j], other)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function hananAStar(
  start: Point,
  goal: Point,
  startHeading: number,
  goalHeading: number,
  obstacles: Rect[],
  extraXs: number[],
  extraYs: number[],
  clip?: { minX: number; maxX: number; minY: number; maxY: number }
): Point[] | null {
  let xs = uniqueSorted([
    start.x,
    goal.x,
    ...extraXs,
    ...obstacles.flatMap((r) => [r.x, r.x + r.width]),
  ]);
  let ys = uniqueSorted([
    start.y,
    goal.y,
    ...extraYs,
    ...obstacles.flatMap((r) => [r.y, r.y + r.height]),
  ]);

  if (clip) {
    const keepX = (x: number) => x >= clip.minX && x <= clip.maxX;
    const keepY = (y: number) => y >= clip.minY && y <= clip.maxY;
    xs = uniqueSorted([start.x, goal.x, ...xs.filter(keepX)]);
    ys = uniqueSorted([start.y, goal.y, ...ys.filter(keepY)]);
  } else if (xs.length * ys.length > 20_000) {
    const pad = 120;
    return hananAStar(start, goal, startHeading, goalHeading, obstacles, extraXs, extraYs, {
      minX: Math.min(start.x, goal.x) - pad,
      maxX: Math.max(start.x, goal.x) + pad,
      minY: Math.min(start.y, goal.y) - pad,
      maxY: Math.max(start.y, goal.y) + pad,
    });
  }

  const nx = xs.length;
  const ny = ys.length;
  const six = snapIndex(xs, start.x);
  const siy = snapIndex(ys, start.y);
  const gix = snapIndex(xs, goal.x);
  const giy = snapIndex(ys, goal.y);

  const blocked = new Uint8Array(nx * ny);
  for (let o = 0; o < obstacles.length; o++) {
    const r = obstacles[o];
    for (let iy = 0; iy < ny; iy++) {
      const y = ys[iy];
      if (y <= r.y + EPS || y >= r.y + r.height - EPS) continue;
      const row = iy * nx;
      for (let ix = 0; ix < nx; ix++) {
        const x = xs[ix];
        if (x > r.x + EPS && x < r.x + r.width - EPS) blocked[row + ix] = 1;
      }
    }
  }
  blocked[siy * nx + six] = 0;
  blocked[giy * nx + gix] = 0;

  const pack = (ix: number, iy: number, hd: number): number => ((iy * nx + ix) << 2) | hd;
  const gScore = new Map<number, number>();
  const parent = new Map<number, number>();

  const startKey = pack(six, siy, startHeading);
  gScore.set(startKey, 0);
  const heap = new MinHeap();
  const h0 = Math.abs(xs[six] - xs[gix]) + Math.abs(ys[siy] - ys[giy]);
  heap.push({ f: h0, g: 0, h: h0, ix: six, iy: siy, hd: startHeading });

  let expansions = 0;
  let bestGoalKey = -1;
  let bestGoalG = Infinity;

  while (heap.size > 0) {
    const cur = heap.pop()!;
    const key = pack(cur.ix, cur.iy, cur.hd);
    const known = gScore.get(key);
    if (known !== undefined && cur.g > known + EPS) continue;

    expansions++;
    if (expansions > MAX_EXPANSIONS) break;

    if (cur.ix === gix && cur.iy === giy) {
      const finish = cur.g + turnCost(cur.hd, goalHeading);
      if (finish < bestGoalG) {
        bestGoalG = finish;
        bestGoalKey = key;
      }
      if (cur.hd === goalHeading) break;
      continue;
    }

    if (cur.g + cur.h >= bestGoalG) continue;

    for (let nd = 0; nd < 4; nd++) {
      const dix = DIR[nd].x;
      const diy = DIR[nd].y;
      const nix = cur.ix + dix;
      const niy = cur.iy + diy;
      if (nix < 0 || niy < 0 || nix >= nx || niy >= ny) continue;
      if (blocked[niy * nx + nix]) continue;

      const a: Point = { x: xs[cur.ix], y: ys[cur.iy] };
      const b: Point = { x: xs[nix], y: ys[niy] };
      if (segmentHitsAny(a, b, obstacles)) continue;

      const step = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      if (step <= EPS) continue;
      const g = cur.g + step + turnCost(cur.hd, nd);
      const nkey = pack(nix, niy, nd);
      const prev = gScore.get(nkey);
      if (prev !== undefined && g >= prev - EPS) continue;
      gScore.set(nkey, g);
      parent.set(nkey, key);
      const h = Math.abs(xs[nix] - xs[gix]) + Math.abs(ys[niy] - ys[giy]);
      heap.push({ f: g + h, g, h, ix: nix, iy: niy, hd: nd });
    }
  }

  if (bestGoalKey < 0) return null;

  const pts: Point[] = [];
  let k = bestGoalKey;
  const seen = new Set<number>();
  while (true) {
    if (seen.has(k)) break;
    seen.add(k);
    const cell = k >> 2;
    const ix = cell % nx;
    const iy = (cell / nx) | 0;
    pts.push({ x: xs[ix], y: ys[iy] });
    const p = parent.get(k);
    if (p === undefined) break;
    k = p;
  }
  pts.reverse();

  if (pts.length === 0) return null;
  if (Math.abs(pts[0].x - start.x) > EPS || Math.abs(pts[0].y - start.y) > EPS) {
    pts.unshift({ x: start.x, y: start.y });
  }
  const last = pts[pts.length - 1];
  if (Math.abs(last.x - goal.x) > EPS || Math.abs(last.y - goal.y) > EPS) {
    pts.push({ x: goal.x, y: goal.y });
  }
  return simplifyWaypoints(pts);
}

export type PathRequest = {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  offset?: number;
  obstacles?: Rect[];
  borderRadius?: number;
  crossingSegments?: Segment[];
  /** Test-Hook: Cache umgehen. */
  skipCache?: boolean;
};

export type PathResult = {
  path: string;
  waypoints: Point[];
  labelX: number;
  labelY: number;
  offsetX: number;
  offsetY: number;
  length: number;
  bends: number;
  crossings: number;
  usedSearch: 'catalog' | 'astar' | 'fallback';
};

const cache = new Map<string, PathResult>();

export const clearPathfindingCache = (): void => {
  cache.clear();
};

const obstacleKey = (obstacles: Rect[]): string => {
  if (obstacles.length === 0) return '';
  let s = `${obstacles.length}:`;
  for (let i = 0; i < obstacles.length; i++) {
    const r = obstacles[i];
    s += `${quantize(r.x)},${quantize(r.y)},${quantize(r.width)},${quantize(r.height)};`;
  }
  return s;
};

const requestKey = (input: PathRequest, obstacles: Rect[]): string =>
  `${quantize(input.sourceX)},${quantize(input.sourceY)},${input.sourcePosition ?? ''},` +
  `${quantize(input.targetX)},${quantize(input.targetY)},${input.targetPosition ?? ''},` +
  `${input.offset ?? 0},${input.borderRadius ?? ROUTE_BORDER_RADIUS},` +
  `${obstacleKey(obstacles)},${input.crossingSegments?.length ?? 0}`;

const cacheGet = (key: string): PathResult | undefined => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
};

const cacheSet = (key: string, value: PathResult): void => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
};

const relevantObstacles = (obstacles: Rect[], start: Point, end: Point): Rect[] => {
  const out: Rect[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const r = obstacles[i];
    if (containsPoint(r, start) || containsPoint(r, end)) continue;
    out.push(r);
  }
  return out;
};

const scorePath = (points: Point[], crossings: number): number =>
  pathLength(points) + BEND_COST * countBends(points) + 120 * crossings;

function assemble(
  waypoints: Point[],
  crossings: number,
  usedSearch: PathResult['usedSearch'],
  radius: number
): PathResult {
  const clean = simplifyWaypoints(waypoints);
  const mid = polylineMidpoint(clean);
  return {
    path: waypointsToPath(clean, radius),
    waypoints: clean,
    labelX: mid.x,
    labelY: mid.y,
    offsetX: 0,
    offsetY: 0,
    length: pathLength(clean),
    bends: countBends(clean),
    crossings,
    usedSearch,
  };
}

function searchOnce(
  input: PathRequest,
  obstacles: Rect[],
  offset: number
): { waypoints: Point[]; usedSearch: PathResult['usedSearch'] } {
  const catalog = catalogWaypoints({ ...input, offset });
  if (!pathHitsObstacles(catalog, obstacles)) {
    return { waypoints: catalog, usedSearch: 'catalog' };
  }

  const ds = sourceExitVector(input.sourcePosition);
  const dt = targetEntryVector(input.targetPosition);
  const S: Point = { x: quantize(input.sourceX), y: quantize(input.sourceY) };
  const T: Point = { x: quantize(input.targetX), y: quantize(input.targetY) };

  const pickStub = (from: Point, dir: Point): Point => {
    let stub = ROUTE_MIN_STUB + Math.abs(offset) * 0.15;
    let p = stubPoint(from, dir, stub);
    while (stub > 4 && (segmentHitsAny(from, p, obstacles) || obstacles.some((r) => containsPoint(r, p)))) {
      stub *= 0.5;
      p = stubPoint(from, dir, stub);
    }
    return p;
  };

  const S2 = pickStub(S, ds);
  const T2 = pickStub(T, { x: -dt.x, y: -dt.y });

  const extraXs = [S2.x, T2.x, (S2.x + T2.x) / 2 + offset];
  const extraYs = [S2.y, T2.y, (S2.y + T2.y) / 2 + offset];
  if (obstacles.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < obstacles.length; i++) {
      const r = obstacles[i];
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    extraXs.push(minX - 16, maxX + 16);
    extraYs.push(minY - 16, maxY + 16);
  }

  const inner = hananAStar(
    S2,
    T2,
    headingFromDir(ds),
    headingFromDir(dt),
    obstacles,
    extraXs,
    extraYs
  );

  if (inner && inner.length >= 1) {
    const full = simplifyWaypoints([S, ...inner, T]);
    if (!pathHitsObstacles(full, obstacles) || !pathHitsObstacles(catalog, obstacles)) {
      const hits = pathHitsObstacles(full, obstacles);
      if (!hits) return { waypoints: full, usedSearch: 'astar' };
    }
  }

  return { waypoints: catalog, usedSearch: 'fallback' };
}

/**
 * Vollständiger Router: Katalog → Hanan-A* → Fallback.
 * Bei vielen Kreuzungen werden parallele Trassen (±40/±80 px) bewertet.
 */
export function findCablePath(input: PathRequest): PathResult {
  const radius = input.borderRadius ?? ROUTE_BORDER_RADIUS;
  const allObstacles = input.obstacles ?? [];
  const start: Point = { x: input.sourceX, y: input.sourceY };
  const end: Point = { x: input.targetX, y: input.targetY };
  const obstacles = relevantObstacles(allObstacles, start, end).map((r) =>
    inflateRect(r, OBSTACLE_MARGIN)
  );
  const crossingSegments = input.crossingSegments ?? [];
  const key = requestKey(input, obstacles);

  if (!input.skipCache) {
    const hit = cacheGet(key);
    if (hit) return hit;
  }

  const baseOffset = input.offset ?? 0;
  let best = searchOnce(input, obstacles, baseOffset);
  let bestCross = countCrossings(best.waypoints, crossingSegments);
  let bestScore = scorePath(best.waypoints, bestCross);

  if (crossingSegments.length > 0 && bestCross > MAX_ACCEPTABLE_CROSSINGS) {
    const candidates = [
      baseOffset + ALTERNATIVE_ROUTE_GAP,
      baseOffset - ALTERNATIVE_ROUTE_GAP,
      baseOffset + ALTERNATIVE_ROUTE_GAP * 2,
      baseOffset - ALTERNATIVE_ROUTE_GAP * 2,
    ];
    for (let i = 0; i < candidates.length; i++) {
      const cand = searchOnce(input, obstacles, candidates[i]);
      const cross = countCrossings(cand.waypoints, crossingSegments);
      const score = scorePath(cand.waypoints, cross);
      if (score < bestScore - EPS || (Math.abs(score - bestScore) <= EPS && cross < bestCross)) {
        best = cand;
        bestCross = cross;
        bestScore = score;
        if (bestCross <= MAX_ACCEPTABLE_CROSSINGS) break;
      }
    }
  }

  const result = assemble(best.waypoints, bestCross, best.usedSearch, radius);
  if (!input.skipCache) cacheSet(key, result);
  return result;
}

export function nodesToObstacles(nodes: Node[], excludeIds: Set<string>): Rect[] {
  const rects: Rect[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || excludeIds.has(node.id)) continue;
    const width = node.width || NODE_FALLBACK_WIDTH;
    const height = node.height || NODE_FALLBACK_HEIGHT;
    rects.push({
      x: node.positionAbsolute?.x ?? node.position.x,
      y: node.positionAbsolute?.y ?? node.position.y,
      width,
      height,
    });
  }
  return rects;
}

export type CrossingEdgeRef = { id: string; source: string; target: string };

export function edgesToCrossingSegments(
  edges: CrossingEdgeRef[],
  nodes: Node[],
  skip: (edge: CrossingEdgeRef) => boolean
): Segment[] {
  const centers = new Map<string, Point>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    centers.set(node.id, {
      x: node.position.x + (node.width || NODE_FALLBACK_WIDTH) / 2,
      y: node.position.y + (node.height || NODE_FALLBACK_HEIGHT) / 2,
    });
  }
  const segments: Segment[] = [];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (skip(edge)) continue;
    const a = centers.get(edge.source);
    const b = centers.get(edge.target);
    if (!a || !b) continue;
    segments.push([a, b]);
  }
  return segments;
}
