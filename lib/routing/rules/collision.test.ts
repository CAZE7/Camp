import { describe, expect, it } from 'vitest';
import {
  buildDomainSeparationRules,
  classifyCollision,
  classifyDomainAwareSegments,
  classifySegmentAgainstNode,
  classifySegmentAgainstSegment,
  domainSeparationRules,
  requiredClearanceBetween,
} from './collision';
import { ROUTING_TOKENS } from '../tokens';
import type { Rect, Segment } from '../geometry';

/**
 * WP-3 (#391): Unit-Tests für jede Kollisionsklasse und Kombination.
 * Kernregel (ADR 0009): Overlap = hard, Crossing = soft,
 * Clearance = weighted, sonst none. Prüf-Reihenfolge ist Vertrag:
 * hard > soft > weighted.
 */

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

const node: Rect = { x: 100, y: 100, width: 192, height: 120 };
const clearance = ROUTING_TOKENS.cableClearance;

describe('Edge × Node', () => {
  it('Segment durch die Box ⇒ hard/edge-node', () => {
    const hit = classifySegmentAgainstNode(seg(0, 160, 400, 160), node);
    expect(hit).toEqual({ class: 'hard', kind: 'edge-node' });
  });

  it('Segment innerhalb der Clearance ⇒ weighted mit Distanz', () => {
    // 6 px oberhalb der Box (y = 94), Clearance 12.
    const near = classifySegmentAgainstNode(seg(0, 94, 400, 94), node);
    expect(near.class).toBe('weighted');
    expect(near.kind).toBe('clearance');
    expect(near.distance).toBeCloseTo(6);
    expect(near.requiredClearance).toBe(clearance);
  });

  it('Segment außerhalb der Clearance ⇒ none', () => {
    const free = classifySegmentAgainstNode(seg(0, 50, 400, 50), node);
    expect(free).toEqual({ class: 'none', kind: 'none' });
  });

  it('Tangente exakt auf der Boxkante ist kein hard, aber weighted (Abstand 0)', () => {
    const touch = classifySegmentAgainstNode(seg(0, 100, 400, 100), node);
    expect(touch.class).toBe('weighted');
    expect(touch.distance).toBe(0);
  });
});

describe('Edge × Edge', () => {
  it('kollineare Überlappung ⇒ hard/edge-edge-overlap', () => {
    const r = classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(50, 0, 150, 0));
    expect(r).toEqual({ class: 'hard', kind: 'edge-edge-overlap' });
  });

  it('echte Kreuzung ⇒ soft/edge-edge-crossing', () => {
    const r = classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(50, -50, 50, 50));
    expect(r).toEqual({ class: 'soft', kind: 'edge-edge-crossing' });
  });

  it('Touch (Endpunkt auf fremdem Segment) ⇒ weighted, NICHT hard/soft', () => {
    const r = classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(50, 0, 50, 50));
    expect(r.class).toBe('weighted');
    expect(r.kind).toBe('clearance');
    expect(r.distance).toBe(0);
  });

  it('parallel innerhalb der Clearance ⇒ weighted mit Distanz', () => {
    const r = classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(0, 8, 100, 8));
    expect(r.class).toBe('weighted');
    expect(r.distance).toBeCloseTo(8);
  });

  it('parallel auf Lane-Abstand (16 ≥ 12) ⇒ none', () => {
    const r = classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(0, 16, 100, 16));
    expect(r).toEqual({ class: 'none', kind: 'none' });
  });

  it('Prüf-Reihenfolge: Overlap gewinnt gegen alles', () => {
    // Identische Segmente: kollinear + intersect — muss hard sein.
    const r = classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(0, 0, 100, 0));
    expect(r.class).toBe('hard');
    expect(r.kind).toBe('edge-edge-overlap');
  });

  it('Ende-an-Ende kollinear (Punktberührung) ist kein Overlap ⇒ weighted', () => {
    const r = classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(100, 0, 200, 0));
    expect(r.class).toBe('weighted');
    expect(r.distance).toBe(0);
  });
});

describe('classifyCollision (gemeinsamer Einstiegspunkt beider Pässe)', () => {
  it('dispatcht edge-node und edge-edge identisch zu den Spezialfunktionen', () => {
    expect(classifyCollision({ type: 'edge-node', segment: seg(0, 160, 400, 160), obstacle: node })).toEqual(
      classifySegmentAgainstNode(seg(0, 160, 400, 160), node)
    );
    expect(classifyCollision({ type: 'edge-edge', a: seg(0, 0, 100, 0), b: seg(50, -50, 50, 50) })).toEqual(
      classifySegmentAgainstSegment(seg(0, 0, 100, 0), seg(50, -50, 50, 50))
    );
  });

  it('akzeptiert eine abweichende Clearance (Domain Rules)', () => {
    // 20 px Abstand: mit Basis-Clearance 12 ⇒ none, mit Domänen-Clearance 24 ⇒ weighted.
    const a = seg(0, 0, 100, 0);
    const b = seg(0, 20, 100, 20);
    expect(classifyCollision({ type: 'edge-edge', a, b }).class).toBe('none');
    expect(classifyCollision({ type: 'edge-edge', a, b, clearance: 24 }).class).toBe('weighted');
  });
});

describe('Domain Rules (Schicht 3)', () => {
  it('Paar-Regeln kommen aus dem Token crossDomainSpacing', () => {
    expect(domainSeparationRules.electrical?.water?.minimumClearance).toBe(ROUTING_TOKENS.crossDomainSpacing);
    expect(domainSeparationRules.ac230?.dc12?.minimumClearance).toBe(ROUTING_TOKENS.crossDomainSpacing);
    // Generator folgt anderen Token-Werten (kein Hardcode).
    const custom = buildDomainSeparationRules({ ...ROUTING_TOKENS, crossDomainSpacing: 40 });
    expect(custom.electrical?.water?.minimumClearance).toBe(40);
  });

  it('requiredClearanceBetween: symmetrisch, Fallback auf Basis-Clearance', () => {
    expect(requiredClearanceBetween('electrical', 'water')).toBe(ROUTING_TOKENS.crossDomainSpacing);
    expect(requiredClearanceBetween('water', 'electrical')).toBe(ROUTING_TOKENS.crossDomainSpacing);
    expect(requiredClearanceBetween('ac230', 'dc12')).toBe(ROUTING_TOKENS.crossDomainSpacing);
    // Gleiche Domäne: nur Basis-Clearance.
    expect(requiredClearanceBetween('electrical', 'electrical')).toBe(ROUTING_TOKENS.cableClearance);
    expect(requiredClearanceBetween('water', 'water')).toBe(ROUTING_TOKENS.cableClearance);
  });

  it('Unterdomänen erben die electrical↔water-Regel', () => {
    expect(requiredClearanceBetween('dc12', 'water')).toBe(ROUTING_TOKENS.crossDomainSpacing);
    expect(requiredClearanceBetween('water', 'ac230')).toBe(ROUTING_TOKENS.crossDomainSpacing);
  });

  it('classifyDomainAwareSegments nutzt die Paar-Clearance', () => {
    // 20 px Abstand: innerhalb 24 (electrical↔water) ⇒ weighted;
    // gleiche Domäne (12) ⇒ none.
    const a = { segment: seg(0, 0, 100, 0), domain: 'electrical' as const };
    const w = { segment: seg(0, 20, 100, 20), domain: 'water' as const };
    const e2 = { segment: seg(0, 20, 100, 20), domain: 'electrical' as const };
    const crossDomain = classifyDomainAwareSegments(a, w);
    expect(crossDomain.class).toBe('weighted');
    expect(crossDomain.requiredClearance).toBe(ROUTING_TOKENS.crossDomainSpacing);
    expect(classifyDomainAwareSegments(a, e2).class).toBe('none');
  });

  it('hard bleibt hard — Domänenregeln ändern Overlap/Crossing nicht', () => {
    const a = { segment: seg(0, 0, 100, 0), domain: 'electrical' as const };
    const overlapping = { segment: seg(50, 0, 150, 0), domain: 'water' as const };
    const crossing = { segment: seg(50, -50, 50, 50), domain: 'water' as const };
    expect(classifyDomainAwareSegments(a, overlapping).class).toBe('hard');
    expect(classifyDomainAwareSegments(a, crossing).class).toBe('soft');
  });
});
