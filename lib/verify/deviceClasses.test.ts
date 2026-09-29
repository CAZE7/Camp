import { describe, expect, it } from 'vitest';

import { FUSE_TYPES } from '../shortCircuit';

import {
  breakingCapacityOf,
  conventionalOperatingCurrentI2,
  describeDevice,
  iec60269Ratio,
  isFuse,
  isOvercurrentProtection,
  productClassOfFuseType,
  providesOverloadProtection,
  tableBreakingCapacityA,
} from './deviceClasses';
import type { FuseProductClass, ProtectionDevice } from './types';

const fuse = (overrides: Partial<Extract<ProtectionDevice, { type: 'fuse' }>> = {}): ProtectionDevice => ({
  type: 'fuse',
  productClass: 'iso8820-blade',
  variant: 'ato',
  ratedCurrentA: 20,
  ...overrides,
});

describe('lib/verify/deviceClasses — Produktklassen', () => {
  it('ordnet jede Planer-Bauform genau einer Produktklasse zu', () => {
    const expected: Record<string, FuseProductClass> = {
      ato: 'iso8820-blade',
      classT: 'ul248-classT',
      midi: 'bolt-down',
      mega: 'bolt-down',
      anl: 'bolt-down',
      mrbf: 'bolt-down',
    };
    for (const variant of FUSE_TYPES) {
      expect(productClassOfFuseType(variant)).toBe(expected[variant]);
    }
  });

  it('erkennt Überstromschutz (RCD zählt ausdrücklich nicht dazu)', () => {
    expect(isFuse(fuse())).toBe(true);
    expect(providesOverloadProtection(fuse())).toBe(true);
    expect(isOvercurrentProtection(fuse())).toBe(true);
    const rcd: ProtectionDevice = {
      type: 'rcd',
      ratedResidualCurrentA: 0.03,
      residualType: 'A',
    };
    expect(isFuse(rcd)).toBe(false);
    expect(providesOverloadProtection(rcd)).toBe(false);
    expect(isOvercurrentProtection(rcd)).toBe(false);
    const mcb: ProtectionDevice = { type: 'mcb', characteristic: 'B', ratedCurrentA: 16 };
    expect(isOvercurrentProtection(mcb)).toBe(true);
    expect(isFuse(mcb)).toBe(false);
  });
});

describe('lib/verify/deviceClasses — konventioneller Auslösestrom I₂', () => {
  it('gibt dem Datenblattwert Vorrang vor jeder Produktnorm', () => {
    const result = conventionalOperatingCurrentI2(fuse({ i2A: 47.5 }));
    expect(result.i2A).toBe(47.5);
    expect(result.ratio).toBeCloseTo(47.5 / 20, 9);
    expect(result.provenance).toBe('VERIFIED_DATASHEET');
  });

  it('nutzt die Produktnorm, wo sie belegt ist (LS 1,45 × In, Blade 1,35 × In)', () => {
    const mcb = conventionalOperatingCurrentI2({ type: 'mcb', characteristic: 'B', ratedCurrentA: 16 });
    expect(mcb.i2A).toBeCloseTo(1.45 * 16, 9);
    expect(mcb.ratio).toBe(1.45);
    expect(mcb.provenance).toBe('VERIFIED_NORM');

    const blade = conventionalOperatingCurrentI2(fuse({ ratedCurrentA: 10 }));
    expect(blade.i2A).toBeCloseTo(13.5, 9);
    expect(blade.ratio).toBe(1.35);
  });

  it('meldet für Bolzen-/Class-T-Sicherungen UNPROVABLE statt zu schätzen', () => {
    for (const productClass of ['bolt-down', 'ul248-classT'] as const) {
      const result = conventionalOperatingCurrentI2(fuse({ productClass, variant: null }));
      expect(result.i2A).toBeNull();
      expect(result.ratio).toBeNull();
      expect(result.provenance).toBe('UNVERIFIED');
      expect(result.remedy).toBeTruthy();
    }
  });

  it('wendet §433.1 nicht auf den RCD an', () => {
    const result = conventionalOperatingCurrentI2({
      type: 'rcd',
      ratedResidualCurrentA: 0.03,
      residualType: 'A',
    });
    expect(result.i2A).toBeNull();
    expect(result.provenance).toBe('DERIVED');
  });

  it('liefert die gG-Stromabhängigkeit (IEC 60269-1)', () => {
    expect(iec60269Ratio(2)).toBe(2.1);
    expect(iec60269Ratio(10)).toBe(1.9);
    expect(iec60269Ratio(63)).toBe(1.6);
  });
});

describe('lib/verify/deviceClasses — Abschaltvermögen', () => {
  it('nimmt Datenblatt vor Tabelle und meldet Unbelegtes als null', () => {
    expect(breakingCapacityOf(fuse({ breakingCapacityA: 3000 }))).toBe(3000);
    expect(breakingCapacityOf(fuse({ variant: 'ato' }))).toBe(tableBreakingCapacityA('ato'));
    // Ohne Bauform UND ohne Datenblattwert: kein stiller Rückgriff auf den
    // kleinsten Tabellenwert.
    expect(breakingCapacityOf(fuse({ variant: null }))).toBeNull();
    expect(breakingCapacityOf({ type: 'mcb', characteristic: 'C', ratedCurrentA: 16 })).toBeNull();
    expect(
      breakingCapacityOf({ type: 'mcb', characteristic: 'C', ratedCurrentA: 16, breakingCapacityKA: 6 })
    ).toBe(6000);
    expect(breakingCapacityOf({ type: 'rcd', ratedResidualCurrentA: 0.03, residualType: 'B' })).toBeNull();
  });

  it('beschreibt Schutzorgane für den Report', () => {
    expect(describeDevice(fuse({ ratedCurrentA: 25 }))).toContain('25');
    expect(describeDevice({ type: 'mcb', characteristic: 'B', ratedCurrentA: 16 })).toContain('16');
    expect(describeDevice({ type: 'rcd', ratedResidualCurrentA: 0.03, residualType: 'A' })).toContain('30');
  });
});

describe('lib/verify/deviceClasses — Datenblatt schlägt Produktnorm', () => {
  it('nimmt einen hinterlegten I₂-Wert vor jeder Tabellenannahme', () => {
    const declared = conventionalOperatingCurrentI2(fuse({ i2A: 30 }));
    expect(declared.i2A).toBe(30);
    expect(declared.ratio).toBeCloseTo(1.5, 6);
    expect(declared.provenance).toBe('VERIFIED_DATASHEET');
    expect(declared.remedy).toBeNull();
  });

  it('verlangt für Bauformen ohne belegtes I₂ ein Datenblatt (Remedy statt Zahl)', () => {
    const boltDown = conventionalOperatingCurrentI2(
      fuse({ productClass: 'bolt-down', variant: 'midi', ratedCurrentA: 100 })
    );
    expect(boltDown.i2A).toBeNull();
    expect(boltDown.provenance).toBe('UNVERIFIED');
    expect(boltDown.remedy).toContain('i2A');

    const classT = conventionalOperatingCurrentI2(fuse({ productClass: 'ul248-classT', variant: 'classT' }));
    expect(classT.i2A).toBeNull();
    expect(classT.remedy).toBe(boltDown.remedy);
  });

  it('weist unbekannte Produktklassen und Bauformen zurück', () => {
    expect(() =>
      conventionalOperatingCurrentI2(fuse({ productClass: 'erfunden' as never, variant: null }))
    ).toThrow(/Produktklasse/);
    expect(() => productClassOfFuseType('erfunden' as never)).toThrow(/Bauform/);
  });

  it('belegt I₂ für gG-Sicherungen über die IEC-60269-Tabelle', () => {
    const gg = conventionalOperatingCurrentI2(
      fuse({ productClass: 'iec60269-gg', variant: null, ratedCurrentA: 20 })
    );
    expect(gg.i2A).toBeCloseTo(iec60269Ratio(20) * 20, 9);
    expect(gg.provenance).toBe('VERIFIED_NORM');
    expect(gg.i2A!).toBeGreaterThan(1.45 * 20); // gG ist träger als ein LS
  });
});
