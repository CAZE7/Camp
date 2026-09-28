import { beforeAll, describe, expect, it } from 'vitest';
import { auditShiftMatrix, SHIFT_RATCHET, SHIFT_OFFSETS, shiftPlan, type ShiftMatrixEntry } from './audit';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

/**
 * Versatz-Gate (P0-Befund 2026-09-28) — gemessen auf dem Produktivpfad
 * (`performAutoWiring → routeAllCables`), nicht über `routingQuality.ts`.
 *
 * Warum es dieses Gate gibt: `routing:audit` und `finalValidation.test.ts`
 * messen nur die eingefrorenen Referenzpositionen. Verschiebt der Nutzer
 * seinen Plan, rastet die AutoWire-Platzierung (`flowAnchor`) auf eine andere
 * Rasterzeile — und ein Teil der so entstehenden Konfigurationen war für den
 * Router nicht lösbar. Der Notfallpfad lief dann durch fremde Bauteile.
 * Gemessen über die 7×7-Matrix der sechs Referenzpläne (294 Läufe), vor der
 * Platzierungs-Korrektur:
 *
 *   51 Läufe hart verletzt (I1 30, I2 53, I3 44), davon 20 Notfallpfade
 *
 * Nach der Korrektur von `NODE_MIN_GAP` (`lib/autoWire/placement.ts` — dort
 * steht die Messung) gilt: kein Notfallpfad, kein I1. Was bleibt, sind
 * Trassenkollisionen verschobener Bündel (I2) und über `SHIFT_RATCHET`
 * festgehalten — dieselbe Logik wie bei den Referenzpositionen: hart, wo es
 * hart sein kann; Ratchet, wo eine Verbesserung ein Ratchet-Nachziehen
 * erzwingt (der letzte Test schlägt sonst an).
 */
let matrix: ShiftMatrixEntry[] = [];

beforeAll(() => {
  matrix = auditShiftMatrix();
}, 120_000);

describe('Versatz-Gate: reine Plan-Translation (Produktivpfad)', () => {
  it(`Matrix vollständig (${SHIFT_OFFSETS.length}² Versätze je Plan)`, () => {
    expect(matrix.map((entry) => entry.plan)).toEqual(Object.keys(GOLDEN_PLANS));
    for (const entry of matrix) {
      expect(entry.runs, entry.plan).toBe(SHIFT_OFFSETS.length ** 2);
    }
  });

  it('kein Notfallpfad und kein I1 — über alle Pläne und Versätze', () => {
    const broken = matrix
      .filter((entry) => entry.fallbacks > 0 || entry.I1 > 0)
      .map((entry) => `${entry.plan}: Notfallpfade=${entry.fallbacks}, I1=${entry.I1}`);
    expect(
      broken,
      `Der Router weicht bei verschobenen Plänen aus (Leitung durch ein Bauteil):\n${broken.join('\n')}`
    ).toEqual([]);
  });

  it('I2/I3 bleiben innerhalb der Ratchet', () => {
    const over = matrix
      .filter((entry) => {
        const ratchet = SHIFT_RATCHET[entry.plan]!;
        return entry.I2 > ratchet.I2 || entry.I3 > ratchet.I3;
      })
      .map((entry) => `${entry.plan}: I2=${entry.I2}, I3=${entry.I3}`);
    expect(over, `Versatz-Gate über der Ratchet:\n${over.join('\n')}`).toEqual([]);
  });

  it('Ratchet ist nicht zu locker (Verbesserungen müssen nachgezogen werden)', () => {
    const better = matrix
      .filter((entry) => {
        const ratchet = SHIFT_RATCHET[entry.plan]!;
        return entry.I2 < ratchet.I2 || entry.I3 < ratchet.I3;
      })
      .map((entry) => `${entry.plan}: I2=${entry.I2}, I3=${entry.I3}`);
    expect(
      better,
      `Unter der Ratchet — bitte SHIFT_RATCHET in scripts/routing/audit.ts nachziehen: ${better.join(', ')}`
    ).toEqual([]);
  });

  it('shiftPlan verschiebt alle Knoten und lässt die Eingabe unberührt', () => {
    const base = GOLDEN_PLANS.simple!;
    const before = base.nodes[0]!.position;
    const moved = shiftPlan(base, -400, 16);
    expect(moved.nodes.length).toBe(base.nodes.length);
    expect(moved.nodes[0]!.position).toEqual({ x: before.x - 400, y: before.y + 16 });
    expect(base.nodes[0]!.position).toEqual(before);
  });
});
