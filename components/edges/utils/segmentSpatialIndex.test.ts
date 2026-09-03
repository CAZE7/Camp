import { describe, expect, it } from 'vitest';
import { SegmentSpatialIndex, SPATIAL_CELL_SIZE } from './segmentSpatialIndex';
import type { Segment } from './orthogonalRouting';

/**
 * R-4 (Routing-Qualität): Unit-Tests für den Spatial-Index, der den
 * Kreuzungs-Scan in großen Plänen (> 120 Kanten) am Leben hält.
 */

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

describe('SegmentSpatialIndex (R-4)', () => {
  it('indexiert alle Segmente und meldet die Anzahl', () => {
    const index = new SegmentSpatialIndex([seg(0, 0, 100, 0), seg(500, 500, 900, 500)]);
    expect(index.size).toBe(2);
  });

  it('findet Segmente in der Abfragebox und keine fernen', () => {
    const near = seg(0, 0, 100, 0);
    const far = seg(5000, 5000, 5100, 5000);
    const index = new SegmentSpatialIndex([near, far]);
    const hits = index.queryRect({ x: -50, y: -50, width: 200, height: 200 });
    expect(hits).toContain(near);
    expect(hits).not.toContain(far);
  });

  it('queryNear padet die Bounding-Box der Strecke in alle Richtungen', () => {
    const above = seg(50, -100, 60, -90);
    const below = seg(50, 300, 60, 310);
    const index = new SegmentSpatialIndex([above, below]);
    expect(index.queryNear({ x: 0, y: 0 }, { x: 100, y: 0 }, 150)).toContain(above);
    expect(index.queryNear({ x: 0, y: 0 }, { x: 100, y: 0 }, 150)).not.toContain(below);
  });

  it('lange Segmente erscheinen in allen überstrichenen Zellen (keine Lücke)', () => {
    // 1000 px langes Segment überspannt mehrere Zellen; eine Abfrage am
    // fernen Ende muss es trotzdem liefern.
    const long = seg(0, 0, 1000, 0);
    const index = new SegmentSpatialIndex([long]);
    expect(index.queryRect({ x: 950, y: 0, width: 10, height: 10 })).toContain(long);
    expect(index.queryRect({ x: 0, y: 0, width: 10, height: 10 })).toContain(long);
  });

  it('liefert keine Duplikate, auch wenn ein Segment in mehreren Zellen liegt', () => {
    const index = new SegmentSpatialIndex([seg(0, 0, 400, 0)]);
    const hits = index.queryRect({ x: 0, y: 0, width: 400, height: 100 });
    expect(hits).toHaveLength(1);
  });

  it('Zellgröße ist dokumentiert und stabil (160 px)', () => {
    expect(SPATIAL_CELL_SIZE).toBe(160);
  });
});
