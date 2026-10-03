import { describe, expect, it } from 'vitest';

import { BATTERY_CHEMISTRIES, DEFAULT_CHARGE_WINDOW_HOURS, sizeBattery } from './batterySizing';
import { PEUKERT_EXPONENT } from './peukert';
import { VDE_BATTERY_DOD, VDE_CHARGE_DERATING_FACTOR } from './vde-standards';

/**
 * Die Erwartungswerte sind von Hand aus den Modellgrößen nachgerechnet
 * (C = E·Tage/(U·DoD)·(1+Reserve)) — nicht aus der Implementierung
 * abgeschrieben. So fällt auf, wenn eine Konstante des Modells wandert.
 */
describe('sizeBattery', () => {
  const base = { dailyEnergyWh: 500, autonomyDays: 1, systemVoltageV: 12, chemistry: 'LiFePO4' as const };

  it('rechnet den Tagesbedarf in Nennkapazität um', () => {
    // 500 Wh / (12 V · 0,9) = 46,3 Ah → auf 5-Ah-Stufen 50 Ah
    const result = sizeBattery(base);

    expect(result.requiredUsableWh).toBe(500);
    expect(result.dodFraction).toBe(0.9);
    expect(result.requiredNominalAh).toBeCloseTo(46.296, 3);
    expect(result.recommendedNominalAh).toBe(50);
    expect(result.sufficient).toBe(true);
  });

  it('zieht die Entladetiefe der Chemie heran (AGM: 50 %)', () => {
    // 500 Wh / (12 V · 0,5) = 83,3 Ah → 85 Ah
    const result = sizeBattery({ ...base, chemistry: 'AGM' });

    expect(result.dodFraction).toBe(VDE_BATTERY_DOD.AGM);
    expect(result.requiredNominalAh).toBeCloseTo(83.333, 3);
    expect(result.recommendedNominalAh).toBe(85);
  });

  it('rechnet Autarkietage und Reservezuschlag multiplikativ', () => {
    // 500 Wh · 2 Tage / (12 V · 0,9) = 92,6 Ah; +20 % = 111,1 Ah → 115 Ah
    const result = sizeBattery({ ...base, autonomyDays: 2, reservePercent: 20 });

    expect(result.requiredNominalAh).toBeCloseTo(92.593, 3);
    expect(result.requiredNominalWithReserveAh).toBeCloseTo(111.111, 3);
    expect(result.recommendedNominalAh).toBe(115);
  });

  it('mindert die nutzbare Kapazität über den Peukert-Faktor', () => {
    // 40 A aus 50 Ah: k = (2,5/40)^0,05 = 0,87055 → 50 Ah · 0,9 · 0,87055 = 39,17 Ah
    const result = sizeBattery({ ...base, referenceCurrentA: 40 });

    expect(result.peukertExponent).toBe(PEUKERT_EXPONENT.LiFePO4);
    expect(result.peukertFactor).toBeCloseTo(0.87055, 4);
    expect(result.usableAhOfRecommendation).toBeCloseTo(50 * 0.9 * result.peukertFactor, 6);
  });

  it('leitet den Ladestrom aus Tagesbedarf, Ladefenster und Ladezeit-Aufschlag ab', () => {
    // 500 Wh / (12 V · 5 h) · 1,15 = 9,58 A
    const result = sizeBattery(base);

    expect(result.chargeWindowHours).toBe(DEFAULT_CHARGE_WINDOW_HOURS);
    expect(result.chargeCurrentA).toBeCloseTo((500 / (12 * 5)) * VDE_CHARGE_DERATING_FACTOR, 6);
  });

  it('kennt jede Chemie der Normtabelle', () => {
    for (const chemistry of BATTERY_CHEMISTRIES) {
      expect(VDE_BATTERY_DOD[chemistry]).toBeGreaterThan(0);
      expect(() => sizeBattery({ ...base, chemistry })).not.toThrow();
    }
  });

  it('meldet Unterdeckung, wenn der Tagesbedarf die Empfehlung übersteigt', () => {
    // Sehr hoher Dauerstrom: Peukert drückt die nutzbare Kapazität unter den Bedarf.
    const result = sizeBattery({ ...base, dailyEnergyWh: 2000, referenceCurrentA: 200 });

    expect(result.sufficient).toBe(false);
  });

  it('wirft bei ungültigen Eingaben, statt zu schätzen (Rule M)', () => {
    expect(() => sizeBattery({ ...base, dailyEnergyWh: 0 })).toThrow(RangeError);
    expect(() => sizeBattery({ ...base, autonomyDays: Number.NaN })).toThrow(RangeError);
    expect(() => sizeBattery({ ...base, reservePercent: 80 })).toThrow(RangeError);
    expect(() => sizeBattery({ ...base, chargeWindowHours: 0 })).toThrow(RangeError);
    expect(() => sizeBattery({ ...base, chemistry: 'Kernfusion' as unknown as 'LiFePO4' })).toThrow(
      RangeError
    );
  });
});
