import { Position, type Node } from 'reactflow';
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

/**
 * Kostenmodell (R-2, agent.md): alle Kosten sind **px-äquivalent** —
 * 1 Kosteneinheit entspricht 1 px Leitungslänge (`scorePath` addiert
 * Länge + BEND_COST · Biegungen + 120 · Kreuzungen).
 *
 * - `BEND_COST = 80`: eine 90°-Biegung kostet so viel wie 80 px Extraweg.
 *   Der Router nimmt also höchstens 80 px Detour in Kauf, um eine Ecke zu
 *   sparen — logisch ruhige Leitungen mit wenigen Knicken schlagen kürzere
 *   zickzackige. Muss die Leitung mehr als 80 px Umweg laufen, gewinnt die
 *   Abkürzung. Nach unten korrigieren → mehr Biegungen, oben → mehr Länge.
 *
 * - `U_TURN_COST = 400` (= 5 Biegungen): eine 180°-Kehre ist teurer als
 *   jeder Zickzack-Bogen aus bis zu 4 Ecken und wird nur gewählt, wenn die
 *   Geometrie sie erzwingt (Ziel hinter der Quelle). Die A*-Heuristik
 *   (`remainingCostLowerBound`) schätzt Kehren mit
 *   `Math.min(U_TURN_COST, 2 * BEND_COST)` = 160 — damit bleibt sie
 *   zulässig (nie höher als die echten Restkosten) und A* bleibt optimal.
 *
 * Geprüft wird die Ordnung in `orthogonalRouting.invariants.test.ts`
 * (Abschnitt „Kostenmodell (R-2)“): Gerade < L < Z < Zickzack, Kehre zuletzt.
 */
export const BEND_COST = 80;
export const U_TURN_COST = 400;

/** Abstand der Rücklauflane vom Stub bei erzwungenen U-Loops (2 Parallellanes). */
export const U_TURN_LANE_SPREAD = 2 * 16;
export const MAX_EXPANSIONS = 48_000;
export const MAX_ACCEPTABLE_CROSSINGS = 2;

/** Ausweich-Trassen (R-5): 3 und 6 Lanes à 16 px — siehe orthogonalRouting. */
export const ALTERNATIVE_ROUTE_GAP = 48;

const EPS = 1e-6;
const QUANT = 2; // 0.5 px
const CACHE_LIMIT = 256;

import { readHandleBounds } from './orthogonalRouting';

export const quantize = (n: number): number => Math.round(n * QUANT) / QUANT;

export const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Gebundener Lesezugriff in beweisbar abgesicherten Schleifen
 * (i < arr.length bzw. Heap-/Grid-Invarianten). noUncheckedIndexedAccess
 * zwingt, das aus der Schleifenbedingung folgende Nicht-undefined
 * auszudrücken — statt dutzender Non-Null-Assertionen im Hot Path genau
 * diese eine Stelle, inkl. hartem Laufzeit-Riegel, falls eine Invariante
 * je brechen sollte.
 */
const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) {
    throw new RangeError(`pathfinding.at: Index ${i} außerhalb (Länge ${arr.length})`);
  }
  return v;
};

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
    if (segmentHitsRect(a, b, at(obstacles, i))) return true;
  }
  return false;
}

export function pathHitsObstacles(points: Point[], obstacles: Rect[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentHitsAny(at(points, i), at(points, i + 1), obstacles)) return true;
  }
  return false;
}

export function isOrthogonalPath(points: Point[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = at(points, i);
    const b = at(points, i + 1);
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

export function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) len += manhattan(at(points, i), at(points, i + 1));
  return len;
}

export function countBends(points: Point[]): number {
  let bends = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = at(points, i - 1);
    const curr = at(points, i);
    const next = at(points, i + 1);
    const inH = Math.abs(curr.y - prev.y) <= EPS;
    const outH = Math.abs(next.y - curr.y) <= EPS;
    if (inH !== outH) bends++;
  }
  return bends;
}

/** Fügt einen Ellbogen ein, falls zwei aufeinanderfolgende Punkte diagonal liegen. */
export function stitchOrthogonal(points: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = at(points, i);
    const last = out.at(-1);
    if (last && Math.abs(last.x - p.x) > EPS && Math.abs(last.y - p.y) > EPS) {
      out.push({ x: p.x, y: last.y });
    }
    out.push({ x: p.x, y: p.y });
  }
  return simplifyWaypoints(out);
}

/**
 * Zulässige Restkostenschätzung: Manhattan plus Mindestknicke.
 * Nie höher als die echten Restkosten — A* bleibt optimal.
 */
export function remainingCostLowerBound(
  x: number,
  y: number,
  hd: number,
  gx: number,
  gy: number,
  gh: number
): number {
  const dx = gx - x;
  const dy = gy - y;
  const len = Math.abs(dx) + Math.abs(dy);
  if (len <= EPS) {
    if (hd === gh) return 0;
    if (((hd + 2) & 3) === gh) return Math.min(U_TURN_COST, 2 * BEND_COST);
    return BEND_COST;
  }
  const needX = Math.abs(dx) > EPS;
  const needY = Math.abs(dy) > EPS;
  const hx = hd === 0 ? 1 : hd === 2 ? -1 : 0;
  const hy = hd === 3 ? 1 : hd === 1 ? -1 : 0;
  let bends = 0;
  if (needX && needY) {
    const matchX = (dx > 0 && hx > 0) || (dx < 0 && hx < 0);
    const matchY = (dy > 0 && hy > 0) || (dy < 0 && hy < 0);
    bends = matchX || matchY ? 1 : 2;
  } else if (needX) {
    const matchX = (dx > 0 && hx > 0) || (dx < 0 && hx < 0);
    if (!matchX) bends = 1;
  } else {
    const matchY = (dy > 0 && hy > 0) || (dy < 0 && hy < 0);
    if (!matchY) bends = 1;
  }
  return len + bends * BEND_COST;
}

export function simplifyWaypoints(points: Point[]): Point[] {
  if (points.length <= 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Point[] = [{ x: at(points, 0).x, y: at(points, 0).y }];
  for (let i = 1; i < points.length; i++) {
    const p = at(points, i);
    const last = at(out, out.length - 1);
    if (Math.abs(last.x - p.x) <= EPS && Math.abs(last.y - p.y) <= EPS) continue;
    out.push({ x: p.x, y: p.y });
  }
  const collapsed: Point[] = [];
  for (let i = 0; i < out.length; i++) {
    if (collapsed.length >= 2) {
      const a = at(collapsed, collapsed.length - 2);
      const b = at(collapsed, collapsed.length - 1);
      const c = at(out, i);
      const vertical = Math.abs(a.x - b.x) <= EPS && Math.abs(b.x - c.x) <= EPS;
      const horizontal = Math.abs(a.y - b.y) <= EPS && Math.abs(b.y - c.y) <= EPS;
      if (vertical || horizontal) {
        const sameDir = vertical ? (b.y - a.y) * (c.y - b.y) >= -EPS : (b.x - a.x) * (c.x - b.x) >= -EPS;
        if (sameDir) {
          collapsed[collapsed.length - 1] = c;
          continue;
        }
      }
    }
    collapsed.push(at(out, i));
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
    if (at(arr, mid) < value - EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const snapIndex = (arr: number[], value: number): number => {
  const i = lowerBound(arr, value);
  if (i < arr.length && Math.abs(at(arr, i) - value) <= 0.51) return i;
  if (i > 0 && Math.abs(at(arr, i - 1) - value) <= 0.51) return i - 1;
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < arr.length; k++) {
    const d = Math.abs(at(arr, k) - value);
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
      if (!this.less(at(data, i), at(data, p))) break;
      const tmp = at(data, i);
      data[i] = at(data, p);
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
      if (l < n && this.less(at(data, l), at(data, smallest))) smallest = l;
      if (r < n && this.less(at(data, r), at(data, smallest))) smallest = r;
      if (smallest === i) break;
      const tmp = at(data, i);
      data[i] = at(data, smallest);
      data[smallest] = tmp;
      i = smallest;
    }
  }
}

const uniqueSorted = (values: number[]): number[] => {
  const rounded = values.map(quantize).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < rounded.length; i++) {
    if (out.length === 0 || Math.abs(at(out, out.length - 1) - at(rounded, i)) > 1 / QUANT / 2) {
      out.push(at(rounded, i));
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
      if (offset === 0 && Math.abs(S2.y - T2.y) > EPS) {
        points.push({ x: S2.x, y: T2.y });
      } else {
        const midX = quantize((S2.x + T2.x) / 2 + offset);
        points.push({ x: midX, y: S2.y });
        points.push({ x: midX, y: T2.y });
      }
    } else {
      const sameRow = Math.abs(S2.y - T2.y) <= EPS;
      const facing = (ds.x > 0 && T2.x >= S2.x - EPS) || (ds.x < 0 && T2.x <= S2.x + EPS);
      if (sameRow && facing && offset === 0) {
        // gerade
      } else if (facing && offset === 0) {
        // L, das in den Ziel-Stub mündet: ein Knick statt zwei.
        points.push({ x: S2.x, y: T2.y });
      } else if (facing) {
        const midX = quantize((S2.x + T2.x) / 2 + offset);
        points.push({ x: midX, y: S2.y });
        points.push({ x: midX, y: T2.y });
      } else {
        // U-Loop (R-2-Fix, Regression: orthogonalRouting.invariants.test.ts
        // „U-Turn nur wenn geometrisch erzwungen“): Ziel liegt hinter der
        // Quelle. Die Rücklaufeinstrecke darf NICHT auf der Stub-Achse
        // liegen — früher fielen (loopX, S2.y) und (loopX, T2.y) auf
        // denselben Punkt zusammen und die Leitung lief nach dem Stub auf
        // derselben Linie durch den Handle zurück (Selbstüberlappung,
        // 0 Bends). Jetzt weicht die Rückstellstrecke um
        // U_TURN_LANE_SPREAD auf eine eigene Lane aus.
        const dir = ds.x > 0 ? 1 : -1;
        const loopX = quantize(
          (dir > 0 ? Math.max(S2.x, T2.x) : Math.min(S2.x, T2.x)) +
            dir * (ROUTE_MIN_STUB * 2 + Math.abs(offset))
        );
        const laneSign = offset !== 0 ? Math.sign(offset) : 1;
        const returnY = quantize(S2.y + laneSign * U_TURN_LANE_SPREAD);
        points.push({ x: loopX, y: S2.y });
        points.push({ x: loopX, y: returnY });
        points.push({ x: T2.x, y: returnY });
      }
    }
  } else if (!horizS && !horizT) {
    if (ds.y === dt.y) {
      const midY = quantize((S2.y + T2.y) / 2 + offset);
      points.push({ x: S2.x, y: midY });
      points.push({ x: T2.x, y: midY });
    } else {
      const sameCol = Math.abs(S2.x - T2.x) <= EPS;
      const facing = (ds.y > 0 && T2.y >= S2.y - EPS) || (ds.y < 0 && T2.y <= S2.y + EPS);
      if (sameCol && facing && offset === 0) {
        // gerade
      } else if (facing && offset === 0) {
        points.push({ x: T2.x, y: S2.y });
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
        // R-2-Fix: Rücklauf auf eigener Lane statt auf der Stub-Achse
        // (siehe horizontalen U-Loop oben).
        const laneSign = offset !== 0 ? Math.sign(offset) : 1;
        const returnX = quantize(S2.x + laneSign * U_TURN_LANE_SPREAD);
        points.push({ x: S2.x, y: loopY });
        points.push({ x: returnX, y: loopY });
        points.push({ x: returnX, y: T2.y });
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

const withElbow = (S: Point, S2: Point, elbow: Point, T2: Point, T: Point): Point[] =>
  simplifyWaypoints([S, S2, elbow, T2, T]);

/**
 * Alle billigen, port-treuen Katalogpfade. A* läuft nur, wenn keiner frei ist.
 * Beide L-Varianten sind manhattan-optimal; Z nur, wenn ein Lane-Offset nötig ist.
 */
export function catalogCandidates(input: {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  offset?: number;
}): Point[][] {
  const primary = catalogWaypoints(input);
  const ds = sourceExitVector(input.sourcePosition);
  const dt = targetEntryVector(input.targetPosition);
  const offset = input.offset ?? 0;
  const stub = ROUTE_MIN_STUB + Math.abs(offset) * 0.15;
  const S: Point = { x: input.sourceX, y: input.sourceY };
  const T: Point = { x: input.targetX, y: input.targetY };
  const S2 = stubPoint(S, ds, stub);
  const T2 = stubPoint(T, { x: -dt.x, y: -dt.y }, stub);

  const out: Point[][] = [primary];
  // R-2-Fix: Liegt das Ziel HINTER der Quelle (nicht „facing“), läuft der
  // X-Elbow nach dem Stub auf derselben Achse zurück — Selbstüberlappung
  // („Kabel durch den Handle“). Solche Kandidaten erst gar nicht erzeugen;
  // der Y-Elbow ist genau dann degeneriert, wenn sein Knick auf der
  // Stub-Achse liegt (T2.y == S2.y).
  const facingX = ds.x > 0 ? T2.x >= S2.x - EPS : T2.x <= S2.x + EPS;
  if (facingX) {
    out.push(withElbow(S, S2, { x: T2.x, y: S2.y }, T2, T));
  }
  if (Math.abs(T2.y - S2.y) > EPS) {
    out.push(withElbow(S, S2, { x: S2.x, y: T2.y }, T2, T));
  }

  if (offset !== 0) {
    out.push(
      simplifyWaypoints([
        S,
        S2,
        { x: quantize((S2.x + T2.x) / 2 + offset), y: S2.y },
        { x: quantize((S2.x + T2.x) / 2 + offset), y: T2.y },
        T2,
        T,
      ])
    );
    out.push(
      simplifyWaypoints([
        S,
        S2,
        { x: S2.x, y: quantize((S2.y + T2.y) / 2 + offset) },
        { x: T2.x, y: quantize((S2.y + T2.y) / 2 + offset) },
        T2,
        T,
      ])
    );
  }

  const seen = new Set<string>();
  const unique: Point[][] = [];
  for (let i = 0; i < out.length; i++) {
    const key = at(out, i)
      .map((p) => `${p.x},${p.y}`)
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(at(out, i));
  }
  return unique;
}

const scoreCatalog = (points: Point[]): number => pathLength(points) + BEND_COST * countBends(points);

export function bestFreeCatalog(
  input: {
    sourceX: number;
    sourceY: number;
    sourcePosition?: Position;
    targetX: number;
    targetY: number;
    targetPosition?: Position;
    offset?: number;
  },
  obstacles: Rect[]
): Point[] | null {
  const candidates = catalogCandidates(input);
  let best: Point[] | null = null;
  let bestScore = Infinity;
  let bestOverlaps = false;
  for (let i = 0; i < candidates.length; i++) {
    const pts = at(candidates, i);
    if (!isOrthogonalPath(pts) || pathHitsObstacles(pts, obstacles)) continue;
    // R-2: selbstüberlappende Kandidaten verlieren grundsätzlich gegen
    // überlappungsfreie — egal wie kurz sie sind.
    const overlaps = hasSelfOverlap(pts);
    if (best !== null && overlaps && !bestOverlaps) continue;
    const score = scoreCatalog(pts) + (overlaps ? U_TURN_COST : 0);
    if (best === null || score < bestScore - EPS) {
      best = pts;
      bestScore = score;
      bestOverlaps = overlaps;
    }
  }
  return best;
}

/**
 * Selbstüberlappung (R-2): zwei achsenparallele Segmente desselben Pfads
 * liegen auf derselben Linie und überlappen auf einer Strecke > EPS — die
 * Leitung läuft optisch in sich zurück („doppelte Belegung“ einer Lane).
 * Solche Pfade sind immer ein Routing-Fehler und werden bevorzugt vermieden.
 */
export function hasSelfOverlap(points: Point[]): boolean {
  const segments = waypointsToSegments(points);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 2; j < segments.length; j++) {
      const [a1, a2] = at(segments, i);
      const [b1, b2] = at(segments, j);
      const aHorizontal = Math.abs(a1.y - a2.y) <= EPS;
      const bHorizontal = Math.abs(b1.y - b2.y) <= EPS;
      if (aHorizontal !== bHorizontal) continue;
      if (aHorizontal) {
        if (Math.abs(a1.y - b1.y) > EPS) continue;
        const overlap =
          Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
          Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x));
        if (overlap > EPS) return true;
      } else {
        if (Math.abs(a1.x - b1.x) > EPS) continue;
        const overlap =
          Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
          Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y));
        if (overlap > EPS) return true;
      }
    }
  }
  return false;
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
    if (at(points, i).x !== at(points, i + 1).x || at(points, i).y !== at(points, i + 1).y) {
      segments.push([at(points, i), at(points, i + 1)]);
    }
  }
  return segments;
}

export function countCrossings(waypoints: Point[], others: Segment[]): number {
  if (others.length === 0 || waypoints.length < 2) return 0;
  const own = waypointsToSegments(waypoints);
  let count = 0;
  for (let i = 0; i < others.length; i++) {
    const other = at(others, i);
    for (let j = 0; j < own.length; j++) {
      if (segmentsIntersect(at(own, j), other)) {
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
  let xs = uniqueSorted([start.x, goal.x, ...extraXs, ...obstacles.flatMap((r) => [r.x, r.x + r.width])]);
  let ys = uniqueSorted([start.y, goal.y, ...extraYs, ...obstacles.flatMap((r) => [r.y, r.y + r.height])]);

  if (clip) {
    const keepX = (x: number) => x >= clip.minX && x <= clip.maxX;
    const keepY = (y: number) => y >= clip.minY && y <= clip.maxY;
    xs = uniqueSorted([start.x, goal.x, ...xs.filter(keepX)]);
    ys = uniqueSorted([start.y, goal.y, ...ys.filter(keepY)]);
  } else if (xs.length * ys.length > 20_000) {
    // Envelope aller Hindernisse, nicht nur Start–Ziel ±120 px:
    // sonst kann der Umweg um ein großes Bauteil aus dem Fenster fallen.
    let minX = Math.min(start.x, goal.x);
    let maxX = Math.max(start.x, goal.x);
    let minY = Math.min(start.y, goal.y);
    let maxY = Math.max(start.y, goal.y);
    for (let i = 0; i < obstacles.length; i++) {
      const r = at(obstacles, i);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    const pad = 32;
    return hananAStar(start, goal, startHeading, goalHeading, obstacles, extraXs, extraYs, {
      minX: minX - pad,
      maxX: maxX + pad,
      minY: minY - pad,
      maxY: maxY + pad,
    });
  }

  const nx = xs.length;
  const ny = ys.length;
  const six = snapIndex(xs, start.x);
  const siy = snapIndex(ys, start.y);
  const gix = snapIndex(xs, goal.x);
  const giy = snapIndex(ys, goal.y);

  const solids: Rect[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const r = at(obstacles, i);
    if (containsPoint(r, start) || containsPoint(r, goal)) continue;
    solids.push(r);
  }

  const blocked = new Uint8Array(nx * ny);
  for (let o = 0; o < solids.length; o++) {
    const r = at(solids, o);
    for (let iy = 0; iy < ny; iy++) {
      const y = at(ys, iy);
      if (y <= r.y + EPS || y >= r.y + r.height - EPS) continue;
      const row = iy * nx;
      for (let ix = 0; ix < nx; ix++) {
        const x = at(xs, ix);
        if (x > r.x + EPS && x < r.x + r.width - EPS) blocked[row + ix] = 1;
      }
    }
  }
  blocked[siy * nx + six] = 0;
  blocked[giy * nx + gix] = 0;

  const hOpen = new Uint8Array(ny * Math.max(0, nx - 1));
  const vOpen = new Uint8Array(nx * Math.max(0, ny - 1));
  if (nx > 1) {
    for (let iy = 0; iy < ny; iy++) {
      const y = at(ys, iy);
      const row = iy * (nx - 1);
      for (let ix = 0; ix < nx - 1; ix++) {
        if (blocked[iy * nx + ix] || blocked[iy * nx + ix + 1]) continue;
        if (!segmentHitsAny({ x: at(xs, ix), y }, { x: at(xs, ix + 1), y }, solids)) hOpen[row + ix] = 1;
      }
    }
  }
  if (ny > 1) {
    for (let ix = 0; ix < nx; ix++) {
      const x = at(xs, ix);
      const col = ix * (ny - 1);
      for (let iy = 0; iy < ny - 1; iy++) {
        if (blocked[iy * nx + ix] || blocked[(iy + 1) * nx + ix]) continue;
        if (!segmentHitsAny({ x, y: at(ys, iy) }, { x, y: at(ys, iy + 1) }, solids)) vOpen[col + iy] = 1;
      }
    }
  }

  const pack = (ix: number, iy: number, hd: number): number => (iy * nx + ix) * 4 + hd;
  const gScore = new Map<number, number>();
  const parent = new Map<number, number>();

  const startKey = pack(six, siy, startHeading);
  gScore.set(startKey, 0);
  const heap = new MinHeap();
  const h0 = remainingCostLowerBound(
    at(xs, six),
    at(ys, siy),
    startHeading,
    at(xs, gix),
    at(ys, giy),
    goalHeading
  );
  heap.push({ f: h0, g: 0, h: h0, ix: six, iy: siy, hd: startHeading });

  let expansions = 0;
  let bestGoalKey = -1;
  let bestGoalG = Infinity;

  const canStep = (ix: number, iy: number, nd: number): boolean => {
    if (nd === 0) return ix + 1 < nx && hOpen[iy * (nx - 1) + ix] === 1;
    if (nd === 2) return ix - 1 >= 0 && hOpen[iy * (nx - 1) + (ix - 1)] === 1;
    if (nd === 3) return iy + 1 < ny && vOpen[ix * (ny - 1) + iy] === 1;
    return iy - 1 >= 0 && vOpen[ix * (ny - 1) + (iy - 1)] === 1;
  };

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
      if (!canStep(cur.ix, cur.iy, nd)) continue;
      const dir = at(DIR, nd);
      const nix = cur.ix + dir.x;
      const niy = cur.iy + dir.y;
      const step = Math.abs(at(xs, nix) - at(xs, cur.ix)) + Math.abs(at(ys, niy) - at(ys, cur.iy));
      if (step <= EPS) continue;
      const g = cur.g + step + turnCost(cur.hd, nd);
      const nkey = pack(nix, niy, nd);
      const prev = gScore.get(nkey);
      if (prev !== undefined && g >= prev - EPS) continue;
      gScore.set(nkey, g);
      parent.set(nkey, key);
      const h = remainingCostLowerBound(at(xs, nix), at(ys, niy), nd, at(xs, gix), at(ys, giy), goalHeading);
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
    const cell = (k / 4) | 0;
    const ix = cell % nx;
    const iy = (cell / nx) | 0;
    pts.push({ x: at(xs, ix), y: at(ys, iy) });
    const p = parent.get(k);
    if (p === undefined) break;
    k = p;
  }
  pts.reverse();

  if (pts.length === 0) return null;
  if (Math.abs(at(pts, 0).x - start.x) > EPS || Math.abs(at(pts, 0).y - start.y) > EPS) {
    pts.unshift({ x: start.x, y: start.y });
  }
  const last = at(pts, pts.length - 1);
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

/**
 * R-3 (Routing-Fallback): Telemetrie. `fallbackCount` zählt, wie oft der
 * Notfallpfad (roher Katalog ohne Freigabeprüfung) das Endergebnis war —
 * Ziel im Referenzplan: Quote 0. Ein Anstieg bedeutet, dass Hindernisfeld
 * oder Budget (MAX_EXPANSIONS) die ordentliche Suche überfordern.
 */
let fallbackCount = 0;

export const pathfindingFallbackCount = (): number => fallbackCount;

export const resetPathfindingTelemetry = (): void => {
  fallbackCount = 0;
};

export const clearPathfindingCache = (): void => {
  cache.clear();
};

const obstacleKey = (obstacles: Rect[]): string => {
  if (obstacles.length === 0) return '';
  let s = `${obstacles.length}:`;
  for (let i = 0; i < obstacles.length; i++) {
    const r = at(obstacles, i);
    s += `${quantize(r.x)},${quantize(r.y)},${quantize(r.width)},${quantize(r.height)};`;
  }
  return s;
};

const segmentsKey = (segments: Segment[] | undefined): string => {
  if (!segments || segments.length === 0) return '0';
  let h = segments.length | 0;
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = at(segments, i);
    h = (Math.imul(h, 31) + (quantize(a.x) * 2 + quantize(a.y) + quantize(b.x) + quantize(b.y))) | 0;
  }
  return `${segments.length}:${h}`;
};

const requestKey = (input: PathRequest, obstacles: Rect[]): string =>
  `${quantize(input.sourceX)},${quantize(input.sourceY)},${input.sourcePosition ?? ''},` +
  `${quantize(input.targetX)},${quantize(input.targetY)},${input.targetPosition ?? ''},` +
  `${input.offset ?? 0},${input.borderRadius ?? ROUTE_BORDER_RADIUS},` +
  `${obstacleKey(obstacles)},${segmentsKey(input.crossingSegments)}`;

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
    const r = at(obstacles, i);
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
  offset: number,
  /** Wie weit sind `obstacles` gegenüber den Rohboxen aufgebläht? */
  marginUsed: number = OBSTACLE_MARGIN
): { waypoints: Point[]; usedSearch: PathResult['usedSearch'] } {
  const freeCatalog = bestFreeCatalog({ ...input, offset }, obstacles);
  if (freeCatalog) {
    return { waypoints: freeCatalog, usedSearch: 'catalog' };
  }

  const catalog = catalogWaypoints({ ...input, offset });
  const ds = sourceExitVector(input.sourcePosition);
  const dt = targetEntryVector(input.targetPosition);
  const S: Point = { x: input.sourceX, y: input.sourceY };
  const T: Point = { x: input.targetX, y: input.targetY };

  // R-7: Der Stub bleibt IMMER ≥ ROUTE_MIN_STUB (24 px). Früher wurde er
  // bei Hinderniskontakt halbiert (bis 4 px) — das erzeugte Winzstummel
  // direkt am Handle und Richtungswechsel im Stub-Bereich.
  const pickStub = (from: Point, dir: Point): Point => {
    const stub = ROUTE_MIN_STUB + Math.abs(offset) * 0.15;
    return stubPoint(from, dir, stub);
  };

  const S2 = pickStub(S, ds);
  const T2 = pickStub(T, { x: -dt.x, y: -dt.y });

  // R-7/R-10: Sitzt ein (aufgeblähtes) Hindernis so nah am Handle, dass es
  // den vollen Stub überdeckt, wird NUR dieses Hindernis für die Suche auf
  // das 12-px-Clearance-Ziel zurückgesetzt (Rohbox + 12) — der Stub kürzt
  // nicht, die A*-Suche startet nicht in einem blockierten Punkt, und JEDER
  // im entzerrten Raum akzeptierte Pfad hält trotzdem mindestens 12 px
  // Abstand zum echten Node (inkl. Labelfläche, die in der Box liegt).
  // Früher stand hier eine 2-px-Restfreigabe — Routen durften bis auf
  // 10 px an einen Node heranrücken (R-10-Verstoß). Der Inset wird aus der
  // TATSÄCHLICH verwendeten Inflation abgeleitet (der Notfall-Retry läuft
  // mit 7 px — dort wäre ein fester 14er-Abzug die Box gewachsen).
  const CLEARANCE_GOAL = 12;
  const inset = Math.max(0, marginUsed - CLEARANCE_GOAL);
  const shrink = (r: Rect, by: number): Rect => ({
    x: r.x + by,
    y: r.y + by,
    width: Math.max(2 * CLEARANCE_GOAL, r.width - 2 * by),
    height: Math.max(2 * CLEARANCE_GOAL, r.height - 2 * by),
  });
  // Stufe 1: Rohbox + 12 px (R-10-Ziel). Stufe 2: Liegt der Stub-Punkt
  // AUCH dort noch im Block, klebt das Bauteil näher am Handle als die
  // Stub-Länge plus Ziel-Freigabe — beides (≥ 12 px UND voller Stub) ist
  // geometrisch unmöglich. Dann weicht die Box auf Rohbox + 2 px aus
  // („Stub-Recht"), damit A* überhaupt starten kann; die Freigabe gilt im
  // Umgang mit an Handle geklebten Bauteilen als begründete Ausnahme.
  const searchObstacles = obstacles.map((r) => {
    if (!containsPoint(r, S2) && !containsPoint(r, T2)) return r;
    const floored = shrink(r, inset);
    if (!containsPoint(floored, S2) && !containsPoint(floored, T2)) return floored;
    return shrink(r, marginUsed - 2);
  });

  const extraXs = [S2.x, T2.x, (S2.x + T2.x) / 2 + offset, S.x, T.x];
  const extraYs = [S2.y, T2.y, (S2.y + T2.y) / 2 + offset, S.y, T.y];
  if (obstacles.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < obstacles.length; i++) {
      const r = at(obstacles, i);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    extraXs.push(minX - 16, maxX + 16);
    extraYs.push(minY - 16, maxY + 16);
  }

  const inner = hananAStar(S2, T2, headingFromDir(ds), headingFromDir(dt), searchObstacles, extraXs, extraYs);

  if (inner && inner.length >= 1) {
    const full = stitchOrthogonal([S, ...inner, T]);
    if (!pathHitsObstacles(full, searchObstacles)) {
      return { waypoints: full, usedSearch: 'astar' };
    }
    // Stub-Toleranz (R-7): Bleiben Verletzungen, die NUR die Stub-Segmente
    // (S→S2 bzw. T2→T) gegen eine entzerrte Box betreffen, wird der Pfad
    // akzeptiert — der 24-px-Stub wiegt schwerer als die letzten 12 px
    // Inflate-Margin an einem direkt anliegenden Bauteil.
    const sameSegment = (a: Point, b: Point, c: Point, d: Point): boolean =>
      Math.abs(a.x - c.x) <= EPS &&
      Math.abs(a.y - c.y) <= EPS &&
      Math.abs(b.x - d.x) <= EPS &&
      Math.abs(b.y - d.y) <= EPS;
    let tolerated = true;
    for (let i = 0; i + 1 < full.length && tolerated; i++) {
      const a = at(full, i);
      const b = at(full, i + 1);
      const isStub = sameSegment(a, b, S, S2) || sameSegment(a, b, T2, T);
      for (let k = 0; k < obstacles.length && tolerated; k++) {
        const rFull = at(obstacles, k);
        if (!segmentHitsAny(a, b, [rFull])) continue;
        const rSearch = at(searchObstacles, k);
        if (segmentHitsAny(a, b, [rSearch])) {
          tolerated = false;
        } else if (!isStub) {
          tolerated = false;
        }
      }
    }
    if (tolerated) {
      return { waypoints: full, usedSearch: 'astar' };
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
  const obstacles = relevantObstacles(allObstacles, start, end).map((r) => inflateRect(r, OBSTACLE_MARGIN));
  const crossingSegments = input.crossingSegments ?? [];
  const key = requestKey(input, obstacles);

  if (!input.skipCache) {
    const hit = cacheGet(key);
    if (hit) return hit;
  }

  const baseOffset = input.offset ?? 0;
  let best = searchOnce(input, obstacles, baseOffset);
  if (best.usedSearch === 'fallback' && pathHitsObstacles(best.waypoints, obstacles)) {
    const tight = relevantObstacles(allObstacles, start, end).map((r) =>
      inflateRect(r, Math.max(2, OBSTACLE_MARGIN / 2))
    );
    const retry = searchOnce(input, tight, baseOffset, Math.max(2, OBSTACLE_MARGIN / 2));
    if (!pathHitsObstacles(retry.waypoints, tight)) {
      best = retry;
    }
  }
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
      const cand = searchOnce(input, obstacles, at(candidates, i));
      // R-3/R-7: Ein Fallback-Kandidat (keine Freigabe-Garantie) gewinnt
      // nie gegen Katalog oder A* — auch nicht über weniger Kreuzungen.
      if (cand.usedSearch === 'fallback' && best.usedSearch !== 'fallback') continue;
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
  if (result.usedSearch === 'fallback') {
    // R-3: Der Notfallpfad ist orthogonal, hat aber keine Freigabe-Garantie
    // (der Wiederholungslauf mit halbiertem Margin ist oben gelaufen).
    // Sichtbar machen statt still leiden:
    fallbackCount += 1;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[pathfinding] Fallback ohne Hindernisfreigabe: ` +
          `(${input.sourceX},${input.sourceY}) → (${input.targetX},${input.targetY}), ` +
          `${allObstacles.length} Hindernisse, ${crossingSegments.length} Fremdsegmente`
      );
    }
  }
  if (!input.skipCache) cacheSet(key, result);
  return result;
}

export function nodesToObstacles(nodes: Node[], excludeIds: Set<string>): Rect[] {
  const rects: Rect[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || excludeIds.has(node.id)) continue;
    // R-10: Gemessene Bounds sind die Pflichtquelle (React Flow misst
    // width/height nach dem Mount); der Fallback bleibt nur für
    // ungemessene Knoten (Tests, erster Frame) und ist dokumentiert.
    let x = node.positionAbsolute?.x ?? node.position.x;
    let y = node.positionAbsolute?.y ?? node.position.y;
    let width = node.width || NODE_FALLBACK_WIDTH;
    let height = node.height || NODE_FALLBACK_HEIGHT;
    // R-10: Handles (inkl. überstehender Anschlusspunkte) gehören zur
    // belegten Fläche — die Box wächst auf die Handle-Ausdehnung.
    const bounds = readHandleBounds(node);
    const groups = bounds ? [...(bounds.source ?? []), ...(bounds.target ?? [])] : [];
    for (const hb of groups) {
      const hx = x + hb.x;
      const hy = y + hb.y;
      const x2 = Math.max(x + width, hx + hb.width);
      const y2 = Math.max(y + height, hy + hb.height);
      x = Math.min(x, hx);
      y = Math.min(y, hy);
      width = x2 - x;
      height = y2 - y;
    }
    rects.push({ x, y, width, height });
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
    const edge = at(edges, i);
    if (skip(edge)) continue;
    const a = centers.get(edge.source);
    const b = centers.get(edge.target);
    if (!a || !b) continue;
    segments.push([a, b]);
  }
  return segments;
}
