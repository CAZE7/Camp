import { describe, expect, it } from 'vitest';

import { MAX_STANDARD_CROSS_SECTION_MM2, sizeCable } from './cableSizing';

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
