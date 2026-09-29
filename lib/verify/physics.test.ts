import { describe, expect, it } from 'vitest';

import { COPPER_RESISTIVITY_OHM_MM2_PER_M, COPPER_TEMPERATURE_COEFFICIENT_PER_K } from '../materials';
import { VDE_AMPACITY } from '../electrical';

import {
  MAX_CONDUCTOR_TEMPERATURE_C,
  REFERENCE_AMBIENT_C,
  RCD_SELECTIVITY_RATIO_HEURISTIC,
  SELECTIVITY_RATIO_HEURISTIC,
  VOLTAGE_DROP_DESIGN_TEMPERATURE_C,
  ambientTemperatureFactor,
  checkDisconnection,
  conductorResistanceOhm,
  copperResistivityAt,
  effectiveAmpacityA,
  loopImpedanceOhm,
  minimumFaultCurrentA,
  selectivityByEnergy,
  voltageDropBudgetPercent,
  voltageDropPercent,
  voltageDropVolts,
} from './physics';

describe('lib/verify/physics — Kupferdaten kommen aus der EINEN Werkstoffquelle', () => {
  it('nutzt ρ₂₀ und α aus lib/materials.ts', () => {
    expect(COPPER_RESISTIVITY_OHM_MM2_PER_M).toBe(0.0175);
    expect(COPPER_TEMPERATURE_COEFFICIENT_PER_K).toBe(0.00393);
    expect(REFERENCE_AMBIENT_C).toBe(30);
  });

  it('rechnet ρ(T) = ρ₂₀ · [1 + α₂₀ · (T − 20 °C)]', () => {
    expect(copperResistivityAt(20)).toBeCloseTo(0.0175, 12);
    expect(copperResistivityAt(70)).toBeCloseTo(0.0175 * (1 + 0.00393 * 50), 12);
    expect(copperResistivityAt(70)).toBeCloseTo(0.02093875, 12);
    // Kaltleiter ist besser als der 20-°C-Wert.
    expect(copperResistivityAt(-20)).toBeLessThan(0.0175);
  });
});

describe('lib/verify/physics — Leitungswiderstand und Spannungsfall', () => {
  it('rechnet R = 2·L·ρ(T)/A (Hin- und Rückleiter)', () => {
    // 10 m, 2,5 mm²: 2 · 10 · 0,0175 / 2,5 = 0,14 Ω
    expect(conductorResistanceOhm({ lengthM: 10, crossSectionMm2: 2.5 })).toBeCloseTo(0.14, 12);
    expect(conductorResistanceOhm({ lengthM: 10, crossSectionMm2: 2.5, temperatureC: 70 })).toBeCloseTo(
      (2 * 10 * copperResistivityAt(70)) / 2.5,
      12
    );
    // Wärmer = schlechter.
    expect(conductorResistanceOhm({ lengthM: 10, crossSectionMm2: 2.5, temperatureC: 70 })).toBeGreaterThan(
      conductorResistanceOhm({ lengthM: 10, crossSectionMm2: 2.5 })
    );
  });

  it('wirft bei unmöglichen Querschnitts-/Längenwerten (kein stiller 0-Ω-Ersatz)', () => {
    expect(() => conductorResistanceOhm({ lengthM: 1, crossSectionMm2: 0 })).toThrow(RangeError);
    expect(() => conductorResistanceOhm({ lengthM: 1, crossSectionMm2: Number.NaN })).toThrow(RangeError);
    expect(() => conductorResistanceOhm({ lengthM: -1, crossSectionMm2: 2.5 })).toThrow(RangeError);
  });

  it('rechnet ΔU und ΔU_% konsistent zur Handrechnung', () => {
    const drop = voltageDropVolts({ lengthM: 10, crossSectionMm2: 2.5, currentA: 10 });
    expect(drop).toBeCloseTo((2 * 10 * 10 * 0.0175) / 2.5, 12); // 1,4 V
    expect(voltageDropPercent(drop, 12.8)).toBeCloseTo(10.9375, 9);
    expect(voltageDropPercent(0, 12.8)).toBe(0);
  });

  it('wirft bei negativem Strom oder Nennspannung 0', () => {
    expect(() => voltageDropVolts({ lengthM: 1, crossSectionMm2: 2.5, currentA: -1 })).toThrow(RangeError);
    expect(() => voltageDropPercent(1, 0)).toThrow(RangeError);
  });

  it('setzt die ΔU-Budgets der Lastklassen (1 % / 3 %)', () => {
    expect(voltageDropBudgetPercent('charging')).toBe(1);
    expect(voltageDropBudgetPercent('sensitive')).toBe(1);
    expect(voltageDropBudgetPercent('safety')).toBe(1);
    expect(voltageDropBudgetPercent('standard')).toBe(3);
    expect(VOLTAGE_DROP_DESIGN_TEMPERATURE_C).toBe(70);
  });
});

describe('lib/verify/physics — Belastbarkeit I_z', () => {
  it('trifft die Umgebungstemperatur-Tabelle (IEC 60364-5-52 Tab. B.52.14, PVC)', () => {
    // Die physikalische Form √((T_max−ϑ)/(T_max−30)) muss die Tabellenzeilen
    // auf zwei Nachkommastellen reproduzieren — sonst wäre sie eine Erfindung.
    const rows: ReadonlyArray<readonly [number, number]> = [
      [10, 1.22],
      [15, 1.17],
      [20, 1.12],
      [25, 1.06],
      [30, 1.0],
      [35, 0.94],
      [40, 0.87],
      [45, 0.79],
      [50, 0.71],
      [55, 0.61],
      [60, 0.5],
    ];
    for (const [ambient, expected] of rows) {
      expect(Number(ambientTemperatureFactor(ambient, 'PVC').toFixed(2)), `${ambient} °C`).toBe(expected);
    }
    expect(MAX_CONDUCTOR_TEMPERATURE_C.PVC).toBe(70);
    expect(MAX_CONDUCTOR_TEMPERATURE_C.XLPE).toBe(90);
  });

  it('wirft oberhalb der Grenzleitertemperatur (Betrieb ist dann unzulässig)', () => {
    expect(() => ambientTemperatureFactor(70, 'PVC')).toThrow(RangeError);
    expect(() => ambientTemperatureFactor(90, 'XLPE')).toThrow(RangeError);
    expect(() => ambientTemperatureFactor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('setzt IMMER den strengeren Wert aus Planer-Pauschale und Physik an', () => {
    // Referenzbedingungen: nur die Pauschale 0,7 wirkt.
    const reference = effectiveAmpacityA(4, { ambientC: 30, bundledCircuits: 1 });
    expect(reference.baseAmpacityA).toBe(VDE_AMPACITY[4]);
    expect(reference.ambientFactor).toBeCloseTo(1, 12);
    expect(reference.combinedFactor).toBeCloseTo(0.7, 12);
    expect(reference.izA).toBeCloseTo((VDE_AMPACITY[4] ?? 0) * 0.7, 12);

    // Hitzestau: 60 °C ⇒ f₁ = 0,5; mit Häufung f₂ < 1 wird es noch strenger
    // als die Pauschale 0,7.
    const hot = effectiveAmpacityA(4, { ambientC: 60, bundledCircuits: 2 });
    expect(hot.ambientFactor).toBeCloseTo(0.5, 12);
    expect(hot.combinedFactor).toBeLessThan(0.5);
    expect(hot.izA).toBeLessThan(reference.izA);
  });

  it('wirft bei unbekanntem Querschnitt statt 0 A zu liefern', () => {
    expect(() => effectiveAmpacityA(3.3)).toThrow(RangeError);
    expect(() => effectiveAmpacityA(-1)).toThrow(RangeError);
  });
});

describe('lib/verify/physics — Abschaltbedingung und Selektivität', () => {
  it('rechnet Z_s = ρ·L·(1/A_hin + 1/A_rück) + Quellimpedanz', () => {
    expect(loopImpedanceOhm({ lengthM: 20, phaseMm2: 2.5, returnMm2: 2.5 })).toBeCloseTo(0.28, 12);
    const withSource = loopImpedanceOhm({
      lengthM: 20,
      phaseMm2: 2.5,
      returnMm2: 2.5,
      sourceResistanceOhm: 0.8,
    });
    expect(withSource).toBeCloseTo(1.08, 12);
  });

  it('rechnet I_k,min = c·U_n/Z_s mit c = 0,95 und vergleicht mit I_a', () => {
    expect(minimumFaultCurrentA(230, 0.5)).toBeCloseTo((0.95 * 230) / 0.5, 9);
    expect(minimumFaultCurrentA(230, 1.08)).toBeCloseTo(202.31, 1);
    const ok = checkDisconnection(230, 0.5, 80);
    expect(ok.satisfied).toBe(true);
    expect(ok.maxLoopImpedanceOhm).toBeCloseTo((0.95 * 230) / 80, 9);
    // Z_s über der zulässigen Schleifenimpedanz (2,73 Ω bei I_a = 80 A).
    const fail = checkDisconnection(230, 3, 80);
    expect(fail.satisfied).toBe(false);
    expect(fail.minimumFaultCurrentA).toBeLessThan(80);
    expect(checkDisconnection(230, 1.08, 80).satisfied).toBe(true);
  });

  it('wirft bei Z_s = 0 und ungültigem Faktor', () => {
    expect(() => minimumFaultCurrentA(230, 0)).toThrow(RangeError);
    expect(() => minimumFaultCurrentA(230, 1, 1.2)).toThrow(RangeError);
  });

  it('entscheidet Selektivität über das Schmelzintegral, nicht über Bauchgefühl', () => {
    expect(selectivityByEnergy({ upstreamPreArcingI2t: 5000, downstreamClearingI2t: 2000 })).toBe(true);
    expect(selectivityByEnergy({ upstreamPreArcingI2t: 1000, downstreamClearingI2t: 2000 })).toBe(false);
    // Faustwerte sind als Faustwerte ausgewiesen.
    expect(SELECTIVITY_RATIO_HEURISTIC).toBe(1.6);
    expect(RCD_SELECTIVITY_RATIO_HEURISTIC).toBe(3);
  });
});

describe('lib/verify/physics — Eingabegrenzen (kein stiller Ersatzwert)', () => {
  it('weist unmögliche Temperaturen und Längen zurück', () => {
    expect(() => copperResistivityAt(Number.NaN)).toThrow(/endlich/);
    expect(() => copperResistivityAt(Number.POSITIVE_INFINITY)).toThrow(/endlich/);
    expect(() => copperResistivityAt(-300)).toThrow(/absoluten Nullpunkt/);
    expect(() => conductorResistanceOhm({ crossSectionMm2: 4, lengthM: -1 })).toThrow(/Länge/);
    expect(() => conductorResistanceOhm({ crossSectionMm2: 0, lengthM: 1 })).toThrow(/Querschnitt/);
    expect(() =>
      conductorResistanceOhm({ crossSectionMm2: 4, lengthM: 1, currentPathFactor: 3 as never })
    ).toThrow(/currentPathFactor/);
  });

  it('weist unbekannte Querschnitte und Auslöseströme zurück', () => {
    expect(() => effectiveAmpacityA(2.7)).toThrow(/Belastbarkeitstabelle/);
    expect(() => loopImpedanceOhm({ lengthM: 10, phaseMm2: 1.5, returnMm2: 0 })).toThrow(/Querschnitte/);
    expect(() => checkDisconnection(230, 1, 0)).toThrow(/Auslösestrom/);
    expect(() => voltageDropBudgetPercent('erfunden' as never)).toThrow(/Lastklasse/);
  });

  it('liefert die Modell-Pauschale, wenn keine Bedingungen angegeben sind', () => {
    const result = effectiveAmpacityA(4);
    expect(result.baseAmpacityA).toBe(VDE_AMPACITY[4]);
    expect(result.groupingFactor).toBe(1);
    expect(result.izA).toBeCloseTo(VDE_AMPACITY[4]! * 0.7, 6);
    expect(result.basis).toBe('plan-model-pauschale');
  });

  it('gibt Lade- und Sicherheitslasten 1 % Budget, Standardverbrauchern 3 %', () => {
    expect(voltageDropBudgetPercent('charging')).toBe(1);
    expect(voltageDropBudgetPercent('sensitive')).toBe(1);
    expect(voltageDropBudgetPercent('safety')).toBe(1);
    expect(voltageDropBudgetPercent('standard')).toBe(3);
  });
});
