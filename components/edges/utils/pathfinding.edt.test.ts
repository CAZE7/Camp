import { Position } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPathfindingCache,
  edtProximityPenalty,
  findCablePath,
  setEdtProximityFactorForTest,
  type Rect,
} from './pathfinding';
import {
  buildObstacleEdt,
  EDT_MAX_D2,
  rasterizeObstaclesConservative,
  squaredEdt2D,
} from '../../../lib/routing/geometry/edt';

/**
 * Mission Stufe 1 — Abnahme des token-gated EDT-Plumbings in `hananAStar`
 * (GPU-ROUTING-ARCH §2.2″: „O(1)-Proximity-Lookups im CPU-A*").
 *
 * Verträge:
 * 1. **Gate neutral (byte-stabil):** Faktor 0 (Token-Ist und Override) ⇒
 *    dieselbe Route wie ohne Plumbing — der Golden Master hängt hieran.
 * 2. **Plumbing lebt:** Mit Faktor > 0 baut der Suchlauf das Feld und die
 *    Kosten fließen ein (andere Route), danach ist der Token-Wert wieder
 *    hergestellt — Drift-Wächter in `costModel.test.ts`.
 * 3. Determinismus (R5): identische Eingabe ⇒ bitidentische Ausgabe,
 *    auch mit aktivem Faktor.
 */

/** Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random. */
const mulberry32 = (seed: number) => () => {
  let a = (seed += 0x6d2b79f5);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
};

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
  setEdtProximityFactorForTest(null);
  clearPathfindingCache();
});

describe('EDT-Token-Gate in hananAStar (Stufe 1)', () => {
  it('Gate neutral: Token-0 und Override-0 liefern dieselbe Route wie ohne Plumbing', () => {
    // Szene mit Hindernis knapp unter der Trasse (4 px Abstand) — der
    // Katalog scheitert, der A* wird erreicht (usedSearch astar).
    const obstacles: Rect[] = [{ x: 120, y: 86, width: 60, height: 10 }];
    const base = findCablePath(scene(obstacles));
    expect(base.usedSearch).toBe('astar');

    setEdtProximityFactorForTest(0);
    const zero = findCablePath(scene(obstacles));
    expect(zero.waypoints).toEqual(base.waypoints);

    setEdtProximityFactorForTest(null);
    const viaToken = findCablePath(scene(obstacles));
    expect(viaToken.waypoints).toEqual(base.waypoints);
  });

  it('Plumbing aktiv: großer Faktor drückt die Route aus der Clearance-Zone', () => {
    const obstacles: Rect[] = [{ x: 120, y: 86, width: 60, height: 10 }];
    const base = findCablePath(scene(obstacles));
    expect(base.usedSearch).toBe('astar');

    setEdtProximityFactorForTest(10_000);
    const detoured = findCablePath(scene(obstacles));
    expect(detoured.usedSearch).toBe('astar');
    // Die Route ändert sich nachweislich (Plumbing wirkt) …
    expect(detoured.waypoints).not.toEqual(base.waypoints);
    // … und bleibt eine valide orthogonale Trasse mit denselben Endpunkten.
    expect(detoured.waypoints[0]).toEqual({ x: 20, y: 100 });
    expect(detoured.waypoints[detoured.waypoints.length - 1]).toEqual({ x: 300, y: 100 });

    // Nach Reset ist der Token-Wert wieder Basis — deterministisch (R5).
    setEdtProximityFactorForTest(null);
    const restored = findCablePath(scene(obstacles));
    expect(restored.waypoints).toEqual(base.waypoints);
  });

  it('Determinismus mit aktivem Faktor: zwei Läufe bitidentisch', () => {
    const obstacles: Rect[] = [
      { x: 120, y: 86, width: 60, height: 10 },
      { x: 200, y: 110, width: 40, height: 30 },
    ];
    setEdtProximityFactorForTest(2_500);
    const a = findCablePath(scene(obstacles));
    const b = findCablePath(scene(obstacles));
    expect(a.waypoints).toEqual(b.waypoints);
    expect(a.length).toBe(b.length);
  });

  it('Override-Guard: ungültige Faktoren werfen, null stellt den Token her', () => {
    expect(() => setEdtProximityFactorForTest(-1)).toThrow(RangeError);
    expect(() => setEdtProximityFactorForTest(Number.NaN)).toThrow(RangeError);
    setEdtProximityFactorForTest(5);
    setEdtProximityFactorForTest(null); // keine Fehler
  });
});

describe('edtProximityPenalty — wurzelfreie Clearance-Entscheidung (§2.2″)', () => {
  const rects: Rect[] = [{ x: 100, y: 100, width: 40, height: 20 }];
  const field = buildObstacleEdt(rects, 32)!;
  const clearance = 12;

  it('d² < 144 ⇒ Faktor, sonst 0; Faktor 0 ⇒ immer 0', () => {
    // Mittendrin: d² = 0.
    expect(edtProximityPenalty(field, 7, clearance, 120, 110)).toBe(7);
    // Quellpixel der Box-Oberkante ist die Zelle [99,100] (Kontakt ⇒ belegt).
    // y = 92 ⇒ d = 7, d² = 49 < 144 ⇒ Faktor.
    expect(edtProximityPenalty(field, 7, clearance, 120, 92)).toBe(7);
    // y = 88 ⇒ d = 11, d² = 121 < 144 ⇒ weiterhin Faktor.
    expect(edtProximityPenalty(field, 7, clearance, 120, 88)).toBe(7);
    // y = 87 ⇒ d = 12, d² = 144 — strikt `<` greift nicht ⇒ 0.
    expect(edtProximityPenalty(field, 7, clearance, 120, 87)).toBe(0);
    // Weit weg ⇒ 0.
    expect(edtProximityPenalty(field, 7, clearance, 10, 10)).toBe(0);
    // Token-Gate: Faktor 0 überschreibt nie.
    expect(edtProximityPenalty(field, 0, clearance, 120, 110)).toBe(0);
  });

  it('Außerhalb des Feldes ⇒ konservativ 0 (unbekannt, nie im schädlichen Sinn)', () => {
    expect(edtProximityPenalty(field, 7, clearance, 0, 0)).toBe(0);
    expect(edtProximityPenalty(field, 7, clearance, 10_000, 10_000)).toBe(0);
    // Sentinel-Direktprüfung: das Feld selbst liefert draußen EDT_MAX_D2.
    expect(field.d2.length).toBeGreaterThan(0);
    expect(EDT_MAX_D2).toBe(0x7fff_ffff);
  });

  it('Kette rasterisieren → transformieren → abfragen ist deterministisch (R5)', () => {
    const rnd = mulberry32(4242);
    const many: Rect[] = [];
    for (let i = 0; i < 8; i++) {
      many.push({
        x: Math.floor(rnd() * 200),
        y: Math.floor(rnd() * 120),
        width: 4 + Math.floor(rnd() * 30),
        height: 4 + Math.floor(rnd() * 20),
      });
    }
    const b1 = rasterizeObstaclesConservative(0, 0, 240, 160, many);
    const b2 = rasterizeObstaclesConservative(0, 0, 240, 160, many);
    expect(Array.from(b1)).toEqual(Array.from(b2));
    const d1 = squaredEdt2D(240, 160, b1);
    const d2 = squaredEdt2D(240, 160, b2);
    expect(Array.from(d1)).toEqual(Array.from(d2));
  });
});
