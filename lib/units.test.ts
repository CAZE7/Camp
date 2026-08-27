import { describe, expect, it } from 'vitest';
import {
  watts,
  amps,
  volts,
  mm2,
  meters,
  millivolts,
  ohms,
  toNumber,
  toFixedNumber,
  parseQuantity,
  quantityOr,
  power,
  currentFromPower,
  voltageFromPower,
  voltageFromResistance,
  conductorResistance,
  voltsToMillivolts,
  millivoltsToVolts,
  dropFraction,
  dropPercent,
  addWatts,
  sumWatts,
  scaleWatts,
  addAmps,
  sumAmps,
  scaleAmps,
  addVolts,
  sumVolts,
  scaleVolts,
  addMeters,
  sumMeters,
  scaleMeters,
  scaleMm2,
  divideAmps,
  divideWatts,
  maxAmps,
  maxMm2,
  maxWatts,
  minMm2,
  ZERO_AMPS,
  ZERO_METERS,
  ZERO_VOLTS,
  ZERO_WATTS,
} from './units';

describe('lib/units — Konstruktoren', () => {
  it('akzeptiert gültige Werte und liefert zur Laufzeit den rohen number', () => {
    expect(toNumber(watts(1200))).toBe(1200);
    expect(toNumber(amps(12.5))).toBe(12.5);
    expect(toNumber(volts(12))).toBe(12);
    expect(toNumber(mm2(2.5))).toBe(2.5);
    expect(toNumber(meters(3))).toBe(3);
    expect(toNumber(millivolts(360))).toBe(360);
    expect(toNumber(ohms(0.0035))).toBe(0.0035);
  });

  it('erlaubt 0 für Watt, Ampere, Volt, Meter, Millivolt und Ohm', () => {
    expect(toNumber(watts(0))).toBe(0);
    expect(toNumber(amps(0))).toBe(0);
    expect(toNumber(volts(0))).toBe(0);
    expect(toNumber(meters(0))).toBe(0);
    expect(toNumber(millivolts(0))).toBe(0);
    expect(toNumber(ohms(0))).toBe(0);
  });

  it('lehnt 0 mm² ab — ein Leiter ohne Querschnitt existiert nicht', () => {
    expect(() => mm2(0)).toThrow(RangeError);
    expect(() => mm2(0)).toThrow(/mm²/);
  });

  it('lehnt negative Werte ab', () => {
    expect(() => watts(-1)).toThrow(RangeError);
    expect(() => amps(-0.1)).toThrow(RangeError);
    expect(() => volts(-12)).toThrow(RangeError);
    expect(() => mm2(-2.5)).toThrow(RangeError);
    expect(() => meters(-3)).toThrow(RangeError);
    expect(() => millivolts(-1)).toThrow(RangeError);
    expect(() => ohms(-1)).toThrow(RangeError);
  });

  it('lehnt NaN ab', () => {
    expect(() => amps(NaN)).toThrow(/NaN/);
    expect(() => mm2(Number('keine zahl'))).toThrow(RangeError);
  });

  it('lehnt Infinity und -Infinity ab', () => {
    expect(() => volts(Infinity)).toThrow(/nicht endlich/);
    expect(() => volts(-Infinity)).toThrow(RangeError);
    expect(() => mm2(1 / 0)).toThrow(RangeError);
  });

  it('nennt in der Fehlermeldung Einheit und Wert', () => {
    expect(() => amps(-5)).toThrow(/Amps: -5 A/);
    expect(() => mm2(0)).toThrow(/Mm2: 0 mm²/);
  });

  it('lehnt Nicht-Zahlen zur Laufzeit ab (Daten aus JSON/localStorage)', () => {
    const fromStorage: unknown = '12';
    expect(() => amps(fromStorage as number)).toThrow(TypeError);
    expect(() => watts(null as unknown as number)).toThrow(TypeError);
    expect(() => volts(undefined as unknown as number)).toThrow(TypeError);
  });
});

describe('lib/units — Grenzen zur Außenwelt', () => {
  it('parseQuantity liest Zahlen und Zahl-Strings', () => {
    expect(parseQuantity(2.5, mm2)).toBe(2.5);
    expect(parseQuantity('2.5', mm2)).toBe(2.5);
    expect(parseQuantity(' 16 ', amps)).toBe(16);
  });

  it('parseQuantity akzeptiert das deutsche Dezimalkomma aus Formularen', () => {
    expect(parseQuantity('1,5', mm2)).toBe(1.5);
    expect(parseQuantity('0,36', volts)).toBeCloseTo(0.36, 10);
  });

  it('parseQuantity liefert null statt zu werfen', () => {
    expect(parseQuantity('', amps)).toBeNull();
    expect(parseQuantity('   ', amps)).toBeNull();
    expect(parseQuantity(null, amps)).toBeNull();
    expect(parseQuantity(undefined, amps)).toBeNull();
    expect(parseQuantity(true, amps)).toBeNull();
    expect(parseQuantity({ value: 12 }, amps)).toBeNull();
    expect(parseQuantity('abc', amps)).toBeNull();
    expect(parseQuantity(-3, amps)).toBeNull();
    expect(parseQuantity(0, mm2)).toBeNull();
  });

  it('quantityOr setzt den Ersatzwert nur bei ungültiger Eingabe ein', () => {
    expect(quantityOr('4', mm2, mm2(1.5))).toBe(4);
    expect(quantityOr('', mm2, mm2(1.5))).toBe(1.5);
    expect(quantityOr(0, mm2, mm2(1.5))).toBe(1.5);
    expect(quantityOr(0, amps, amps(9))).toBe(0);
  });

  it('toFixedNumber rundet für Anzeigen und prüft die Stellenzahl', () => {
    expect(toFixedNumber(volts(0.3612345))).toBe(0.4);
    expect(toFixedNumber(volts(0.3612345), 3)).toBe(0.361);
    expect(toFixedNumber(watts(1200), 0)).toBe(1200);
    expect(() => toFixedNumber(volts(1), -1)).toThrow(RangeError);
    expect(() => toFixedNumber(volts(1), 1.5)).toThrow(RangeError);
  });
});

describe('lib/units — physikalische Operationen', () => {
  it('P = U · I', () => {
    expect(toNumber(power(volts(12), amps(10)))).toBe(120);
    expect(toNumber(power(volts(230), amps(16)))).toBe(3680);
    expect(toNumber(power(volts(12), ZERO_AMPS))).toBe(0);
  });

  it('I = P / U', () => {
    expect(toNumber(currentFromPower(watts(1200), volts(12)))).toBe(100);
    expect(toNumber(currentFromPower(watts(2000), volts(230)))).toBeCloseTo(8.6957, 4);
  });

  it('U = P / I', () => {
    expect(toNumber(voltageFromPower(watts(1200), amps(100)))).toBe(12);
  });

  it('Division durch null wirft statt Infinity zu liefern', () => {
    expect(() => currentFromPower(watts(100), ZERO_VOLTS)).toThrow(RangeError);
    expect(() => voltageFromPower(watts(100), ZERO_AMPS)).toThrow(RangeError);
    expect(() => dropFraction(volts(1), ZERO_VOLTS)).toThrow(RangeError);
  });

  it('P = U · I ist konsistent zur Umkehrung I = P / U', () => {
    const u = volts(12.8);
    const i = amps(37.5);
    const p = power(u, i);
    expect(toNumber(currentFromPower(p, u))).toBeCloseTo(toNumber(i), 10);
    expect(toNumber(voltageFromPower(p, i))).toBeCloseTo(toNumber(u), 10);
  });

  it('R = ρ · L / A und U = R · I ergeben den bekannten Spannungsfall', () => {
    // 10 m, 6 mm², Kupfer ρ = 0.0175 → R = 0.02917 Ω, bei 20 A → 0.583 V
    const resistance = conductorResistance(meters(10), mm2(6), 0.0175);
    expect(toNumber(resistance)).toBeCloseTo(0.0291667, 6);
    expect(toNumber(voltageFromResistance(resistance, amps(20)))).toBeCloseTo(0.583333, 5);
  });

  it('conductorResistance lehnt ein unphysikalisches ρ ab', () => {
    expect(() => conductorResistance(meters(1), mm2(1), 0)).toThrow(RangeError);
    expect(() => conductorResistance(meters(1), mm2(1), -0.0175)).toThrow(RangeError);
    expect(() => conductorResistance(meters(1), mm2(1), NaN)).toThrow(RangeError);
  });

  it('rechnet verlustfrei zwischen Volt und Millivolt um', () => {
    expect(toNumber(voltsToMillivolts(volts(0.36)))).toBeCloseTo(360, 10);
    expect(toNumber(millivoltsToVolts(millivolts(360)))).toBeCloseTo(0.36, 10);
    const original = volts(1.2345);
    expect(toNumber(millivoltsToVolts(voltsToMillivolts(original)))).toBeCloseTo(1.2345, 10);
  });

  it('dropFraction und dropPercent liefern dimensionslose Verhältnisse', () => {
    expect(dropFraction(volts(0.36), volts(12))).toBeCloseTo(0.03, 10);
    expect(dropPercent(volts(0.36), volts(12))).toBeCloseTo(3, 10);
    expect(dropPercent(volts(6.9), volts(230))).toBeCloseTo(3, 10);
  });
});

describe('lib/units — einheitenerhaltende Arithmetik', () => {
  it('addiert und summiert innerhalb einer Einheit', () => {
    expect(toNumber(addWatts(watts(60), watts(40)))).toBe(100);
    expect(toNumber(sumWatts([watts(60), watts(40), watts(20)]))).toBe(120);
    expect(toNumber(sumWatts([]))).toBe(0);

    expect(toNumber(addAmps(amps(5), amps(7)))).toBe(12);
    expect(toNumber(sumAmps([amps(5), amps(7)]))).toBe(12);

    expect(toNumber(addVolts(volts(0.2), volts(0.1)))).toBeCloseTo(0.3, 10);
    expect(toNumber(sumVolts([volts(0.2), volts(0.1)]))).toBeCloseTo(0.3, 10);

    expect(toNumber(addMeters(meters(1.5), meters(2)))).toBe(3.5);
    expect(toNumber(sumMeters([meters(1.5), meters(2)]))).toBe(3.5);
  });

  it('skaliert mit dimensionslosen Faktoren', () => {
    expect(toNumber(scaleWatts(watts(1000), 0.85))).toBe(850);
    expect(toNumber(scaleAmps(amps(30), 1.15))).toBeCloseTo(34.5, 10);
    expect(toNumber(scaleVolts(volts(12), 0.03))).toBeCloseTo(0.36, 10);
    expect(toNumber(scaleMeters(meters(3), 2))).toBe(6);
    expect(toNumber(scaleMm2(mm2(2.5), 2))).toBe(5);
  });

  it('lehnt Ergebnisse ab, die den gültigen Bereich verlassen', () => {
    expect(() => scaleWatts(watts(100), -1)).toThrow(RangeError);
    expect(() => scaleMm2(mm2(2.5), 0)).toThrow(RangeError);
    expect(() => scaleAmps(amps(10), Infinity)).toThrow(RangeError);
    expect(() => scaleAmps(amps(10), NaN)).toThrow(RangeError);
  });

  it('dividiert durch dimensionslose Zahlen und bleibt in der Einheit', () => {
    // Wechselrichter-Wirkungsgrad: DC-Strom = AC-Strom / 0.85
    expect(toNumber(divideAmps(amps(10), 0.85))).toBe(10 / 0.85);
    expect(toNumber(divideWatts(watts(1000), 0.85))).toBe(1000 / 0.85);
    // bit-identisch zur direkten Division (kein Kehrwert-Rundungsfehler)
    expect(toNumber(divideAmps(amps(37.5), 0.85))).toBe(37.5 / 0.85);
  });

  it('lehnt die Division durch 0 und ungültige Divisoren ab', () => {
    expect(() => divideAmps(amps(10), 0)).toThrow(RangeError);
    expect(() => divideAmps(amps(10), NaN)).toThrow(RangeError);
    expect(() => divideWatts(watts(10), Infinity)).toThrow(RangeError);
    expect(() => divideAmps(amps(10), -1)).toThrow(RangeError);
  });

  it('max/min bleiben in der Einheit', () => {
    expect(toNumber(maxAmps(amps(12), amps(30)))).toBe(30);
    expect(toNumber(maxMm2(mm2(2.5), mm2(6)))).toBe(6);
    expect(toNumber(maxWatts(watts(60), watts(40)))).toBe(60);
    expect(toNumber(minMm2(mm2(2.5), mm2(6)))).toBe(2.5);
  });

  it('stellt Null-Konstanten bereit', () => {
    expect(toNumber(ZERO_WATTS)).toBe(0);
    expect(toNumber(ZERO_AMPS)).toBe(0);
    expect(toNumber(ZERO_VOLTS)).toBe(0);
    expect(toNumber(ZERO_METERS)).toBe(0);
  });
});

describe('lib/units — Laufzeitverhalten der Marken', () => {
  it('Marken sind zur Laufzeit gewöhnliche Zahlen (JSON-tauglich)', () => {
    const value = amps(12.5);
    expect(typeof value).toBe('number');
    expect(JSON.stringify({ current: value })).toBe('{"current":12.5}');
    expect(value + 1).toBe(13.5);
    expect(Math.max(value, 20)).toBe(20);
  });

  it('erzeugt keine Wrapper-Objekte', () => {
    expect(Object.keys(amps(1) as unknown as object)).toHaveLength(0);
    expect(amps(3) === 3).toBe(true);
  });
});
