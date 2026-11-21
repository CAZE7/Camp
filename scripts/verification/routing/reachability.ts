/**
 * Erreichbarkeits-Orakel (Regel R-ERR-1).
 *
 * Der Befund, der diese Datei erzwungen hat: Im Kern-Lauf meldete ein
 * Index/Koordinate-Vertipper im A\* alle neun Kanten als `unroutable`. Kein Gate
 * schlug an — es gab ja keine Route, an der etwas zu verletzen gewesen wäre.
 * Ein BFS über dasselbe Gitter erreichte in derselben Situation 2 642
 * Positionen, der A\* nur 770.
 *
 * Deshalb: **jede** Aussage „kein Weg“ braucht eine zweite, einfachere Meinung.
 * Dieses Modul ist diese Meinung — absichtlich dumm:
 *
 *  * Raster statt Gitterschnitt (feste Schrittweite),
 *  * BFS statt A\* (keine Kosten, keine Richtung, keine Heuristik),
 *  * nur Bauteilboxen als Hindernisse, aufgebläht um die Freigabe,
 *  * keine Stubs, keine Lanes, keine Belegung.
 *
 * Es ist damit **großzügiger** als jeder echte Router: findet es keinen Weg,
 * ist keiner da. Findet es einen, heißt das nicht automatisch, dass der Router
 * ihn finden musste — deshalb ist der Befund „erreichbar, aber unrouted“ ein
 * *Verdacht*, der benannt und geprüft werden muss (R-ERR-3), kein automatisches
 * Urteil.
 */

import type { Point } from '../../../lib/routing/geometry';

export type BoxObstacle = { id: string; x: number; y: number; width: number; height: number };

export type ReachabilityResult = {
  reachable: boolean;
  /** Anzahl besuchter Rasterpositionen — Diagnosewert für den Bericht. */
  visited: number;
  /** Rasterweite in px. */
  step: number;
};

const EPS = 1e-6;

/**
 * BFS auf einem Raster zwischen zwei Punkten.
 *
 * @param start Startpunkt (Anschluss- oder Stubkoordinate)
 * @param goal Zielpunkt
 * @param obstacles Bauteilboxen — werden um `clearance` aufgebläht
 * @param step Rasterweite; kleiner = genauer und langsamer (Standard 8 px)
 * @param ownNodeIds Bauteile, an denen Start und Ziel hängen (nicht als Hindernis)
 */
export function reachable(
  start: Point,
  goal: Point,
  obstacles: readonly BoxObstacle[],
  options: { clearance?: number; step?: number; ownNodeIds?: ReadonlySet<string>; padding?: number } = {}
): ReachabilityResult {
  const clearance = options.clearance ?? 12;
  const step = options.step ?? 8;
  const own = options.ownNodeIds ?? new Set<string>();
  const padding = options.padding ?? 160;

  const inflated = obstacles
    .filter((box) => !own.has(box.id))
    .map((box) => ({
      x0: box.x - clearance,
      x1: box.x + box.width + clearance,
      y0: box.y - clearance,
      y1: box.y + box.height + clearance,
    }));

  const minX = Math.min(start.x, goal.x) - padding;
  const maxX = Math.max(start.x, goal.x) + padding;
  const minY = Math.min(start.y, goal.y) - padding;
  const maxY = Math.max(start.y, goal.y) + padding;
  const columns = Math.max(2, Math.ceil((maxX - minX) / step) + 1);
  const rows = Math.max(2, Math.ceil((maxY - minY) / step) + 1);

  const toCell = (point: Point): { column: number; row: number } => ({
    column: Math.min(columns - 1, Math.max(0, Math.round((point.x - minX) / step))),
    row: Math.min(rows - 1, Math.max(0, Math.round((point.y - minY) / step))),
  });
  const centerOf = (column: number, row: number): Point => ({
    x: minX + column * step,
    y: minY + row * step,
  });

  const blocked = (column: number, row: number): boolean => {
    const point = centerOf(column, row);
    for (const box of inflated) {
      if (
        point.x > box.x0 + EPS &&
        point.x < box.x1 - EPS &&
        point.y > box.y0 + EPS &&
        point.y < box.y1 - EPS
      ) {
        return true;
      }
    }
    return false;
  };

  const startCell = toCell(start);
  const goalCell = toCell(goal);
  // Start und Ziel sind Anschlusspunkte und liegen per Definition am Rand einer
  // Box; sie werden nicht als blockiert gewertet (sonst wäre jeder Plan
  // „unerreichbar“).
  const seen = new Uint8Array(columns * rows);
  const queueX = new Int32Array(columns * rows);
  const queueY = new Int32Array(columns * rows);
  let head = 0;
  let tail = 0;
  const startIndex = startCell.row * columns + startCell.column;
  seen[startIndex] = 1;
  queueX[tail] = startCell.column;
  queueY[tail] = startCell.row;
  tail += 1;

  while (head < tail) {
    const column = queueX[head] as number;
    const row = queueY[head] as number;
    head += 1;
    if (column === goalCell.column && row === goalCell.row) {
      return { reachable: true, visited: tail, step };
    }
    const neighbours: [number, number][] = [
      [column + 1, row],
      [column - 1, row],
      [column, row + 1],
      [column, row - 1],
    ];
    for (const [nextColumn, nextRow] of neighbours) {
      if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) continue;
      const index = nextRow * columns + nextColumn;
      if (seen[index]) continue;
      if (blocked(nextColumn, nextRow)) continue;
      seen[index] = 1;
      queueX[tail] = nextColumn;
      queueY[tail] = nextRow;
      tail += 1;
    }
  }

  return { reachable: false, visited: tail, step };
}
