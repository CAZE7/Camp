import type { Point, Rect, Segment } from './orthogonalRouting';

/**
 * R-4 (Routing-Qualität): Spatialer Index für den Kreuzungs-Scan.
 *
 * Bisher warf `CableEdge` bei mehr als CROSSING_SCAN_EDGE_LIMIT (120)
 * Kanten die Kreuzungsprüfung komplett weg — große Pläne verloren damit
 * still die Kreuzungsvermeidung. Der O(E²)-Vergleich pro Kante ist dafür
 * nicht nötig: dieser uniforme Gitter-Index ordnet jedes Segment den
 * Zellen seiner Bounding-Box zu; eine Kante fragt nur noch die Segmente
 * ihrer eigenen Umgebung ab. Der Scan bleibt in großen Plänen aktiv.
 *
 * Rein und framework-frei; Index-Bau O(S), Abfrage O(Treffer).
 */

/** Zellgröße des Gitters in px (≈ 2 Kabelabschnitte plus Freigabe). */
export const SPATIAL_CELL_SIZE = 160;

const cellKey = (cx: number, cy: number): string => `${cx}:${cy}`;

export class SegmentSpatialIndex {
  private readonly cells = new Map<string, Segment[]>();
  private readonly cellSize: number;
  private readonly count: number;

  constructor(segments: Segment[], cellSize: number = SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize;
    this.count = segments.length;
    for (const segment of segments) {
      const [a, b] = segment;
      const minCx = Math.floor(Math.min(a.x, b.x) / cellSize);
      const maxCx = Math.floor(Math.max(a.x, b.x) / cellSize);
      const minCy = Math.floor(Math.min(a.y, b.y) / cellSize);
      const maxCy = Math.floor(Math.max(a.y, b.y) / cellSize);
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = cellKey(cx, cy);
          const bucket = this.cells.get(key);
          if (bucket) {
            if (bucket[bucket.length - 1] !== segment) bucket.push(segment);
          } else {
            this.cells.set(key, [segment]);
          }
        }
      }
    }
  }

  /** Zahl der indexierten Segmente. */
  get size(): number {
    return this.count;
  }

  /**
   * Alle Segmente, deren Bounding-Box das Abfrage-Rechteck berührt.
   * (Grobe Vorfilterung — exakte Schnittprüfung macht der Aufrufer mit
   * `segmentsIntersect`.)
   */
  queryRect(rect: Rect): Segment[] {
    const minCx = Math.floor(rect.x / this.cellSize);
    const maxCx = Math.floor((rect.x + rect.width) / this.cellSize);
    const minCy = Math.floor(rect.y / this.cellSize);
    const maxCy = Math.floor((rect.y + rect.height) / this.cellSize);
    const out: Segment[] = [];
    const seen = new Set<Segment>();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const segment of bucket) {
          if (seen.has(segment)) continue;
          seen.add(segment);
          out.push(segment);
        }
      }
    }
    return out;
  }

  /**
   * Segmente nahe der Strecke a→b: Abfragebox = Bounding-Box der Strecke,
   * um `padding` in alle Richtungen erweitert.
   */
  queryNear(a: Point, b: Point, padding: number): Segment[] {
    return this.queryRect({
      x: Math.min(a.x, b.x) - padding,
      y: Math.min(a.y, b.y) - padding,
      width: Math.abs(a.x - b.x) + 2 * padding,
      height: Math.abs(a.y - b.y) + 2 * padding,
    });
  }
}
