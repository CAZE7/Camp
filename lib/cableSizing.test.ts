import { describe, expect, it } from 'vitest';

import {
  MAX_STANDARD_CROSS_SECTION_MM2,
  maxCurrentForPlanLimit,
  sizeCable,
  thermalCurrentFor,
  voltageDropFor,
} from './cableSizing';

/**
 * Die Erwartungswerte sind von Hand aus den veröffentlichten Formeln
 * nachgerechnet (A = I · 2L / (κ · ΔU) mit κ = 58 m/(Ω·mm²) und
 * ΔU = 0,36 V) — nicht aus der Implementierung abgeschrieben.
 */
describe('sizeCable', () => {
  it('dimensioniert nach dem Spannungsfall, wenn dieser das Maximum ist', () => {
    // A = (10 A · 2 · 5 m) / (58 · 0,36 V) = 100 / 20,88 = 4,79 mm² → 6 mm²
    const result = sizeCable(10, 5);

    expect(result.requiredCrossSectionMm2).toBeCloseTo(4.7893, 4);
    expect(result.crossSectionMm2).toBe(6);
    expect(result.criterion).toBe('voltageDrop');
    expect(result.exceedsStandardRange).toBe(false);
    // ΔU bei 6 mm²: 100 / (58 · 6) = 0,287 V = 2,39 %
    expect(result.voltageDropV).toBeCloseTo(0.28736, 5);
    expect(result.voltageDropPercent).toBeCloseTo(2.3946, 4);
    // Kabelgrenze 6 mm²: 38 A × 0,7 = 26,6 A → größte Normsicherung 25 A
    expect(result.maxFuseA).toBe(25);
    expect(result.fuseA).toBe(10);
  });

  it('dimensioniert nach der Strombelastbarkeit, wenn diese das Maximum ist', () => {
    // Spannungsfall fordert 30 · 1 / 20,88 = 1,44 mm², thermisch 30 / 0,7 = 42,9 A → 10 mm²
    const result = sizeCable(30, 0.5);

    expect(result.crossSectionMm2).toBe(10);
    expect(result.criterion).toBe('ampacity');
    // ΔU bei 10 mm²: 30 / (58 · 10) = 0,0517 V = 0,43 %
    expect(result.voltageDropPercent).toBeCloseTo(0.431, 4);
    // 10 mm²: 52 A × 0,7 = 36,4 A → größte Normsicherung 32 A
    expect(result.maxFuseA).toBe(32);
    expect(result.fuseA).toBe(30);
  });

  it('fällt auf das Norm-Minimum zurück, wenn kein Kriterium darüber liegt', () => {
    const result = sizeCable(2, 0.5);

    expect(result.crossSectionMm2).toBe(1.5);
    expect(result.criterion).toBe('standardMinimum');
    expect(result.maxFuseA).toBe(10);
    expect(result.fuseA).toBe(5);
  });

  it('meldet den Überlauf der Normreihe, statt einen ungeprüften Wert auszuweisen', () => {
    // 200 A über 10 m: A = 4000 / 20,88 = 191,6 mm² — das ist jenseits von 70 mm².
    const result = sizeCable(200, 10);

    expect(result.requiredCrossSectionMm2).toBeGreaterThan(MAX_STANDARD_CROSS_SECTION_MM2);
    expect(result.exceedsStandardRange).toBe(true);
    expect(result.fuseA).toBeNull();
    expect(result.maxFuseA).toBeNull();
  });

  it('wirft bei ungültigen Eingaben, statt zu schätzen (Rule M)', () => {
    expect(() => sizeCable(Number.NaN, 5)).toThrow(RangeError);
    expect(() => sizeCable(10, Number.NaN)).toThrow(RangeError);
    expect(() => sizeCable(10, -1)).toThrow(RangeError);
    expect(() => sizeCable(Number.POSITIVE_INFINITY, 5)).toThrow(RangeError);
  });
});

/**
 * Die drei Zusätze für die Themenseiten. Auch hier gilt: Die Erwartung ist von
 * Hand gerechnet (κ = 58 m/(Ω·mm²), ΔU = 0,36 V bei 3 % von 12 V), nicht aus
 * der Implementierung abgeschrieben.
 */
describe('voltageDropFor', () => {
  it('bewertet eine vorhandene Leitung und ordnet sie ein', () => {
    // ΔU = (10 A · 2 · 5 m) / (58 · 2,5 mm²) = 0,6897 V = 5,75 % → über der Grenze
    const result = voltageDropFor(10, 5, 2.5);

    expect(result.crossSectionMm2).toBe(2.5);
    expect(result.dropV).toBeCloseTo(0.6897, 4);
    expect(result.dropPercent).toBeCloseTo(5.747, 3);
    expect(result.verdict).toBe('kritisch');
    expect(result.exceedsPlanLimit).toBe(true);
    expect(result.recommendedCrossSectionMm2).toBe(6);
  });

  it('nennt den Zielbereich bei 1 % und darunter', () => {
    // ΔU = (10 A · 2 · 1 m) / (58 · 10 mm²) = 0,0345 V = 0,29 % → Zielbereich
    expect(voltageDropFor(10, 1, 10).verdict).toBe('ziel');
  });

  it('unterscheidet Planungsgrenze und Verstoß', () => {
    // 6 mm² über 5 m bei 10 A: 0,287 V = 2,39 % → innerhalb der Planungsgrenze
    expect(voltageDropFor(10, 5, 6).verdict).toBe('planungsgrenze');
    // 4 mm² über 5 m bei 10 A: 0,431 V = 3,59 % → Verstoß
    expect(voltageDropFor(10, 5, 4).verdict).toBe('verstoss');
  });

  it('rechnet mit 24 V genauso und halbiert dabei den Prozentwert', () => {
    const at12 = voltageDropFor(10, 5, 4);
    const at24 = voltageDropFor(10, 5, 4, 24);

    expect(at24.dropV).toBeCloseTo(at12.dropV, 10);
    expect(at24.dropPercent).toBeCloseTo(at12.dropPercent / 2, 10);
  });

  it('wirft bei ungültigen Eingaben', () => {
    expect(() => voltageDropFor(Number.NaN, 5, 2.5)).toThrow(RangeError);
    expect(() => voltageDropFor(10, 0, 2.5)).toThrow(RangeError);
    expect(() => voltageDropFor(10, 5, -1)).toThrow(RangeError);
  });
});

describe('maxCurrentForPlanLimit', () => {
  it('ist die Umkehrung der Spannungsfall-Formel', () => {
    // I = (58 · 2,5 mm² · 0,36 V) / (2 · 5 m) = 5,22 A
    expect(maxCurrentForPlanLimit(2.5, 5)).toBeCloseTo(5.22, 2);
    // doppelte Länge, halber Strom
    expect(maxCurrentForPlanLimit(2.5, 10)).toBeCloseTo(maxCurrentForPlanLimit(2.5, 5) / 2, 10);
  });

  it('wirft bei ungültigem Querschnitt oder ungültiger Länge', () => {
    expect(() => maxCurrentForPlanLimit(Number.NaN, 5)).toThrow(RangeError);
    expect(() => maxCurrentForPlanLimit(2.5, 0)).toThrow(RangeError);
  });
});

describe('thermalCurrentFor', () => {
  it('trennt Tabellenwert und Bemessungswert', () => {
    const result = thermalCurrentFor(6);

    expect(result.tableA).toBe(38);
    // Derating 0,7 auf 38 A = 26,6 A
    expect(result.designA).toBeCloseTo(26.6, 6);
  });

  it('nennt für einen Nicht-Norm-Querschnitt keinen Tabellenwert', () => {
    expect(thermalCurrentFor(5).tableA).toBeNull();
  });

  it('wirft bei ungültigem Querschnitt', () => {
    expect(() => thermalCurrentFor(Number.NaN)).toThrow(RangeError);
  });
});
