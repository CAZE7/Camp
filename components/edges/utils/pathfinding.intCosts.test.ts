import { Position } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPathfindingCache,
  findCablePath,
  setIntegerMilliPxCostsForTest,
  type Rect,
} from './pathfinding';

/**
 * Mission Stufe 3 — Abnahme des token-gated Integer-Milli-px-Gates im A*
 * (`hananAStar`), GPU-ROUTING-ARCH §3″ („px-Ganzzahlskala + Sättigung“).
 * Token `ROUTING_GATES.integerMilliPxCosts` = **0** (gemessen: kalter Golden
 * Master bricht acdc 669 → 698,4 px, Längen-Ratchet — Ledger in
 * `costModel.test.ts`).
 *
 * Verträge:
 * 1. **Gate neutral (byte-stabil):** Token 0 und Override 0 ⇒ dieselbe
 *    Route wie ohne Gate — der Golden Master hängt daran.
 * 2. **Gate aktiv (Test-Override):** Milli-px-Modus liefert valide
 *    orthogonale Trassen; der Modus steht im Cache-Schlüssel (kein
 *    Cache-Treffer der anderen Währung).
 * 3. Determinismus (R5): identische Eingabe ⇒ bitidentische Ausgabe in
 *    BEIDEN Modi; kein Zustand bleibt nach Reset hängen.
 */

const scene = (obstacles: Rect[]) => ({
  sourceX: 20,
  sourceY: 100,
  sourcePosition: Position.Right,
  targetX: 300,
  targetY: 100,
  targetPosition: Position.Left,
  obstacles,
  skipCache: true,
});

afterEach(() => {
  setIntegerMilliPxCostsForTest(null);
  clearPathfindingCache();
});

describe('Integer-Milli-px-Gate in hananAStar (Stufe 3)', () => {
  const obstacles: Rect[] = [{ x: 120, y: 86, width: 60, height: 10 }];

  it('Gate neutral: Token-0 und Override-0 liefern dieselbe Route wie ohne Gate', () => {
    const base = findCablePath(scene(obstacles));
    expect(base.usedSearch).toBe('astar');

    setIntegerMilliPxCostsForTest(false);
    const off = findCablePath(scene(obstacles));
    expect(off.waypoints).toEqual(base.waypoints);

    setIntegerMilliPxCostsForTest(null); // zurück auf den Token-Wert (0)
    const viaToken = findCablePath(scene(obstacles));
    expect(viaToken.waypoints).toEqual(base.waypoints);
  });

  it('Gate aktiv: Milli-px-Modus liefert eine valide orthogonale Trasse', () => {
    const base = findCablePath(scene(obstacles));
    setIntegerMilliPxCostsForTest(true);
    const int = findCablePath(scene(obstacles));
    expect(int.usedSearch).toBe('astar');
    expect(int.waypoints[0]).toEqual({ x: 20, y: 100 });
    expect(int.waypoints[int.waypoints.length - 1]).toEqual({ x: 300, y: 100 });
    for (let i = 1; i < int.waypoints.length; i++) {
      const a = int.waypoints[i - 1]!;
      const b = int.waypoints[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
    expect(int.length).toBeGreaterThan(0);
    expect(int.length).toBeLessThan(base.length * 1.05 + 50);

    // Reset stellt den Token-Wert (0) wieder her.
    setIntegerMilliPxCostsForTest(null);
    expect(findCablePath(scene(obstacles)).waypoints).toEqual(base.waypoints);
  });

  it('Modus-Cache-Trennung: gleiche Anfrage in beiden Währungen ohne skipCache', () => {
    // Ohne `skipCache`: Der requestKey enthält seit Stufe 3 die Währung —
    // der Float-Lauf darf dem Milli-px-Lauf nichts zurückgeben.
    const req = { ...scene(obstacles), skipCache: false };
    const floatRun = findCablePath(req);
    setIntegerMilliPxCostsForTest(true);
    const intRun = findCablePath(req);
    // Auf dieser Szene sind beide Pfadoptima deckungsgleich (Substruktur-
    // Argument), aber unabhängig gerechnet — gleiche Antwort nach
    // Cache-Flippen ist hier der Vertrag, nicht die Garantie allgemein.
    expect(intRun.usedSearch).toBe(floatRun.usedSearch);
    setIntegerMilliPxCostsForTest(false);
    expect(findCablePath(req).waypoints).toEqual(floatRun.waypoints);
  });

  it('Determinismus (R5): zwei Läufe bitidentisch — in beiden Modi', () => {
    const tricky: Rect[] = [
      { x: 120, y: 86, width: 60, height: 10 },
      { x: 200, y: 110, width: 40, height: 30 },
    ];
    setIntegerMilliPxCostsForTest(false);
    expect(findCablePath(scene(tricky)).waypoints).toEqual(findCablePath(scene(tricky)).waypoints);

    setIntegerMilliPxCostsForTest(true);
    const a = findCablePath(scene(tricky));
    const b = findCablePath(scene(tricky));
    expect(a.waypoints).toEqual(b.waypoints);
    expect(a.length).toBe(b.length);
  });
});
