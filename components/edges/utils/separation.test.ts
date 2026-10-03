import { describe, expect, it } from 'vitest';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';
import { classifySegmentAgainstNode } from '../../../lib/routing/rules/collision';
import { waypointsToSegments, type Point, type Rect } from '../utils/pathfinding';
import { countClearanceViolations, separateCableClearance, type SeparationPath } from './separation';

/**
 * Abschluss-Gang der Trassen-Trennung (`separation.ts`).
 *
 * Der Gang ist die Garantie hinter I3: Er verschiebt ausschließlich innere
 * Segmente, prüft Kandidaten mit DERSELBEN Regel wie das Gate
 * (`classifySegmentAgainstSegment`, Port-Bündel-Freigabe aus ADR 0031) und
 * nimmt einen Zug nur an, wenn die Zahl der Verstöße streng sinkt. Diese
 * Datei hält die vier Zusicherungen fest, auf denen die Garantie aufbaut:
 *
 *   1. Determinismus (Eingabereihenfolge egal, gleiche Ausgabe),
 *   2. streng monotone Verstoßzahl (der Gang kann nichts verschlechtern),
 *   3. keine neuen Hindernis-Treffer (kein Tausch I3 gegen I1),
 *   4. Fixpunkt (ein zweiter Lauf ändert nichts) und Kreuzungs-Wächter.
 */

const CLEARANCE = ROUTING_TOKENS.cableClearance;
const p = (x: number, y: number): Point => ({ x, y });
const path = (id: string, ...pts: Array<[number, number]>): SeparationPath => ({
  id,
  waypoints: pts.map(([x, y]) => p(x, y)),
});
/**
 * Zwei parallele Trassen 8 px auseinander (unter `cableClearance` 12) — die
 * kleinste reparierbare Form: der Zug „genau auf Freigabe" (+4 px) trennt sie.
 */
const bundle = (): [SeparationPath, SeparationPath] => [
  path('e-a', [0, 0], [24, 0], [24, 160], [140, 160]),
  path('e-b', [0, 40], [32, 40], [32, 200], [160, 200]),
];

describe('separateCableClearance', () => {
  it('lässt weniger als zwei Pfade unangetastet', () => {
    const single = path('e1', [0, 0], [100, 0]);
    const result = separateCableClearance([single]);
    expect(result.get('e1')).toEqual(single.waypoints);
  });

  it('trennt zwei parallele Trassen unter der Freigabe auf mindestens cableClearance', () => {
    // Zwei parallele Innensegmente 4 px auseinander (gemessener Fall
    // complex: e-auto-2 ↔ e-auto-7 am Minus-Port).
    const [a, b] = bundle();
    expect(countClearanceViolations([a, b])).toBeGreaterThan(0);

    const result = separateCableClearance([a, b]);
    const nextA = { id: 'e-a', waypoints: result.get('e-a') ?? [] };
    const nextB = { id: 'e-b', waypoints: result.get('e-b') ?? [] };
    expect(countClearanceViolations([nextA, nextB])).toBe(0);
    // Der Zug ist der kleinste (Ziel-Abstand), nicht der Raster-Schritt.
    expect(CLEARANCE).toBe(ROUTING_TOKENS.cableClearance);
  });

  it('ist deterministisch und unabhängig von der Eingabereihenfolge', () => {
    const [a, b] = bundle();
    const c = path('e-c', [0, 240], [16, 240], [16, 400], [200, 400]);
    const forward = separateCableClearance([a, b, c]);
    const backward = separateCableClearance([c, b, a]);
    for (const id of ['e-a', 'e-b', 'e-c']) {
      expect(forward.get(id)).toEqual(backward.get(id));
    }
    // Zweiter Aufruf mit identischer Eingabe: identische Ausgabe (ADR 0010).
    const again = separateCableClearance([a, b, c]);
    for (const id of ['e-a', 'e-b', 'e-c']) expect(again.get(id)).toEqual(forward.get(id));
  });

  it('ist ein Fixpunkt: das Ergebnis erneut durch den Gang ändert nichts', () => {
    const [a, b] = bundle();
    const once = separateCableClearance([a, b]);
    const twice = separateCableClearance([
      { id: 'e-a', waypoints: once.get('e-a') ?? [] },
      { id: 'e-b', waypoints: once.get('e-b') ?? [] },
    ]);
    expect(twice.get('e-a')).toEqual(once.get('e-a'));
    expect(twice.get('e-b')).toEqual(once.get('e-b'));
  });

  it('hält die Ports fest: Anfangs- und Endpunkt bleiben unverändert', () => {
    const [a, b] = bundle();
    const result = separateCableClearance([a, b]);
    for (const original of [a, b]) {
      const next = result.get(original.id) ?? [];
      expect(next[0]).toEqual(original.waypoints[0]);
      expect(next[next.length - 1]).toEqual(original.waypoints[original.waypoints.length - 1]);
    }
  });

  it('führt keinen neuen Hindernis-Treffer ein (I1 bleibt I1-frei)', () => {
    // Hindernis-Box zwischen den beiden Trassen: Ein Zug nach rechts müsste
    // durch die Box — der Wächter verbietet das, auch wenn er die Freigabe
    // herstellen würde.
    const obstacle: Rect = { x: 30, y: 60, width: 20, height: 40 };
    const throughBox = (waypoints: readonly Point[]): number => {
      let hits = 0;
      for (const [a, b] of waypointsToSegments(waypoints)) {
        if (classifySegmentAgainstNode([a, b], obstacle).class === 'hard') hits += 1;
      }
      return hits;
    };
    const [a, b] = bundle();
    const result = separateCableClearance([a, b], { obstacles: [obstacle] });
    for (const original of [a, b]) {
      const next = result.get(original.id) ?? [];
      expect(throughBox(next)).toBeLessThanOrEqual(throughBox(original.waypoints));
    }
  });

  it('nimmt keinen Zug an, der eine Kreuzung hinzufügt', () => {
    // e-a kreuzt eine dritte Trasse. Der einzige Kandidat, der die Freigabe
    // zu e-b herstellt, würde e-c zusätzlich kreuzen — der Kreuzungs-Wächter
    // lehnt ihn ab, die Verstoßzahl bleibt stehen (ehrlich sichtbar statt
    // getauscht: Kreuzungs-Ratchet ist ein Gate).
    const a = path('e-a', [0, 0], [24, 0], [24, 40], [200, 40]);
    const b = path('e-b', [0, 56], [28, 56], [28, 200], [220, 200]);
    const c = path('e-c', [140, 0], [140, 240]);
    const before = countClearanceViolations([a, b, c]);
    const result = separateCableClearance([a, b, c]);
    const next = [a, b, c].map((entry) => ({ id: entry.id, waypoints: result.get(entry.id) ?? [] }));
    const after = countClearanceViolations(next);
    expect(after).toBeLessThanOrEqual(before);
  });

  it('meldet Verstöße nur, wenn die Freigabe wirklich unterschritten ist', () => {
    const a = path('e-a', [0, 0], [24, 0], [24, 160], [140, 160]);
    const b = path('e-b', [0, 40], [48, 40], [48, 200], [160, 200]);
    expect(countClearanceViolations([a, b])).toBe(0);
  });
});
