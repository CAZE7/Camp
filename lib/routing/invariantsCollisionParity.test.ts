import { describe, expect, it } from 'vitest';
import {
  checkClearance,
  checkEdgeEdgeOverlaps,
  checkEdgeNodeCollisions,
  type NodeRect,
  type RoutedEdge,
} from './invariants';
import { classifySegmentAgainstNode, classifySegmentAgainstSegment } from './rules/collision';
import { ROUTING_TOKENS } from './tokens';
import type { Point, Segment } from './geometry';

/**
 * ADR 0019 / AUDIT ROUTE-003 (Fix 2026-09-08) — Parity zwischen den
 * Final-Gate-Checkern und dem geteilten Kollisionsmodell.
 *
 * Die Checker sind jetzt Buchhaltung über `classifySegmentAgainstNode` /
 * `classifySegmentAgainstSegment` (hard ⇒ I1/I2, weighted ⇒ I3). Dieser Test
 * gibt jede Zuordnung GEGEN sich selbst frei: Für jede synthetische
 * Konstellation wird die Erwartung ein zweites Mal aufgeschrieben — aus den
 * Modell-Klassen, nicht aus dem Checker-Code. Wer künftig Klassen umbenannt,
 * Schwellen dreht oder die Buckets vertauscht, wird hier erwischt.
 *
 * Die Zahlen der Produktiv-Reality (Golden-Master-Pläne) bleiben
 * `invariants.test.ts` (LEGACY_BASELINE, eingefroren) und dem Ratchet
 * (`scripts/routing/finalValidation.test.ts`) vorbehalten.
 */

const C = ROUTING_TOKENS.cableClearance;

const rectAt = (id: string): NodeRect => ({ id, x: 0, y: 0, width: 100, height: 60 });

const edgeWith = (id: string, points: Point[]): RoutedEdge => ({
  id,
  source: 'src',
  target: 'dst',
  waypoints: points,
});

/** Horizontale Strecke auf Höhe y quer über die Box (x −10 … 110). */
const hSeg = (y: number): Segment => [
  { x: -10, y },
  { x: 110, y },
];

const violations = (
  checker: (edges: readonly RoutedEdge[], nodes: readonly NodeRect[]) => unknown[],
  points: Point[]
) => checker([edgeWith('e', points)], [rectAt('n')]).length;

describe('I1 ⇔ Modell-Klasse hard (edge × node)', () => {
  it('Segment durch die Box ⇒ genau ein I1-Verstoß, und der Modell-Befund ist hard', () => {
    expect(violations(checkEdgeNodeCollisions, [...hSeg(30)])).toBe(1);
    expect(classifySegmentAgainstNode(hSeg(30), rectAt('n')).class).toBe('hard');
  });

  it('Segment mit Clearance-Distanz ⇒ kein I1 (das ist I3-Terrain)', () => {
    const y = 60 + C - 1; // 1px oberhalb der Schwelle unterhalb der Box
    expect(violations(checkEdgeNodeCollisions, [...hSeg(y)])).toBe(0);
    expect(classifySegmentAgainstNode(hSeg(y), rectAt('n')).class).toBe('weighted');
  });

  it('Segment weit weg ⇒ kein I1 und Modell-Klasse none', () => {
    expect(violations(checkEdgeNodeCollisions, [...hSeg(500)])).toBe(0);
    expect(classifySegmentAgainstNode(hSeg(500), rectAt('n')).class).toBe('none');
  });
});

describe('I3 ⇔ Modell-Klasse weighted (Freigabe ohne Berührung)', () => {
  it('Abstand < cableClearance ⇒ I3, Treffer (hard) ist NICHT doppelt gemeldet', () => {
    const near = [...hSeg(60 + C - 1)];
    expect(violations(checkClearance, near)).toBe(1);
    expect(violations(checkEdgeNodeCollisions, near)).toBe(0);
    const hit = [...hSeg(30)];
    expect(violations(checkClearance, hit)).toBe(0);
    expect(violations(checkEdgeNodeCollisions, hit)).toBe(1);
  });

  it('Abstand exakt cableClearance ⇒ KEINE Verletzung (Modell: <, nicht ≤)', () => {
    const y = 60 + C;
    expect(violations(checkClearance, [...hSeg(y)])).toBe(0);
    expect(classifySegmentAgainstNode(hSeg(y), rectAt('n')).class).toBe('none');
  });
});

describe('I2 ⇔ Modell-Klasse hard (edge × edge, kollineare Überdeckung)', () => {
  const overlaps = (a: Point[], b: Point[]) =>
    checkEdgeEdgeOverlaps([edgeWith('a', a), edgeWith('b', b)]).length;

  it('kollineare Überlappung ⇒ I2 UND Klasse hard', () => {
    const a: Segment = [
      { x: 0, y: 10 },
      { x: 80, y: 10 },
    ];
    const b: Segment = [
      { x: 40, y: 10 },
      { x: 120, y: 10 },
    ];
    expect(overlaps([...a], [...b])).toBe(1);
    expect(classifySegmentAgainstSegment(a, b).class).toBe('hard');
  });

  it('echte Kreuzung ist soft — KEIN I2 (Preisfrage, keine Freigabefrage)', () => {
    const a: Segment = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const b: Segment = [
      { x: 50, y: -50 },
      { x: 50, y: 50 },
    ];
    expect(overlaps([...a], [...b])).toBe(0);
    expect(classifySegmentAgainstSegment(a, b).class).toBe('soft');
  });

  it('parallele Lanes innerhalb der Clearance sind weighted — kein I2', () => {
    const a: Segment = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const b: Segment = [
      { x: 0, y: C - 1 },
      { x: 100, y: C - 1 },
    ];
    expect(overlaps([...a], [...b])).toBe(0);
    expect(classifySegmentAgainstSegment(a, b).class).toBe('weighted');
  });
});
