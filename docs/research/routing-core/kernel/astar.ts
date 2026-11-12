/**
 * Richtungsbewusster A* auf dem Hanan-Gitter (§5.1/§5.2).
 *
 * Der Zustand ist `(x, y, Richtung)` — ohne die Richtung wäre ein Knickpreis
 * nicht darstellbar. Die Suche ist exakt deterministisch:
 *
 * * Nachfolgerreihenfolge fest (`DIRS`),
 * * Priorität `(f, h, x, y, Richtung)` als vollständige Ordnung,
 * * kein Zufall, keine Zeit.
 *
 * Kosten je Schritt: Länge (px) + Knickpreis + Überlastpreis (Ist + History)
 * + Kreuzungspreis, wenn der Zug einen Gitterknoten gerade durchfährt, an dem
 * eine fremde Route senkrecht durchfährt. Kreuzungen werden **nicht** verboten
 * (Regel L), sondern bepreist — sie sind damit ein Optimierungsziel des
 * Gesamtlaufs, keine lokale Heuristik.
 *
 * Implementierungshinweis: „lazy deletion" (kein `closed`-Array). Der
 * Manhattan-Heuristikwert ist konsistent, deshalb ist die erste Popung eines
 * Zustands optimal; veraltete Einträge werden über `bestG` verworfen. Das ist
 * kürzer und nachweisbar richtig — die frühere Fassung mit getrennten
 * `closed`/`best`-Arrays hatte einen Zustandsfehler, der Pfade in Sackgassen
 * enden ließ.
 */

import type { Point } from '../../../../lib/routing/geometry';
import type { Dir, Grid } from './grid';
import type { ObstacleIndex, Occupancy, StubReservation } from './grid';
import { DIRS, stubBlocks } from './grid';
import { CORE_TOKENS } from './tokens';

export type AStarRequest = {
  readonly grid: Grid;
  readonly obstacles: ObstacleIndex;
  readonly occupancy: Occupancy;
  readonly reservations: readonly StubReservation[];
  /** Stub-Enden (Start/Ziel der Gittersuche). */
  readonly start: Point;
  readonly goal: Point;
  /** Richtung, in der die Route den Startpunkt verlässt. */
  readonly startDir: Dir;
  /** Richtung, mit der sie am Ziel ankommt. */
  readonly goalDir: Dir;
  readonly ownNodeIds: ReadonlySet<string>;
  readonly ownHandleKeys: ReadonlySet<string>;
  /** Freigabe-Stufe dieses Versuchs (px Rand um fremde Bauteile). */
  readonly margin: number;
};

export type AStarResult = {
  readonly waypoints: Point[];
  readonly expansions: number;
};

type Item = {
  readonly key: number;
  readonly xIndex: number;
  readonly yIndex: number;
  readonly dir: Dir;
  readonly g: number;
  readonly f: number;
  readonly h: number;
};

/** Binärer Min-Heap mit vollständiger Ordnung (deterministischer Tie-Break). */
class Heap {
  private readonly items: Item[] = [];

  get size(): number {
    return this.items.length;
  }

  private less(a: Item, b: Item): boolean {
    if (a.f !== b.f) return a.f < b.f;
    if (a.h !== b.h) return a.h < b.h;
    if (a.xIndex !== b.xIndex) return a.xIndex < b.xIndex;
    if (a.yIndex !== b.yIndex) return a.yIndex < b.yIndex;
    return a.dir < b.dir;
  }

  push(item: Item): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const current = this.items[i] as Item;
      const parentItem = this.items[parent] as Item;
      if (!this.less(current, parentItem)) break;
      this.items[i] = parentItem;
      this.items[parent] = current;
      i = parent;
    }
  }

  pop(): Item | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop() as Item;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.less(this.items[left] as Item, this.items[smallest] as Item)) {
          smallest = left;
        }
        if (right < this.items.length && this.less(this.items[right] as Item, this.items[smallest] as Item)) {
          smallest = right;
        }
        if (smallest === i) break;
        const current = this.items[i] as Item;
        this.items[i] = this.items[smallest] as Item;
        this.items[smallest] = current;
        i = smallest;
      }
    }
    return top;
  }
}

const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Abstand eines achsenparallelen Segments zu einem Punkt. */
const distanceToSegment = (segment: readonly [Point, Point], point: Point): number => {
  const [a, b] = segment;
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const dx = Math.max(x0 - point.x, 0, point.x - x1);
  const dy = Math.max(y0 - point.y, 0, point.y - y1);
  return Math.hypot(dx, dy);
};

/**
 * Stub-Recht als Suchregel: liegt ein Schritt im Fenster um einen der beiden
 * Anschlüsse, gilt die gelockerte Freigabe (Rohbox + 2 px statt 14 px Rand).
 */
const nearPort = (segment: readonly [Point, Point], start: Point, goal: Point): boolean => {
  const radius = CORE_TOKENS.stubMin + CORE_TOKENS.laneGrid;
  return distanceToSegment(segment, start) <= radius || distanceToSegment(segment, goal) <= radius;
};

export function gridAStar(request: AStarRequest): AStarResult | null {
  const { grid, obstacles, occupancy, reservations, start, goal, ownNodeIds, ownHandleKeys } = request;
  const xs = grid.xs;
  const ys = grid.ys;
  const coordX = (index: number): number => xs[index] as number;
  const coordY = (index: number): number => ys[index] as number;
  const nx = xs.length;
  const ny = ys.length;
  const startX = grid.xIndex.get(Math.round(start.x * 1000));
  const startY = grid.yIndex.get(Math.round(start.y * 1000));
  const goalX = grid.xIndex.get(Math.round(goal.x * 1000));
  const goalY = grid.yIndex.get(Math.round(goal.y * 1000));
  if (startX === undefined || startY === undefined || goalX === undefined || goalY === undefined) return null;

  const keyOf = (x: number, y: number, dir: Dir): number => (x * ny + y) * 4 + dir;
  const bestG = new Map<number, number>();
  const came = new Map<number, number>();
  const heap = new Heap();

  const startKey = keyOf(startX, startY, request.startDir);
  bestG.set(startKey, 0);
  heap.push({
    key: startKey,
    xIndex: startX,
    yIndex: startY,
    dir: request.startDir,
    g: 0,
    f: manhattan(start, goal),
    h: manhattan(start, goal),
  });

  let expansions = 0;
  while (heap.size > 0) {
    const current = heap.pop() as Item;
    const known = bestG.get(current.key);
    if (known === undefined || current.g > known + 1e-9) continue;
    expansions += 1;
    if (expansions > CORE_TOKENS.maxExpansions) return null;

    if (current.xIndex === goalX && current.yIndex === goalY && current.dir === request.goalDir) {
      const path: Point[] = [];
      let cursor: number | undefined = current.key;
      while (cursor !== undefined) {
        const cell = Math.floor(cursor / 4);
        const yIndex = cell % ny;
        const xIndex = Math.floor(cell / ny);
        path.push({ x: coordX(xIndex), y: coordY(yIndex) });
        cursor = came.get(cursor);
      }
      path.reverse();
      return { waypoints: path, expansions };
    }

    const here: Point = { x: coordX(current.xIndex), y: coordY(current.yIndex) };
    for (const step of DIRS) {
      if ((step.dir + 2) % 4 === current.dir) continue; // keine Kehre
      const nextX = current.xIndex + step.dx;
      const nextY = current.yIndex + step.dy;
      if (nextX < 0 || nextY < 0 || nextX >= nx || nextY >= ny) continue;
      const target: Point = { x: coordX(nextX), y: coordY(nextY) };
      const segment: [Point, Point] = [here, target];
      const effectiveMargin = nearPort(segment, start, goal)
        ? CORE_TOKENS.marginLadder[CORE_TOKENS.marginLadder.length - 1]
        : request.margin;
      if (obstacles.blocked(segment, ownNodeIds, effectiveMargin)) continue;
      if (stubBlocks(segment, reservations, ownHandleKeys)) continue;

      const turn = step.dir === current.dir ? 0 : CORE_TOKENS.bendCost;
      const congestion =
        CORE_TOKENS.presentPenalty * occupancy.get(here.x, here.y, target.x, target.y) +
        occupancy.historyOf(here.x, here.y, target.x, target.y);
      const vertical = step.dy !== 0;
      const through = vertical
        ? occupancy.throughHorizontal(here.x, here.y)
        : occupancy.throughVertical(here.x, here.y);
      const crossing = step.dir === current.dir && through > 0 ? CORE_TOKENS.crossingCost * through : 0;
      const length = Math.abs(target.x - here.x) + Math.abs(target.y - here.y);
      const g = current.g + length + turn + congestion + crossing;
      const key = keyOf(nextX, nextY, step.dir);
      const previous = bestG.get(key);
      if (previous !== undefined && g >= previous - 1e-9) continue;
      bestG.set(key, g);
      came.set(key, current.key);
      const h = manhattan(target, goal);
      heap.push({ key, xIndex: nextX, yIndex: nextY, dir: step.dir, g, f: g + h, h });
    }
  }
  return null;
}
