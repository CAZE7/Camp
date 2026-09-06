import { describe, expect, it } from 'vitest';
import { LaneRegistry, compareLaneRequests, symmetricLaneIndex, type LaneRequest } from './laneRegistry';
import { ROUTING_TOKENS } from '../tokens';
import type { Segment } from '../geometry';

/**
 * WP-5 (#394): Determinismus-Tests der LaneRegistry.
 * Abnahme: Re-Layout erzeugt identische Lane-Zuordnung; kein Lane-Flip
 * bei Undo/Redo (simuliert über permutierte Anmelde-Reihenfolgen).
 */

const grid = ROUTING_TOKENS.laneGrid;

const req = (edgeId: string, topoOrder = 0, targetPosition = 0): LaneRequest => ({
  edgeId,
  topoOrder,
  targetPosition,
});

describe('3-Stufen-Sortierung', () => {
  it('Stufe 1: topologische Reihenfolge dominiert', () => {
    expect(compareLaneRequests(req('z', 0, 999), req('a', 1, -999))).toBeLessThan(0);
  });

  it('Stufe 2: Zielposition bei gleicher Topologie', () => {
    expect(compareLaneRequests(req('z', 1, 10), req('a', 1, 20))).toBeLessThan(0);
  });

  it('Stufe 3: stabile Edge-ID als letzter Tie-Breaker', () => {
    expect(compareLaneRequests(req('a', 1, 10), req('b', 1, 10))).toBeLessThan(0);
    expect(compareLaneRequests(req('b', 1, 10), req('a', 1, 10))).toBeGreaterThan(0);
    expect(compareLaneRequests(req('a', 1, 10), req('a', 1, 10))).toBe(0);
  });
});

describe('symmetrische Lane-Indizes', () => {
  it('zentriert Bündel um 0 (kompatibel zu ±0,5/±1,5-Bündel-Lanes)', () => {
    expect(symmetricLaneIndex(0, 1)).toBe(0);
    expect([symmetricLaneIndex(0, 2), symmetricLaneIndex(1, 2)]).toEqual([-0.5, 0.5]);
    expect([0, 1, 2].map((p) => symmetricLaneIndex(p, 3))).toEqual([-1, 0, 1]);
  });
});

describe('LaneRegistry', () => {
  const fill = (registry: LaneRegistry, order: LaneRequest[]): void => {
    const corridor = registry.corridorFor('horizontal', 200, 0, 500);
    for (const r of order) registry.register(corridor, r);
  };

  const requests = [req('e-bat-dist', 0, 100), req('e-dist-load1', 1, 80), req('e-dist-load2', 1, 240)];

  it('offset = laneIndex × laneGrid (Token, WP-2-Primitive)', () => {
    const registry = new LaneRegistry();
    fill(registry, requests);
    const assignments = [...registry.assign().values()][0]!;
    for (const a of assignments) expect(a.offset).toBe(a.laneIndex * grid);
    expect(assignments.map((a) => a.laneIndex)).toEqual([-1, 0, 1]);
  });

  it('Determinismus: permutierte Anmelde-Reihenfolge ⇒ identische Zuordnung (kein Lane-Flip)', () => {
    const a = new LaneRegistry();
    fill(a, requests);
    const b = new LaneRegistry();
    fill(b, [...requests].reverse());
    const c = new LaneRegistry();
    fill(c, [requests[1]!, requests[2]!, requests[0]!]);
    const snapshot = (r: LaneRegistry) => JSON.stringify([...r.assign()]);
    expect(snapshot(b)).toBe(snapshot(a));
    expect(snapshot(c)).toBe(snapshot(a));
  });

  it('Re-Registrierung derselben Kante ist idempotent (Undo/Redo-Pfad)', () => {
    const registry = new LaneRegistry();
    fill(registry, requests);
    // Undo/Redo meldet dieselben Kanten erneut an — Zuordnung bleibt identisch.
    const before = JSON.stringify([...registry.assign()]);
    fill(registry, requests);
    fill(registry, [...requests].reverse());
    expect(JSON.stringify([...registry.assign()])).toBe(before);
  });

  it('Sortierung: topoOrder vor Zielposition vor ID', () => {
    const registry = new LaneRegistry();
    fill(registry, [
      req('e-c', 1, 50), // Stufe 1: nach e-a
      req('e-b', 0, 90), // Stufe 2: nach e-a (gleiche Topo, größere Zielposition)
      req('e-a', 0, 10),
      req('e-d', 1, 50), // Stufe 3: nach e-c (ID)
    ]);
    const assignments = [...registry.assign().values()][0]!;
    expect(assignments.map((a) => a.edgeId)).toEqual(['e-a', 'e-b', 'e-c', 'e-d']);
  });

  it('corridorForSegment: Achse + Halbton-Rasterung + Spannen-Trennung', () => {
    const registry = new LaneRegistry();
    const h: Segment = [
      { x: 0, y: 203 },
      { x: 400, y: 203 },
    ];
    const corridor = registry.corridorForSegment(h)!;
    expect(corridor.direction).toBe('horizontal');
    expect(corridor.coord).toBe(200); // auf 8-px-Halbton gerastet
    // Fast gleiche Flucht (y=201, gleiche 8-px-Halbton-Zelle) ⇒ selber Korridor …
    const near = registry.corridorForSegment([
      { x: 0, y: 201 },
      { x: 400, y: 201 },
    ])!;
    expect(near.key).toBe(corridor.key);
    // … eine ganz andere Flucht nicht.
    const far = registry.corridorForSegment([
      { x: 0, y: 400 },
      { x: 400, y: 400 },
    ])!;
    expect(far.key).not.toBe(corridor.key);
    // Disjunkter Abschnitt derselben Flucht: eigener Korridor.
    const disjoint = registry.corridorForSegment([
      { x: 2000, y: 203 },
      { x: 2400, y: 203 },
    ])!;
    expect(disjoint.key).not.toBe(corridor.key);
    // Vertikal und degeneriert.
    expect(
      registry.corridorForSegment([
        { x: 100, y: 0 },
        { x: 100, y: 300 },
      ])!.direction
    ).toBe('vertical');
    expect(
      registry.corridorForSegment([
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ])
    ).toBeNull();
  });

  it('assignByEdge liefert deterministische Mehrfach-Zuordnungen', () => {
    const registry = new LaneRegistry();
    const c1 = registry.corridorFor('horizontal', 200, 0, 500);
    const c2 = registry.corridorFor('vertical', 600, 0, 400);
    registry.register(c1, req('e-1', 0, 10));
    registry.register(c2, req('e-1', 0, 10));
    registry.register(c1, req('e-2', 0, 20));
    const byEdge = registry.assignByEdge();
    expect(byEdge.get('e-1')!.map((a) => a.corridor.direction)).toEqual(['horizontal', 'vertical']);
    expect(byEdge.get('e-2')!).toHaveLength(1);
  });
});
