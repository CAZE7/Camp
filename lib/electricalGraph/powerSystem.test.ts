import { describe, expect, it } from 'vitest';
import {
  SYSTEM_VOLTAGE_CLASSES,
  SYSTEM_VOLTAGE_WINDOWS,
  checkVoltageCompatibility,
  classifySystemVoltage,
  nominalVoltageOfClass,
  scaleToClass,
} from './powerSystem';
import { volts, type Volts } from '../units';
import {
  AC_SYSTEM_VOLTAGE,
  DEFAULT_SYSTEM_VOLTAGE,
  LEAD_SYSTEM_VOLTAGE,
  VDE_DISCHARGE_VOLTAGE_FACTOR,
} from '../vde-standards';

describe('V2-VOLT — Spannungsebenen 12 V / 24 V / 48 V', () => {
  it('Fenster überlappen sich nicht und lassen keine Lücke zwischen 10 V und 72 V', () => {
    const windows = SYSTEM_VOLTAGE_CLASSES.map((cls) => SYSTEM_VOLTAGE_WINDOWS[cls]);
    for (let index = 1; index < windows.length; index += 1) {
      expect(windows[index]!.min).toBe(windows[index - 1]!.max);
    }
  });

  it('ordnet die real vorkommenden Nennspannungen der richtigen Ebene zu', () => {
    const cases: [number, string][] = [
      [12, '12V'],
      [12.8, '12V'],
      [14.6, '12V'], // Ladeschluss LiFePO4
      [24, '24V'],
      [25.6, '24V'],
      [29.2, '24V'],
      [48, '48V'],
      [51.2, '48V'],
      [58.4, '48V'],
    ];
    for (const [value, expected] of cases) {
      expect(classifySystemVoltage(volts(value)), `${value} V`).toBe(expected);
    }
  });

  it('die Konstanten aus lib/vde-standards.ts liegen in der 12-V-Ebene', () => {
    expect(classifySystemVoltage(DEFAULT_SYSTEM_VOLTAGE)).toBe('12V');
    expect(classifySystemVoltage(LEAD_SYSTEM_VOLTAGE)).toBe('12V');
    // 230 V AC ist keine Bordnetzebene — und bekommt deshalb keine.
    expect(classifySystemVoltage(AC_SYSTEM_VOLTAGE)).toBe('unknown');
  });

  it('außerhalb aller Fenster ⇒ unknown, niemals ein stiller 12-V-Rückfall', () => {
    for (const value of [0, 5, 9.99, 72, 230]) {
      expect(classifySystemVoltage(volts(value)), `${value} V`).toBe('unknown');
    }
  });

  it('nicht-endliche Werte aus Importen ergeben unknown statt einer Klasse', () => {
    // `volts()` weist NaN/Infinity ab; über eine Deserialisierung (JSON,
    // localStorage) kann ein solcher Wert die Typgrenze dennoch passieren.
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(classifySystemVoltage(value as Volts), `${value}`).toBe('unknown');
    }
  });

  it('Fenstergrenzen sind unten inklusiv, oben exklusiv (keine doppelte Zuordnung)', () => {
    expect(classifySystemVoltage(volts(18))).toBe('24V');
    expect(classifySystemVoltage(volts(17.999))).toBe('12V');
    expect(classifySystemVoltage(volts(36))).toBe('48V');
  });

  it('nominalVoltageOfClass trennt Lithium von Blei', () => {
    expect(nominalVoltageOfClass('12V', 'lifepo4')).toBeCloseTo(12.8, 10);
    expect(nominalVoltageOfClass('24V', 'lifepo4')).toBeCloseTo(25.6, 10);
    expect(nominalVoltageOfClass('48V', 'liion')).toBeCloseTo(51.2, 10);
    expect(nominalVoltageOfClass('12V', 'agm')).toBe(12);
    expect(nominalVoltageOfClass('24V')).toBe(24);
    expect(nominalVoltageOfClass('48V', 'gel')).toBe(48);
  });

  it('jede erzeugte Nennspannung fällt in ihre eigene Klasse zurück (Rundlauf)', () => {
    for (const cls of SYSTEM_VOLTAGE_CLASSES) {
      for (const chemistry of ['lifepo4', 'agm', undefined]) {
        expect(classifySystemVoltage(nominalVoltageOfClass(cls, chemistry))).toBe(cls);
      }
    }
  });

  it('scaleToClass skaliert 12-V-Bezugsgrößen mit der Zellzahl', () => {
    const cutoff = volts(12 * VDE_DISCHARGE_VOLTAGE_FACTOR);
    expect(scaleToClass(cutoff, '12V')).toBeCloseTo(11.25, 10);
    expect(scaleToClass(cutoff, '24V')).toBeCloseTo(22.5, 10);
    expect(scaleToClass(cutoff, '48V')).toBeCloseTo(45, 10);
  });

  describe('checkVoltageCompatibility', () => {
    it('ohne Angaben am Bauteil: kompatibel, weil die Datenlage nichts hergibt', () => {
      const result = checkVoltageCompatibility({}, volts(12.8));
      expect(result).toEqual({ ok: true, cls: '12V' });
    });

    it('24-V-Bauteil an 12-V-Anlage ist ein Klassenfehler, kein Stromproblem', () => {
      const result = checkVoltageCompatibility({ voltageClass: '24V' }, volts(12.8));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unerwartet kompatibel');
      expect(result.reason).toBe('class-mismatch');
      expect(result.detail).toContain('24V');
      expect(result.detail).toContain('12V');
    });

    it('deklarierte Ebene an einer unbekannten Systemspannung ⇒ unknown-class', () => {
      const result = checkVoltageCompatibility({ voltageClass: '12V' }, volts(230));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unerwartet kompatibel');
      expect(result.reason).toBe('unknown-class');
    });

    it('Fenstergrenzen des Bauteils werden einzeln gemeldet', () => {
      const window = { minVoltage: volts(11), maxVoltage: volts(15) };
      expect(checkVoltageCompatibility(window, volts(12.8)).ok).toBe(true);

      const low = checkVoltageCompatibility(window, volts(10.5));
      expect(low.ok).toBe(false);
      if (low.ok) throw new Error('unerwartet kompatibel');
      expect(low.reason).toBe('below-min');

      const high = checkVoltageCompatibility(window, volts(16));
      expect(high.ok).toBe(false);
      if (high.ok) throw new Error('unerwartet kompatibel');
      expect(high.reason).toBe('above-max');
    });

    it('eine als unknown deklarierte Ebene blockiert die Prüfung nicht', () => {
      expect(checkVoltageCompatibility({ voltageClass: 'unknown' }, volts(12.8)).ok).toBe(true);
    });
  });
});
