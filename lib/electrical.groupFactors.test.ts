import { describe, expect, it } from 'vitest';
import {
  classifyVoltageDropPercent,
  DERATE_FACTOR,
  designAmpacity,
  groupFactor,
  VDE_AMPACITY,
  VDE_GROUP_FACTORS,
  VDE_GROUP_FACTORS_MAX_N,
  VDE_SIZES,
  VOLTAGE_DROP_PCT_CRITICAL,
  VOLTAGE_DROP_PCT_PLAN_LIMIT,
  VOLTAGE_DROP_PCT_TARGET,
} from './electrical';

/**
 * Mission Stufe 2 — Abnahme der Häufungsfaktoren (L1) und der ΔU-Stufen.
 *
 * Wächter:
 *  - Tabelle eingefroren mit Zitatbeleg (Quellen stehen in `electrical.ts`);
 *  - n > 9 ⇒ Fehler (Mission „n>9 error", Regel M — kein Schätzwert);
 *  - PRODUKTIV-Belastbarkeit byte-stabil: 1-Argument bleibt × 0,7
 *    („nie optimistischer als 0,7 ohne Recapture");
 *  - ΔU-Stufen 1/3/4 % an den Produktiv-Grenzwert gekoppelt (> 3 % = Fehler
 *    wie `hasVoltageDropError`).
 */

describe('VDE_GROUP_FACTORS — Zitattranskription n = 1…9 (MISSION Stufe 2)', () => {
  it('Tabelle ist eingefroren und exakt die Zitatzeile (Q1 electrical-installation.org G16, Q2 elekrechner.com)', () => {
    expect(Object.isFrozen(VDE_GROUP_FACTORS)).toBe(true);
    expect(VDE_GROUP_FACTORS).toEqual({
      1: 1.0,
      2: 0.8,
      3: 0.7,
      4: 0.65,
      5: 0.6,
      6: 0.57,
      7: 0.54,
      8: 0.52,
      9: 0.5,
    });
    expect(VDE_GROUP_FACTORS_MAX_N).toBe(9);
  });

  it('k_B(3) = 0,7 deckt sich mit der Pauschale — Sync-Anker zum Ist-Derating', () => {
    expect(groupFactor(3)).toBe(DERATE_FACTOR);
  });

  it('Monotonie: mehr Stromkreise ⇒ nie größerer Faktor', () => {
    for (let n = 1; n < VDE_GROUP_FACTORS_MAX_N; n++) {
      expect(groupFactor(n + 1)).toBeLessThanOrEqual(groupFactor(n));
    }
  });

  it('n > 9 wirft (Tabelle endet — Mission: Fehler statt Schätzung)', () => {
    expect(() => groupFactor(10)).toThrow(RangeError);
    expect(() => groupFactor(100)).toThrow(RangeError);
    expect(() => groupFactor(10)).toThrow(/n = 10/);
  });

  it('ungültige Eingaben werfen, nie ein stilles Default (Regel M)', () => {
    expect(() => groupFactor(0)).toThrow(RangeError);
    expect(() => groupFactor(-1)).toThrow(RangeError);
    expect(() => groupFactor(1.5)).toThrow(RangeError);
    expect(() => groupFactor(Number.NaN)).toThrow(RangeError);
  });
});

describe('designAmpacity — Produktivpfad byte-stabil, 2. Argument Evaluierung', () => {
  it('1-Argument bleibt exakt Tabellenwert × 0,7 (Drift-Guard ELE-001/L1)', () => {
    for (const cs of VDE_SIZES) {
      expect(designAmpacity(cs)).toBe((VDE_AMPACITY[cs] ?? 0) * DERATE_FACTOR);
    }
    expect(designAmpacity(2.5)).toBeCloseTo(16.1, 10);
  });

  it('2-Argument n = 3 ist wertgleich zur Pauschale (k_B(3) = 0,7)', () => {
    for (const cs of VDE_SIZES) {
      expect(designAmpacity(cs, 3)).toBe(designAmpacity(cs));
    }
  });

  it('2-Argument n ≤ 2 kann optimistischer liegen — dokumentierte Grenze (Recapture nötig)', () => {
    // Diese Tests PINNEN die Warnung: wer ohne Recapture auf die Tabelle
    // umstellt, wird hier und im L1-Guard der Spec erwischt.
    expect(designAmpacity(2.5, 2)).toBeGreaterThan(designAmpacity(2.5));
    expect(designAmpacity(2.5, 1)).toBeGreaterThan(designAmpacity(2.5));
  });

  it('unbekannter Querschnitt ⇒ 0 (beide Varianten, kein stiller Ersatzwert)', () => {
    expect(designAmpacity(3.0)).toBe(0);
    expect(designAmpacity(3.0, 4)).toBe(0);
  });

  it('n > 9 wirft auch über designAmpacity', () => {
    expect(() => designAmpacity(2.5, 10)).toThrow(RangeError);
  });
});

describe('ΔU %-Stufen 1/3/4 (MISSION Stufe 2)', () => {
  it('Schwellen eingefroren', () => {
    expect(VOLTAGE_DROP_PCT_TARGET).toBe(1);
    expect(VOLTAGE_DROP_PCT_PLAN_LIMIT).toBe(3);
    expect(VOLTAGE_DROP_PCT_CRITICAL).toBe(4);
  });

  it('Bandgrenzen exakt an den Stufen (inkl. Kantenwerte)', () => {
    expect(classifyVoltageDropPercent(0)).toBe('ziel');
    expect(classifyVoltageDropPercent(1)).toBe('ziel');
    expect(classifyVoltageDropPercent(1.0001)).toBe('planungsgrenze');
    expect(classifyVoltageDropPercent(3)).toBe('planungsgrenze');
    // Produktivverdict: Fehler erst strikt > 3 % (hasVoltageDropError) —
    // die Bandeinteilung bleibt kantenkonsistent.
    expect(classifyVoltageDropPercent(3.0001)).toBe('verstoss');
    expect(classifyVoltageDropPercent(4)).toBe('verstoss');
    expect(classifyVoltageDropPercent(4.0001)).toBe('kritisch');
    expect(classifyVoltageDropPercent(12.5)).toBe('kritisch');
  });

  it('ungültige Eingaben werfen statt still „ziel" (Regel M)', () => {
    expect(() => classifyVoltageDropPercent(Number.NaN)).toThrow(RangeError);
    expect(() => classifyVoltageDropPercent(-0.1)).toThrow(RangeError);
    expect(() => classifyVoltageDropPercent(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
