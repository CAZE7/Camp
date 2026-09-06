import { describe, expect, it } from 'vitest';
import {
  areCollinear,
  containsPoint,
  countBends,
  distancePointToSegment,
  distanceSegmentToRect,
  distanceSegmentToSegment,
  hasMinimumStubs,
  inflateObstacle,
  inflateRect,
  isOrthogonalPath,
  laneOffset,
  manhattan,
  mergeCloseBends,
  pathLength,
  pointOnSegment,
  segmentHitsRect,
  segmentsCross,
  segmentIntersectionPoint,
  segmentsIntersect,
  segmentsOverlap,
  simplifyWaypoints,
  waypointsToSegments,
  type Point,
  type Rect,
  type Segment,
} from './index';
import { ROUTING_TOKENS } from '../tokens';

/**
 * WP-2 (#392): Unit-Tests der Geometrie-Primitives inkl. der geforderten
 * Grenzfälle: kollineare Segmente, Touch (Berührung ohne Kreuzung),
 * Punkt-auf-Segment.
 */

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

describe('segmentsIntersect / segmentsCross (echte Kreuzung vs. Touch)', () => {
  it('klassisches Kreuz: intersect UND cross', () => {
    const a = seg(0, 0, 10, 0);
    const b = seg(5, -5, 5, 5);
    expect(segmentsIntersect(a, b)).toBe(true);
    expect(segmentsCross(a, b)).toBe(true);
  });

  it('Touch — Endpunkt auf fremdem Segment: intersect, aber KEIN cross', () => {
    const a = seg(0, 0, 10, 0);
    const touching = seg(5, 0, 5, 5); // startet AUF a
    expect(segmentsIntersect(a, touching)).toBe(true);
    expect(segmentsCross(a, touching)).toBe(false);
  });

  it('Touch — gemeinsamer Eckpunkt: intersect, kein cross', () => {
    const a = seg(0, 0, 10, 0);
    const corner = seg(10, 0, 10, 10);
    expect(segmentsIntersect(a, corner)).toBe(true);
    expect(segmentsCross(a, corner)).toBe(false);
  });

  it('disjunkte Segmente: weder intersect noch cross', () => {
    expect(segmentsIntersect(seg(0, 0, 10, 0), seg(0, 5, 10, 5))).toBe(false);
    expect(segmentsCross(seg(0, 0, 10, 0), seg(0, 5, 10, 5))).toBe(false);
  });

  it('kollineare Überlappung: intersect, aber kein cross (Overlap ≠ Crossing)', () => {
    const a = seg(0, 0, 10, 0);
    const b = seg(5, 0, 15, 0);
    expect(segmentsIntersect(a, b)).toBe(true);
    expect(segmentsCross(a, b)).toBe(false);
  });
});

describe('segmentIntersectionPoint (Grundlage Kreuzungs-Hopping, WP-7)', () => {
  it('liefert den Schnittpunkt eines orthogonalen Kreuzes', () => {
    expect(segmentIntersectionPoint(seg(0, 100, 200, 100), seg(60, 0, 60, 200))).toEqual({ x: 60, y: 100 });
  });

  it('liefert den Schnittpunkt auch bei schrägen Strecken', () => {
    const point = segmentIntersectionPoint(seg(0, 0, 10, 10), seg(0, 10, 10, 0));
    expect(point?.x).toBeCloseTo(5);
    expect(point?.y).toBeCloseTo(5);
  });

  it('gibt undefined zurück, wo segmentsCross false ist (Touch, Overlap, disjunkt, parallel)', () => {
    expect(segmentIntersectionPoint(seg(0, 0, 10, 0), seg(5, 0, 5, 5))).toBeUndefined();
    expect(segmentIntersectionPoint(seg(0, 0, 10, 0), seg(5, 0, 15, 0))).toBeUndefined();
    expect(segmentIntersectionPoint(seg(0, 0, 10, 0), seg(0, 5, 10, 5))).toBeUndefined();
    expect(segmentIntersectionPoint(seg(0, 0, 10, 0), seg(20, -5, 20, 5))).toBeUndefined();
  });

  it('ist symmetrisch in den Argumenten', () => {
    const a = seg(0, 40, 90, 40);
    const b = seg(33, 10, 33, 90);
    expect(segmentIntersectionPoint(a, b)).toEqual(segmentIntersectionPoint(b, a));
  });
});

describe('areCollinear / segmentsOverlap (Grenzfall kollinear)', () => {
  it('kollinear horizontal, vertikal und diagonal', () => {
    expect(areCollinear(seg(0, 0, 10, 0), seg(20, 0, 30, 0))).toBe(true);
    expect(areCollinear(seg(0, 0, 0, 10), seg(0, 20, 0, 30))).toBe(true);
    expect(areCollinear(seg(0, 0, 10, 10), seg(20, 20, 30, 30))).toBe(true);
    expect(areCollinear(seg(0, 0, 10, 0), seg(0, 1, 10, 1))).toBe(false);
  });

  it('Overlap braucht echte gemeinsame Länge', () => {
    expect(segmentsOverlap(seg(0, 0, 10, 0), seg(5, 0, 15, 0))).toBe(true);
    expect(segmentsOverlap(seg(0, 0, 10, 0), seg(2, 0, 8, 0))).toBe(true); // enthalten
    expect(segmentsOverlap(seg(0, 0, 0, 10), seg(0, 5, 0, 15))).toBe(true); // vertikal
  });

  it('Ende-an-Ende (Punktberührung) ist KEIN Overlap', () => {
    expect(segmentsOverlap(seg(0, 0, 10, 0), seg(10, 0, 20, 0))).toBe(false);
  });

  it('parallel, aber versetzt: kein Overlap', () => {
    expect(segmentsOverlap(seg(0, 0, 10, 0), seg(0, 1, 10, 1))).toBe(false);
  });
});

describe('pointOnSegment (Grenzfall Punkt-auf-Segment)', () => {
  const s = seg(0, 0, 10, 0);
  it('innerer Punkt, Endpunkte, daneben', () => {
    expect(pointOnSegment({ x: 5, y: 0 }, s)).toBe(true);
    expect(pointOnSegment({ x: 0, y: 0 }, s)).toBe(true);
    expect(pointOnSegment({ x: 10, y: 0 }, s)).toBe(true);
    expect(pointOnSegment({ x: 5, y: 0.1 }, s)).toBe(false);
    expect(pointOnSegment({ x: 11, y: 0 }, s)).toBe(false); // kollinear, aber außerhalb
  });
});

describe('Distanzen', () => {
  it('distancePointToSegment: Projektion und Endpunkt-Fälle', () => {
    const s = seg(0, 0, 10, 0);
    expect(distancePointToSegment({ x: 5, y: 3 }, s)).toBeCloseTo(3);
    expect(distancePointToSegment({ x: -3, y: 4 }, s)).toBeCloseTo(5); // vor dem Start
    expect(distancePointToSegment({ x: 5, y: 0 }, s)).toBeCloseTo(0);
  });

  it('distanceSegmentToSegment: 0 bei Schnitt/Touch, sonst Minimalabstand', () => {
    expect(distanceSegmentToSegment(seg(0, 0, 10, 0), seg(5, -5, 5, 5))).toBe(0);
    expect(distanceSegmentToSegment(seg(0, 0, 10, 0), seg(5, 0, 5, 5))).toBe(0); // Touch
    expect(distanceSegmentToSegment(seg(0, 0, 10, 0), seg(0, 4, 10, 4))).toBeCloseTo(4);
    expect(distanceSegmentToSegment(seg(0, 0, 10, 0), seg(13, 4, 20, 4))).toBeCloseTo(5);
  });

  it('distanceSegmentToRect: innen, schneidend, außen', () => {
    const r: Rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(distanceSegmentToRect(seg(2, 2, 8, 8), r)).toBe(0); // komplett innen
    expect(distanceSegmentToRect(seg(-5, 5, 15, 5), r)).toBe(0); // durchquert
    expect(distanceSegmentToRect(seg(-5, -5, -5, 15), r)).toBeCloseTo(5); // links daneben
    expect(distanceSegmentToRect(seg(20, 20, 30, 20), r)).toBeCloseTo(Math.hypot(10, 10));
  });
});

describe('Rect-Primitives', () => {
  it('inflateRect wächst symmetrisch', () => {
    expect(inflateRect({ x: 10, y: 10, width: 20, height: 20 }, 5)).toEqual({
      x: 5,
      y: 5,
      width: 30,
      height: 30,
    });
  });

  it('containsPoint: Rand zählt nicht als innen', () => {
    const r: Rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(containsPoint(r, { x: 5, y: 5 })).toBe(true);
    expect(containsPoint(r, { x: 0, y: 5 })).toBe(false);
    expect(containsPoint(r, { x: 10, y: 10 })).toBe(false);
  });

  it('segmentHitsRect: Tangente am Rand ist kein Treffer', () => {
    const r: Rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(segmentHitsRect({ x: -5, y: 5 }, { x: 15, y: 5 }, r)).toBe(true);
    expect(segmentHitsRect({ x: -5, y: 0 }, { x: 15, y: 0 }, r)).toBe(false); // exakt auf Kante
    expect(segmentHitsRect({ x: -5, y: -5 }, { x: 15, y: -5 }, r)).toBe(false);
  });

  it('inflateObstacle: Handle-Ausrisse (±22 px, M11-1) wachsen in die Box', () => {
    const node: Rect = { x: 100, y: 100, width: 192, height: 120 };
    const clearance = ROUTING_TOKENS.cableClearance;
    // Handle ragt 22 px links aus der Karte (x relativ zur Node-Box negativ).
    const withHandle = inflateObstacle(node, [{ x: -22, y: 36, width: 24, height: 24 }], clearance);
    const without = inflateObstacle(node, [], clearance);
    expect(without).toEqual(inflateRect(node, clearance));
    expect(withHandle.x).toBe(node.x - 22 - clearance);
    expect(withHandle.width).toBe(node.width + 22 + 2 * clearance);
    // Handle innerhalb der Box ändert nichts.
    const inner = inflateObstacle(node, [{ x: 10, y: 10, width: 24, height: 24 }], clearance);
    expect(inner).toEqual(without);
  });
});

describe('Polylinien-Primitives', () => {
  const stair: Point[] = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 50 },
    { x: 100, y: 50 },
  ];

  it('pathLength / countBends / isOrthogonalPath / manhattan', () => {
    expect(pathLength(stair)).toBe(150);
    expect(countBends(stair)).toBe(2);
    expect(isOrthogonalPath(stair)).toBe(true);
    expect(isOrthogonalPath([...stair, { x: 120, y: 70 }])).toBe(false);
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });

  it('waypointsToSegments filtert Null-Längen', () => {
    expect(
      waypointsToSegments([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ])
    ).toHaveLength(1);
  });

  it('simplifyWaypoints entfernt Duplikate und kollineare Zwischenpunkte', () => {
    const noisy: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(simplifyWaypoints(noisy)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });
});

describe('Stub-Minimum-Check (Invariante 5)', () => {
  it('erkennt zu kurze erste/letzte Segmente', () => {
    const ok: Point[] = [
      { x: 0, y: 0 },
      { x: 24, y: 0 },
      { x: 24, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(hasMinimumStubs(ok)).toBe(true);
    const shortFirst: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 100 },
      { x: -30, y: 100 },
    ];
    expect(hasMinimumStubs(shortFirst)).toBe(false);
    expect(hasMinimumStubs(shortFirst, 10)).toBe(true); // eigener Schwellwert
    expect(hasMinimumStubs([])).toBe(false);
  });
});

describe('Bend-Merge (kein Zitter-Treppenmuster)', () => {
  it('verschmilzt Doppel-Bend mit Innensegment < 2×bendRadius', () => {
    // Treppe mit 8-px-Zwischenstufe (< 16 = 2×bendRadius)
    const jitter: Point[] = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 8 },
      { x: 100, y: 8 },
      { x: 100, y: 60 },
    ];
    const merged = mergeCloseBends(jitter);
    expect(countBends(merged)).toBeLessThan(countBends(jitter));
    expect(isOrthogonalPath(merged)).toBe(true);
    // Endpunkte bleiben exakt erhalten.
    expect(merged[0]).toEqual(jitter[0]);
    expect(merged[merged.length - 1]).toEqual(jitter[jitter.length - 1]);
  });

  it('lässt Segmente ≥ 2×bendRadius unangetastet', () => {
    const clean: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ];
    expect(mergeCloseBends(clean)).toEqual(clean);
  });

  it('kaskadiert: Merge kann Folge-Merges auslösen, terminiert immer', () => {
    const doubleJitter: Point[] = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 8 },
      { x: 80, y: 8 },
      { x: 80, y: 14 },
      { x: 140, y: 14 },
      { x: 140, y: 60 },
    ];
    const merged = mergeCloseBends(doubleJitter);
    expect(isOrthogonalPath(merged)).toBe(true);
    expect(countBends(merged)).toBeLessThanOrEqual(2);
  });
});

describe('Lane-Berechnung', () => {
  it('offset = laneIndex × laneGrid (Token)', () => {
    expect(laneOffset(0)).toBe(0);
    expect(laneOffset(1)).toBe(ROUTING_TOKENS.laneGrid);
    expect(laneOffset(-2)).toBe(-2 * ROUTING_TOKENS.laneGrid);
    expect(laneOffset(1.5, 10)).toBe(15); // expliziter Grid-Parameter
  });
});
