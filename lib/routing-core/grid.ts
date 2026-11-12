/**
 * Hanan-Gitter, Hindernis-Index und Belegungszähler des Routing-Kerns.
 *
 * Das Gitter (§5.1 der Spezifikation) besteht aus den aufgeblähten
 * Bauteilrändern, den Ports und den Stub-Enden. Schritte sind ausschließlich
 * zwischen **benachbarten** Koordinaten erlaubt; damit ist jeder Pfad
 * orthogonal, kann kein Hindernis überspringen und hat Knicke nur auf
 * Gitterlinien.
 *
 * Der Belegungszähler trennt zwei Dinge, die im Bestandsrouter vermischt sind:
 *
 * * **Kantenbelegung** `usage` — kollineare Nutzung einer Gitterkante. Sie darf
 *   höchstens 1 sein (Regel L: Überdeckung verboten); genau das erzwingt das
 *   Verhandlungsverfahren über Preise statt über Sperrflächen.
 * * **Durchquerungszähler** `vThrough`/`hThrough` — wie viele fremde Routen
 *   einen Gitterknoten *durchfahren*. Nur ein Durchfahren ist eine Kreuzung;
 *   ein Enden am Knoten (T-Stoß) ist keine.
 */

import type { Point, Rect, Segment } from '../routing/geometry';
import type { CoreHandle, CoreNode } from './model';
import { CORE_TOKENS } from './tokens';

const EPS = 1e-6;

const QUANT = 1000;
/** Kanonischer Schlüssel einer Koordinate (1/1000 px) — deterministische Gleichheit. */
export const q = (value: number): number => Math.round(value * QUANT);

/** Kanonischer Schlüssel einer ungerichteten Gitterkante. */
export const edgeKey = (ax: number, ay: number, bx: number, by: number): string => {
  const ka = `${q(ax)}|${q(ay)}`;
  const kb = `${q(bx)}|${q(by)}`;
  return ka < kb ? `${ka}>${kb}` : `${kb}>${ka}`;
};

export const vertexKey = (x: number, y: number): string => `${q(x)}|${q(y)}`;

export type Grid = {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly xIndex: ReadonlyMap<number, number>;
  readonly yIndex: ReadonlyMap<number, number>;
};

const uniqueSorted = (values: readonly number[]): number[] => {
  const seen = new Map<number, number>();
  for (const value of values) {
    const key = q(value);
    if (!seen.has(key)) seen.set(key, Math.round(value * QUANT) / QUANT);
  }
  return [...seen.values()].sort((a, b) => a - b);
};

const sidesOf = (rect: Rect): { x0: number; x1: number; y0: number; y1: number } => ({
  x0: rect.x,
  x1: rect.x + rect.width,
  y0: rect.y,
  y1: rect.y + rect.height,
});

/**
 * Gitterkoordinaten aus Bauteilen, Ports und Stub-Enden.
 *
 * Zusätzlich zu den Rändern werden die **aufgeblähten** Ränder aufgenommen
 * (`obstacleMargin`): das sind die Korridore, auf denen der A\* laufen darf,
 * ohne ein Bauteil zu berühren.
 */
export function buildGrid(
  nodes: readonly CoreNode[],
  stubPoints: readonly { source: { x: number; y: number }; target: { x: number; y: number } }[]
): Grid {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const node of nodes) {
    const { x0, x1, y0, y1 } = sidesOf(node.rect);
    // Drei Freigabe-Stufen als Korridorlinien: voller Rand, enger Rand, Rohbox+2.
    for (const level of CORE_TOKENS.marginLadder) {
      xs.push(x0 - level, x1 + level);
      ys.push(y0 - level, y1 + level);
    }
    xs.push(x0, x1, (x0 + x1) / 2);
    ys.push(y0, y1, (y0 + y1) / 2);
    for (const handle of node.handles) {
      xs.push(handle.x);
      ys.push(handle.y);
    }
  }
  for (const pair of stubPoints) {
    xs.push(pair.source.x, pair.target.x);
    ys.push(pair.source.y, pair.target.y);
  }
  // Außenraum: mindestens eine Gitterlinie jenseits aller Bauteile.
  if (xs.length > 0) {
    xs.push(Math.min(...xs) - CORE_TOKENS.laneGrid * 4, Math.max(...xs) + CORE_TOKENS.laneGrid * 4);
    ys.push(Math.min(...ys) - CORE_TOKENS.laneGrid * 4, Math.max(...ys) + CORE_TOKENS.laneGrid * 4);
  }
  const sortedXs = uniqueSorted(xs);
  const sortedYs = uniqueSorted(ys);
  return {
    xs: sortedXs,
    ys: sortedYs,
    xIndex: new Map(sortedXs.map((value, i) => [q(value), i])),
    yIndex: new Map(sortedYs.map((value, i) => [q(value), i])),
  };
}

/** Achsenparalleles Segment (nur horizontale/vertikale Stücke). */
export const isHorizontal = (segment: Segment): boolean => Math.abs(segment[0].y - segment[1].y) < EPS;
export const isVertical = (segment: Segment): boolean => Math.abs(segment[0].x - segment[1].x) < EPS;

const openOverlap = (a0: number, a1: number, b0: number, b1: number): boolean => {
  const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  return hi - lo > EPS;
};

const pointInsideOpen = (value: number, lo: number, hi: number, invert: boolean): boolean =>
  invert ? value > lo + EPS && value < hi - EPS : value > lo - EPS && value < hi + EPS;

/**
 * Hindernis-Index: je Bauteil das um `obstacleMargin` aufgeblähte Rechteck.
 *
 * `blocked(segment, ownNodeIds)` arbeitet in **offenen** Intervallen: eine
 * Gitterlinie exakt auf dem aufgeblähten Rand ist erlaubt (das ist der
 * Korridor), ein Eindringen in das Innere nicht.
 */
export class ObstacleIndex {
  private readonly entries: { id: string; x0: number; x1: number; y0: number; y1: number }[];

  constructor(nodes: readonly CoreNode[]) {
    const margin = CORE_TOKENS.obstacleMargin;
    this.entries = nodes.map((node) => {
      const { x0, x1, y0, y1 } = sidesOf(node.rect);
      return { id: node.id, x0: x0 - margin, x1: x1 + margin, y0: y0 - margin, y1: y1 + margin };
    });
  }

  /**
   * `relaxed = true` ist das **Stub-Recht** (R-7, ROUTING-CONTEXT §4.3,
   * Ausnahme 3): im engen Fenster um einen Anschluss gilt statt des
   * Hindernis-Margins (14 px) nur die Rohbox + 2 px. Ohne diese Ausnahme sind
   * Anschlüsse, die unmittelbar an einem fremden Bauteil liegen (im
   * Referenzplan `simple` z. B. zwei vertikal benachbarte Bauteile), mit
   * keinem Gitterpfad erreichbar — der Bestandsrouter löst genau diesen Fall
   * über `stubCap`/`tightMarginUsed`.
   */
  /** Erste blockierende Bauteil-ID (Diagnose/Tests) oder `null`. */
  blocker(
    segment: Segment,
    ownNodeIds: ReadonlySet<string>,
    margin = CORE_TOKENS.obstacleMargin
  ): string | null {
    const horizontal = isHorizontal(segment);
    const [a, b] = segment;
    const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const line = horizontal ? a.y : a.x;
    const inset = CORE_TOKENS.obstacleMargin - margin;
    for (const entry of this.entries) {
      if (ownNodeIds.has(entry.id)) continue;
      const x0 = entry.x0 + inset;
      const x1 = entry.x1 - inset;
      const y0 = entry.y0 + inset;
      const y1 = entry.y1 - inset;
      const lineOk = horizontal ? pointInsideOpen(line, y0, y1, true) : pointInsideOpen(line, x0, x1, true);
      if (!lineOk) continue;
      const spanOk = horizontal ? openOverlap(lo, hi, x0, x1) : openOverlap(lo, hi, y0, y1);
      if (spanOk) return entry.id;
    }
    return null;
  }

  blocked(segment: Segment, ownNodeIds: ReadonlySet<string>, margin = CORE_TOKENS.obstacleMargin): boolean {
    const horizontal = isHorizontal(segment);
    const [a, b] = segment;
    const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const line = horizontal ? a.y : a.x;
    const inset = CORE_TOKENS.obstacleMargin - margin;
    for (const entry of this.entries) {
      if (ownNodeIds.has(entry.id)) continue;
      const x0 = entry.x0 + inset;
      const x1 = entry.x1 - inset;
      const y0 = entry.y0 + inset;
      const y1 = entry.y1 - inset;
      const lineOk = horizontal ? pointInsideOpen(line, y0, y1, true) : pointInsideOpen(line, x0, x1, true);
      if (!lineOk) continue;
      const spanOk = horizontal ? openOverlap(lo, hi, x0, x1) : openOverlap(lo, hi, y0, y1);
      if (spanOk) return true;
    }
    return false;
  }
}

/**
 * Reservierte Stubs: jede Kante reserviert ihren Stub als Sperrfläche für
 * **fremde** Anschlüsse (eigene Anschlüsse dürfen ihn mitbenutzen — die
 * Port-Bündel-Ausnahme, §5.3).
 */
export type StubReservation = {
  readonly handleKey: string;
  readonly segment: Segment;
};

export const handleKey = (nodeId: string, handleId: string): string => `${nodeId}\u0000${handleId}`;

export function stubBlocker(
  segment: Segment,
  reservations: readonly StubReservation[],
  ownHandleKeys: ReadonlySet<string>
): string | null {
  for (const reservation of reservations) {
    if (ownHandleKeys.has(reservation.handleKey)) continue;
    if (segmentDistance(segment, reservation.segment) < CORE_TOKENS.stubReserveMargin - EPS) {
      return reservation.handleKey;
    }
  }
  return null;
}

export function stubBlocks(
  segment: Segment,
  reservations: readonly StubReservation[],
  ownHandleKeys: ReadonlySet<string>
): boolean {
  // Nur echte Berührung sperrt. Die 12-px-Clearance gilt für Bauteile; an
  // Anschlüssen ist sie in den Referenzplänen physikalisch unmöglich
  // (Busbar-Anschlüsse liegen 8 px auseinander). Ein Stub reserviert deshalb
  // nur seinen eigenen Querschnitt plus 2 px — der Rest ist Sache der
  // Prüfinstanz (I3), die solche Nähe ehrlich meldet.
  for (const reservation of reservations) {
    if (ownHandleKeys.has(reservation.handleKey)) continue;
    if (segmentDistance(segment, reservation.segment) < CORE_TOKENS.stubReserveMargin - EPS) return true;
  }
  return false;
}

/**
 * Abstand zweier achsenparalleler Segmente.
 *
 * Der Abstand zweier „Nullbreiten-Rechtecke" ist der Abstand ihrer
 * Bounding-Boxen: `hypot(Lücke in x, Lücke in y)`. Überlappen sich beide
 * Achsen, ist er 0 (Schnitt oder Berührung). Die frühere, achsenweise
 * Prüfung war zu grob: ein **senkrechter** Stub blockierte jedes waagerechte
 * Segment, das seinen x-Wert querte — unabhängig vom y-Abstand.
 */
export function segmentDistance(a: Segment, b: Segment): number {
  const ax0 = Math.min(a[0].x, a[1].x);
  const ax1 = Math.max(a[0].x, a[1].x);
  const ay0 = Math.min(a[0].y, a[1].y);
  const ay1 = Math.max(a[0].y, a[1].y);
  const bx0 = Math.min(b[0].x, b[1].x);
  const bx1 = Math.max(b[0].x, b[1].x);
  const by0 = Math.min(b[0].y, b[1].y);
  const by1 = Math.max(b[0].y, b[1].y);
  const gapX = Math.max(ax0 - bx1, bx0 - ax1, 0);
  const gapY = Math.max(ay0 - by1, by0 - ay1, 0);
  return Math.hypot(gapX, gapY);
}

/** Ein Gitterschritt in Richtung `dir`. */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly { dx: number; dy: number; dir: Dir }[] = [
  { dx: 1, dy: 0, dir: 0 },
  { dx: 0, dy: 1, dir: 1 },
  { dx: -1, dy: 0, dir: 2 },
  { dx: 0, dy: -1, dir: 3 },
];

/**
 * Belegungs- und Durchfahrtszähler.
 *
 * `history` wächst monoton (Verhandlungspreise), `usage` ist der Ist-Zustand
 * der aktuell verlegten Routen, `vThrough`/`hThrough` zählen Durchfahrten je
 * Gitterknoten (Kreuzungserkennung).
 */
export class Occupancy {
  private readonly usage = new Map<string, number>();
  private readonly history = new Map<string, number>();
  private readonly vThrough = new Map<string, number>();
  private readonly hThrough = new Map<string, number>();

  get(ax: number, ay: number, bx: number, by: number): number {
    return this.usage.get(edgeKey(ax, ay, bx, by)) ?? 0;
  }

  add(ax: number, ay: number, bx: number, by: number, delta: number): void {
    const key = edgeKey(ax, ay, bx, by);
    const next = (this.usage.get(key) ?? 0) + delta;
    if (next <= 0) this.usage.delete(key);
    else this.usage.set(key, next);
  }

  historyOf(ax: number, ay: number, bx: number, by: number): number {
    return this.history.get(edgeKey(ax, ay, bx, by)) ?? 0;
  }

  raiseHistory(ax: number, ay: number, bx: number, by: number, amount: number): void {
    const key = edgeKey(ax, ay, bx, by);
    this.history.set(key, (this.history.get(key) ?? 0) + amount);
  }

  totalHistory(): number {
    let sum = 0;
    for (const value of this.history.values()) sum += value;
    return sum;
  }

  throughVertical(x: number, y: number): number {
    return this.vThrough.get(vertexKey(x, y)) ?? 0;
  }

  throughHorizontal(x: number, y: number): number {
    return this.hThrough.get(vertexKey(x, y)) ?? 0;
  }

  addThrough(x: number, y: number, vertical: boolean, delta: number): void {
    const map = vertical ? this.vThrough : this.hThrough;
    const key = vertexKey(x, y);
    const next = (map.get(key) ?? 0) + delta;
    if (next <= 0) map.delete(key);
    else map.set(key, next);
  }

  /** Alle überbelegten Gitterkanten (für die History-Aktualisierung). */
  overloaded(): { a: { x: number; y: number }; b: { x: number; y: number }; count: number }[] {
    const out: { a: { x: number; y: number }; b: { x: number; y: number }; count: number }[] = [];
    const keys = [...this.usage.keys()].sort();
    for (const key of keys) {
      const count = this.usage.get(key) ?? 0;
      if (count <= 1) continue;
      const [left, right] = key.split('>') as [string, string];
      const [xa, ya] = left.split('|').map(Number) as [number, number];
      const [xb, yb] = right.split('|').map(Number) as [number, number];
      out.push({
        a: { x: xa / QUANT, y: ya / QUANT },
        b: { x: xb / QUANT, y: yb / QUANT },
        count,
      });
    }
    return out;
  }

  maxUsage(): number {
    let max = 0;
    for (const value of this.usage.values()) max = Math.max(max, value);
    return max;
  }

  clear(): void {
    this.usage.clear();
  }
}

/**
 * Trägt eine fertige Route in die Zähler ein oder aus.
 * `delta = +1` beim Verlegen, `−1` beim Rip-up.
 *
 * Die Durchfahrtszähler werden für **alle** Gitterknoten im Inneren eines
 * Segments gesetzt (nicht nur für die Knicke): nur so ist eine Kreuzung
 * erkennbar, die mitten auf einem langen Segment liegt.
 */
export function applyRoute(
  occupancy: Occupancy,
  grid: Grid,
  waypoints: readonly { x: number; y: number }[],
  delta: 1 | -1
): void {
  const interiorIndices = (
    values: readonly number[],
    index: ReadonlyMap<number, number>,
    from: number,
    to: number
  ) => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const out: [number, number][] = [];
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i] as number;
      if (value > lo + EPS && value < hi - EPS) out.push([value, i]);
    }
    void index;
    return out;
  };

  for (let i = 0; i + 1 < waypoints.length; i += 1) {
    const a = waypoints[i] as Point;
    const b = waypoints[i + 1] as Point;
    const vertical = Math.abs(a.x - b.x) < EPS;
    occupancy.add(a.x, a.y, b.x, b.y, delta);
    if (vertical) {
      for (const [y] of interiorIndices(grid.ys, grid.yIndex, a.y, b.y)) {
        occupancy.addThrough(a.x, y, true, delta);
      }
    } else {
      for (const [x] of interiorIndices(grid.xs, grid.xIndex, a.x, b.x)) {
        occupancy.addThrough(x, a.y, false, delta);
      }
    }
  }
}

/** Stub-Punkt eines Anschlusses: Port + Normale × (stubMin + Lane-Versatz). */
export function stubPoint(handle: CoreHandle, laneOffset: number): { x: number; y: number } {
  const length = CORE_TOKENS.stubMin + Math.abs(laneOffset);
  switch (handle.side) {
    case 'right':
      return { x: handle.x + length, y: handle.y + laneOffset };
    case 'left':
      return { x: handle.x - length, y: handle.y + laneOffset };
    case 'top':
      return { x: handle.x + laneOffset, y: handle.y - length };
    case 'bottom':
    default:
      return { x: handle.x + laneOffset, y: handle.y + length };
  }
}

/** Austrittsrichtung (als `Dir`) einer Portseite. */
export function sideDir(side: CoreHandle['side']): Dir {
  switch (side) {
    case 'right':
      return 0;
    case 'bottom':
      return 1;
    case 'left':
      return 2;
    case 'top':
    default:
      return 3;
  }
}
