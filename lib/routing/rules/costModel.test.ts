import { describe, expect, it } from 'vitest';
import {
  buildCostWeights,
  COST_FACTORS,
  COST_WEIGHTS,
  preferredLaneBonus,
  segmentExtraCost,
} from './costModel';
import { classifyCollision } from './collision';
import { SegmentSpatialIndex } from '../../../components/edges/utils/segmentSpatialIndex';
import { ROUTING_TOKENS } from '../tokens';
import type { Segment } from '../geometry';

/**
 * WP-6 (#396): Tests des A*-Kostenmodells.
 * Abnahme: Werte nur aus Token/Config, Overlap = Infinity, jede
 * Kostenklasse einzeln + Kombinationen, Konsistenz mit dem
 * Kollisionsmodell (hard = Infinity, weighted = Kosten).
 */

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

const grid = ROUTING_TOKENS.laneGrid;

describe('Kostenmatrix (generiert, nicht gepflegt)', () => {
  it('Werte leiten sich aus laneGrid ab — auch bei anderen Tokens', () => {
    const probe = buildCostWeights({ ...ROUTING_TOKENS, laneGrid: 10 });
    expect(probe.clearanceViolation).toBe(COST_FACTORS.clearancePerLaneGrid * 10);
    expect(probe.crossing).toBe(COST_FACTORS.crossingPerLaneGrid * 10);
    expect(probe.nearbyLane).toBe(COST_FACTORS.nearbyPerLaneGrid * 10);
    expect(probe.preferredLaneBonus).toBe(COST_FACTORS.preferredBonusPerLaneGrid * 10);
  });

  it('Spec-Ordnung: overlap > clearance > crossing > nearby > free; Bonus negativ', () => {
    expect(COST_WEIGHTS.overlap).toBe(Infinity);
    expect(COST_WEIGHTS.clearanceViolation).toBeGreaterThan(COST_WEIGHTS.crossing);
    expect(COST_WEIGHTS.crossing).toBeGreaterThan(COST_WEIGHTS.nearbyLane);
    expect(COST_WEIGHTS.nearbyLane).toBeGreaterThan(COST_WEIGHTS.freeSpace);
    expect(COST_WEIGHTS.preferredLaneBonus).toBeLessThan(0);
  });

  it('Sync mit dem Bestandsrouter: crossing = 120 (7,5 × laneGrid = bisheriger scorePath-Wert)', () => {
    expect(COST_WEIGHTS.crossing).toBe(120);
    expect(COST_WEIGHTS.crossing).toBe(COST_FACTORS.crossingPerLaneGrid * grid);
  });

  it('Matrix ist eingefroren (Object.freeze)', () => {
    expect(Object.isFrozen(COST_WEIGHTS)).toBe(true);
    expect(Object.isFrozen(COST_FACTORS)).toBe(true);
  });
});

describe('segmentExtraCost — jede Kostenklasse einzeln', () => {
  it('overlap ⇒ Infinity (garantiert unmöglich)', () => {
    const index = new SegmentSpatialIndex([seg(0, 0, 100, 0)]);
    const r = segmentExtraCost(seg(50, 0, 150, 0), index);
    expect(r.cost).toBe(Infinity);
    expect(r.overlaps).toBe(1);
  });

  it('clearance violation ⇒ VERY_HIGH', () => {
    const index = new SegmentSpatialIndex([seg(0, 8, 100, 8)]); // 8 px < 12
    const r = segmentExtraCost(seg(0, 0, 100, 0), index);
    expect(r.cost).toBe(COST_WEIGHTS.clearanceViolation);
    expect(r.clearanceViolations).toBe(1);
    expect(r.overlaps).toBe(0);
  });

  it('crossing ⇒ HIGH', () => {
    const index = new SegmentSpatialIndex([seg(50, -50, 50, 50)]);
    const r = segmentExtraCost(seg(0, 0, 100, 0), index);
    expect(r.cost).toBe(COST_WEIGHTS.crossing);
    expect(r.crossings).toBe(1);
  });

  it('nearby lane (über Clearance, innerhalb einer Lane-Breite) ⇒ MEDIUM', () => {
    // Abstand 16: ≥ 12 (keine Verletzung), < 12+16 (nearby).
    const index = new SegmentSpatialIndex([seg(0, grid, 100, grid)]);
    const r = segmentExtraCost(seg(0, 0, 100, 0), index);
    expect(r.cost).toBe(COST_WEIGHTS.nearbyLane);
    expect(r.nearbyLanes).toBe(1);
  });

  it('free space ⇒ LOW (0 Zusatzkosten)', () => {
    const index = new SegmentSpatialIndex([seg(0, 200, 100, 200)]);
    const r = segmentExtraCost(seg(0, 0, 100, 0), index);
    expect(r.cost).toBe(COST_WEIGHTS.freeSpace);
    expect(r.crossings + r.clearanceViolations + r.nearbyLanes + r.overlaps).toBe(0);
  });
});

describe('segmentExtraCost — Kombinationen', () => {
  it('crossing + nearby summieren; Reihenfolge der Nachbarn irrelevant', () => {
    const neighbors = [seg(50, -50, 50, 50), seg(0, grid, 100, grid)];
    const a = segmentExtraCost(seg(0, 0, 100, 0), new SegmentSpatialIndex(neighbors));
    const b = segmentExtraCost(seg(0, 0, 100, 0), new SegmentSpatialIndex([...neighbors].reverse()));
    expect(a.cost).toBe(COST_WEIGHTS.crossing + COST_WEIGHTS.nearbyLane);
    expect(b.cost).toBe(a.cost);
  });

  it('overlap dominiert jede Kombination (Abbruch mit Infinity)', () => {
    const index = new SegmentSpatialIndex([
      seg(0, 0, 100, 0), // Overlap
      seg(50, -50, 50, 50), // Crossing (würde sonst zählen)
    ]);
    const r = segmentExtraCost(seg(25, 0, 75, 0), index);
    expect(r.cost).toBe(Infinity);
  });

  it('Domain-Clearance (24) verschiebt die Grenze weighted/none', () => {
    // Abstand 20: Basis-Clearance 12 ⇒ nearby; Domänen-Clearance 24 ⇒ Verletzung.
    const index = new SegmentSpatialIndex([seg(0, 20, 100, 20)]);
    const base = segmentExtraCost(seg(0, 0, 100, 0), index);
    const domain = segmentExtraCost(seg(0, 0, 100, 0), index, {
      clearance: ROUTING_TOKENS.crossDomainSpacing,
    });
    expect(base.cost).toBe(COST_WEIGHTS.nearbyLane);
    expect(domain.cost).toBe(COST_WEIGHTS.clearanceViolation);
  });
});

describe('Konsistenz mit dem Kollisionsmodell (WP-3)', () => {
  const cases: { name: string; other: Segment }[] = [
    { name: 'Overlap', other: seg(50, 0, 150, 0) },
    { name: 'Crossing', other: seg(50, -50, 50, 50) },
    { name: 'Clearance', other: seg(0, 8, 100, 8) },
    { name: 'Frei', other: seg(0, 200, 100, 200) },
  ];
  const own = seg(0, 0, 100, 0);

  for (const { name, other } of cases) {
    it(`${name}: hard ⇒ Infinity, soft/weighted ⇒ endliche Kosten, none ⇒ 0/nearby`, () => {
      const constraint = classifyCollision({ type: 'edge-edge', a: own, b: other });
      const { cost } = segmentExtraCost(own, new SegmentSpatialIndex([other]));
      if (constraint.class === 'hard') expect(cost).toBe(Infinity);
      if (constraint.class === 'soft') expect(cost).toBe(COST_WEIGHTS.crossing);
      if (constraint.class === 'weighted') expect(cost).toBe(COST_WEIGHTS.clearanceViolation);
      if (constraint.class === 'none') expect(Number.isFinite(cost)).toBe(true);
    });
  }
});

describe('preferredLaneBonus (WP-5-Anbindung)', () => {
  it('Bonus nur auf der Registry-Lane, 0 sonst und ohne Registry-Wissen', () => {
    expect(preferredLaneBonus(16, 16)).toBe(COST_WEIGHTS.preferredLaneBonus);
    expect(preferredLaneBonus(0, 16)).toBe(0);
    expect(preferredLaneBonus(16, undefined)).toBe(0);
  });
});
