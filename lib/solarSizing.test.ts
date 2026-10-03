import { describe, expect, it } from 'vitest';

import { DEFAULT_YIELD_KWH_PER_KWP_DAY, sizeSolarArray } from './solarSizing';
import {
  VDE_CHARGE_DERATING_FACTOR,
  VDE_SOLAR_WINTER_REDUCTION,
  VDE_SOLAR_VMP_VOLTAGE,
} from './vde-standards';

/**
 * Wie in `batterySizing.test.ts`: Erwartungswerte von Hand aus den
 * Modellgrößen nachgerechnet (P = E / Ertrag · 1000 Wp · Ladezeit-Aufschlag).
 */
describe('sizeSolarArray', () => {
  it('rechnet aus Tagesbedarf und spezifischem Ertrag die Modulleistung', () => {
    // 500 Wh bei 3,0 kWh/kWp/Tag → 166,7 Wp · 1,15 = 191,7 Wp → 2 × 100 Wp
    const result = sizeSolarArray({ dailyEnergyWh: 500, systemVoltageV: 12, panelWatts: 100 });

    expect(result.effectiveYieldKwhPerKwpDay).toBe(DEFAULT_YIELD_KWH_PER_KWP_DAY);
    expect(result.requiredPeakWatts).toBeCloseTo((500 / 3000) * 1000 * VDE_CHARGE_DERATING_FACTOR, 6);
    expect(result.panelCount).toBe(2);
    expect(result.recommendedPeakWatts).toBe(200);
    // Ertrag der Empfehlung: 200 Wp · 3,0 kWh/kWp/Tag = 600 Wh gegen 500 Wh Bedarf.
    expect(result.coverageFactor).toBeCloseTo(((200 / 1000) * 3000) / 500, 6);
  });

  it('legt im Winterfall mit 35 % des Ertrags aus', () => {
    const summer = sizeSolarArray({ dailyEnergyWh: 500, systemVoltageV: 12, panelWatts: 100 });
    const winter = sizeSolarArray({
      dailyEnergyWh: 500,
      systemVoltageV: 12,
      panelWatts: 100,
      winterDesign: true,
    });

    expect(winter.seasonFactor).toBe(VDE_SOLAR_WINTER_REDUCTION);
    expect(winter.recommendedPeakWatts).toBeGreaterThan(summer.recommendedPeakWatts);
    // Die ungerundete Anforderung skaliert exakt mit dem Winterfaktor; das
    // Panelraster rundet danach (Sommer 2 × 100 Wp, Winter 6 × 100 Wp).
    expect(winter.requiredPeakWatts / summer.requiredPeakWatts).toBeCloseTo(1 / 0.35, 6);
    expect(summer.recommendedPeakWatts).toBe(200);
    expect(winter.recommendedPeakWatts).toBe(600);
  });

  it('verrechnet einen Abschlag für Ausrichtung und Verschattung', () => {
    const withDerate = sizeSolarArray({
      dailyEnergyWh: 500,
      systemVoltageV: 12,
      panelWatts: 100,
      deratePercent: 30,
    });

    expect(withDerate.effectiveYieldKwhPerKwpDay).toBeCloseTo(DEFAULT_YIELD_KWH_PER_KWP_DAY * 0.7, 6);
    expect(withDerate.recommendedPeakWatts).toBe(300);
  });

  it('nennt den erwarteten Ladestrom bei MPP-Spannung', () => {
    const result = sizeSolarArray({ dailyEnergyWh: 500, systemVoltageV: 12, panelWatts: 100 });

    expect(result.expectedChargeCurrentA).toBeCloseTo(200 / VDE_SOLAR_VMP_VOLTAGE, 6);
  });

  it('liefert mindestens ein Panel', () => {
    const result = sizeSolarArray({ dailyEnergyWh: 5, systemVoltageV: 12, panelWatts: 100 });

    expect(result.panelCount).toBe(1);
    expect(result.recommendedPeakWatts).toBe(100);
  });

  it('wirft bei ungültigen Eingaben, statt zu schätzen (Rule M)', () => {
    expect(() => sizeSolarArray({ dailyEnergyWh: 0, systemVoltageV: 12 })).toThrow(RangeError);
    expect(() => sizeSolarArray({ dailyEnergyWh: 500, systemVoltageV: 12, deratePercent: 90 })).toThrow(
      RangeError
    );
    expect(() => sizeSolarArray({ dailyEnergyWh: 500, systemVoltageV: 12, yieldKwhPerKwpDay: -1 })).toThrow(
      RangeError
    );
  });
});
