import { describe, expect, it } from 'vitest';
import {
  buildCostWeights,
  COST_FACTORS,
  COST_WEIGHTS,
  preferredLaneBonus,
  segmentExtraCost,
} from './costModel';
import { classifyCollision } from './collision';
import { SegmentSpatialIndex } from '../geometry/segmentSpatialIndex';
import { ROUTING_TOKENS } from '../tokens';
import { checkEdgeEdgeOverlaps } from '../invariants';
import { routedPathGeometry } from './portBundle';
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
    expect(probe.bend).toBe(COST_FACTORS.bendPerLaneGrid * 10);
    expect(probe.uTurn).toBe(COST_FACTORS.uTurnPerLaneGrid * 10);
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

  it('Sync ROUTE-002: Biegung = 80 und Kehre = 400 (5 bzw. 25 × laneGrid) aus dem Modell', () => {
    // Die Produktivkonstanten in components/edges/utils/pathfinding.ts lesen
    // diese Werte; die Gegenseite friert `pathfinding.test.ts` ein (Drift-Guard).
    expect(COST_WEIGHTS.bend).toBe(5 * grid);
    expect(COST_WEIGHTS.bend).toBe(80);
    expect(COST_WEIGHTS.uTurn).toBe(25 * grid);
    expect(COST_WEIGHTS.uTurn).toBe(400);
  });

  it('Ordnung der Kantenkosten: Kehre > Kreuzung > Biegung > Nah-Lane', () => {
    expect(COST_WEIGHTS.uTurn).toBeGreaterThan(COST_WEIGHTS.crossing);
    expect(COST_WEIGHTS.uTurn).toBe(COST_WEIGHTS.clearanceViolation);
    expect(COST_WEIGHTS.crossing).toBeGreaterThan(COST_WEIGHTS.bend);
    expect(COST_WEIGHTS.bend).toBeGreaterThan(COST_WEIGHTS.nearbyLane);
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

/**
 * ROUTE-002 (gemessene Grenze, 2026-09-27): Die `hard`-Klasse des Modells
 * kennt die Port-Bündel-Ausnahme (ADR 0009) NICHT — sie lebt im
 * Invarianten-Check (`checkEdgeEdgeOverlaps`). Über die sechs Referenzpläne
 * zählt die Klassifikation 47 fremde `hard`-Paare, und alle 47 sind genau
 * diese Ausnahme (I2 selbst: 0). Deshalb kann `segmentExtraCost` nicht
 * unverändert der Auswahl im Produktivpfad vorgeschaltet werden — wer das
 * tut, muss die Stub-Kenntnis mitbringen. Dieser Test hält den Grund fest.
 */

describe('segmentExtraCost — Port-Bündel-Ausnahme (ROUTE-002 Teil 2, ADR 0009)', () => {
  // Zwei Leitungen verlassen denselben Handle nach rechts und teilen sich
  // dort den Stub (a 60 px, b 90 px weit).
  const a = routedPathGeometry([
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 80 },
  ]);
  const b = routedPathGeometry([
    { x: 0, y: 0 },
    { x: 90, y: 0 },
    { x: 90, y: 70 },
  ]);
  // Nur b's Stub im Index — der Fall soll die Ausnahme isolieren, nicht die
  // übrigen Wechselwirkungen zweier Bündel-Kanten mittesten.
  const stubIndex = () => new SegmentSpatialIndex([b.stubs[0]!]);

  it('ohne Stub-Kenntnis bleibt der gemeinsame Stub hart (fail-safe)', () => {
    const r = segmentExtraCost(a.stubs[0]!, stubIndex());
    expect(r.cost).toBe(Infinity);
    expect(r.overlaps).toBe(1);
    expect(r.portBundleShared).toBe(0);
  });

  it('mit Stub-Kenntnis ist genau dieselbe Überdeckung erlaubt und kostenfrei', () => {
    const r = segmentExtraCost(a.stubs[0]!, stubIndex(), { portBundle: { own: a, otherOf: () => b } });
    expect(r.cost).toBe(0);
    expect(r.overlaps).toBe(0);
    expect(r.portBundleShared).toBe(1);
  });

  it('dieselben zwei Kanten sind für I2 kein Verstoß — Modell und Invariante sind einig', () => {
    const routed = [
      { id: 'a', source: 'n1', target: 'n2', waypoints: a.points as { x: number; y: number }[] },
      { id: 'b', source: 'n1', target: 'n3', waypoints: b.points as { x: number; y: number }[] },
    ];
    expect(checkEdgeEdgeOverlaps(routed)).toHaveLength(0);
  });

  it('Rückkehr auf die Stub-Linie über ein Mittelstück bleibt auch mit Kenntnis hart', () => {
    // Längere Kante, deren Stub bis x=300 reicht …
    const long = routedPathGeometry([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 80 },
    ]);
    // … und eine Kante, die über ein MITTLERES Segment auf die Linie y=0
    // zurückkehrt: die Überdeckung [150, 200] liegt im Stub der langen Kante,
    // aber außerhalb der Stubs dieser Kante (ADR 0009).
    const back = routedPathGeometry([
      { x: 0, y: 0 },
      { x: 0, y: 60 },
      { x: 200, y: 60 },
      { x: 200, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 100 },
    ]);
    const middle = back.segments.find((s) => s[0].y === 0 && s[1].y === 0)!;
    expect(middle).toBeDefined();
    const r = segmentExtraCost(long.stubs[0]!, new SegmentSpatialIndex([middle]), {
      portBundle: { own: long, otherOf: () => back },
    });
    expect(r.cost).toBe(Infinity);
    expect(r.overlaps).toBe(1);
    expect(r.portBundleShared).toBe(0);
  });
});
