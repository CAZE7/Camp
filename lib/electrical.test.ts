import { describe, it, expect } from 'vitest';
import {
  DERATE_FACTOR,
  FUSE_MAP,
  calculateMaxFuse,
  lookupThermalCrossSection,
  calculateCrossSection,
  getEdgeDomain,
  getHandleDomain,
  selectFuseSize,
  isFuseFeasible,
} from './electrical';

describe('electrical safety refactoring tests', () => {
  it('should have the correct DERATE_FACTOR', () => {
    expect(DERATE_FACTOR).toBe(0.70);
  });

  it('should have VDE safety-compliant values in FUSE_MAP', () => {
    expect(FUSE_MAP[1.5]).toBe(16);
    expect(FUSE_MAP[2.5]).toBe(20);
    expect(FUSE_MAP[4.0]).toBe(25);
    expect(FUSE_MAP[6.0]).toBe(32);
    expect(FUSE_MAP[10.0]).toBe(50);
    expect(FUSE_MAP[16.0]).toBe(63);
    expect(FUSE_MAP[25.0]).toBe(80);
    expect(FUSE_MAP[35.0]).toBe(100);
    expect(FUSE_MAP[50.0]).toBe(125);
    expect(FUSE_MAP[70.0]).toBe(160);
  });

  it('should return 0 fallback for non-existing cross sections in calculateMaxFuse', () => {
    expect(calculateMaxFuse(99.0)).toBe(0);
    expect(calculateMaxFuse(12.0)).toBe(0);
  });

  it('should calculate lookupThermalCrossSection using (1 / DERATE_FACTOR)', () => {
    // For 10A current:
    // requiredAmpacity = 10 * (1 / 0.70) = 14.28A
    // VDE_AMPACITY size >= 14.28 is 1.5 (which supports 16.5A)
    expect(lookupThermalCrossSection(10)).toBe(1.5);

    // For 12A current:
    // requiredAmpacity = 12 * (1 / 0.70) = 17.14A
    // VDE_AMPACITY size >= 17.14 is 2.5 (which supports 23A)
    expect(lookupThermalCrossSection(12)).toBe(2.5);

    // For 40A current:
    // requiredAmpacity = 40 * (1 / 0.70) = 57.14A
    // VDE_AMPACITY size >= 57.14 is 16.0 (which supports 69.0A)
    expect(lookupThermalCrossSection(40)).toBe(16.0);
  });

  it('should calculate AC_230V cross section correctly and round up to standard VDE size', () => {
    // Current 10A, length 5m:
    // dropAreaAC = (10 * 5 * 2) / (58 * 4.6) = 100 / 266.8 = 0.37 mm²
    // thermalAreaAC = lookupThermalCrossSection(10) = 1.5 mm²
    // max(1.5, 0.37, 1.5, 0) = 1.5 => VDE standard size >= 1.5 is 1.5
    expect(calculateCrossSection(10, 5, undefined, 'AC_230V')).toBe(1.5);

    // Current 30A, length 10m:
    // dropAreaAC = (30 * 10 * 2) / (58 * 4.6) = 600 / 266.8 = 2.25 mm²
    // thermalAreaAC = lookupThermalCrossSection(30) = 10.0 mm² (requiredAmpacity = 30 / 0.7 = 42.85A, size >= 42.85 is 10.0)
    // max(1.5, 2.25, 10.0, 0) = 10.0 => standard size is 10.0
    expect(calculateCrossSection(30, 10, undefined, 'AC_230V')).toBe(10.0);

    // Current 30A, length 10m, but overridden by larger dataCrossSection (16.0):
    expect(calculateCrossSection(30, 10, 16.0, 'AC_230V')).toBe(16.0);
  });

  it('should identify inverter AC handles correctly in getEdgeDomain', () => {
    expect(getEdgeDomain('inverter', 'consumer230v', 'ac_out')).toBe('AC_230V');
    expect(getEdgeDomain('inverter', 'consumer230v', 'plus')).toBe('AC_230V');
    expect(getEdgeDomain('inverter', 'consumer230v', 'L')).toBe('AC_230V');
    expect(getEdgeDomain('inverter', 'consumer230v', 'ac')).toBe('AC_230V');
    expect(getEdgeDomain('inverter', 'consumer230v', 'output')).toBe('AC_230V');

    // DC handles or unrelated handles should return DC_12V
    expect(getEdgeDomain('inverter', 'battery', 'minus')).toBe('DC_12V');
    expect(getEdgeDomain('inverter', 'battery', 'ground')).toBe('DC_12V');

    // Test target AC handles
    expect(getEdgeDomain('battery', 'inverter', null, 'ac_out')).toBe('AC_230V');
    expect(getEdgeDomain('battery', 'inverter', null, 'plus')).toBe('AC_230V');
    expect(getEdgeDomain('battery', 'inverter', null, 'L')).toBe('AC_230V');
    expect(getEdgeDomain('battery', 'inverter', null, 'ac')).toBe('AC_230V');
    expect(getEdgeDomain('battery', 'inverter', null, 'output')).toBe('AC_230V');

    // Test target non-AC handles
    expect(getEdgeDomain('battery', 'inverter', null, 'minus')).toBe('DC_12V');
    expect(getEdgeDomain('battery', 'inverter', null, 'ground')).toBe('DC_12V');
  });

  it('should identify inverter AC handles correctly in getHandleDomain', () => {
    expect(getHandleDomain('inverter', 'ac_out', 'source')).toBe('AC_230V');
    expect(getHandleDomain('inverter', 'plus', 'source')).toBe('AC_230V');
    expect(getHandleDomain('inverter', 'ac', 'source')).toBe('AC_230V');
    expect(getHandleDomain('inverter', 'minus', 'source')).toBe('DC_12V');
    // InverterNode: left target plus is the 12V DC input, not the AC output
    expect(getHandleDomain('inverter', 'plus', 'target')).toBe('DC_12V');
    expect(getHandleDomain('inverter', 'ac_in', 'target')).toBe('AC_230V');
  });

  it('selectFuseSize never exceeds the cable maximum (FUSE_MAP)', () => {
    // 1,5 mm² darf max. 16 A abgesichert werden. Bei 17 A Nennstrom
    // darf KEINE 20-A-Sicherung empfohlen werden (Brandgefahr).
    expect(selectFuseSize(17, 1.5)).toBeLessThanOrEqual(FUSE_MAP[1.5]);
    expect(selectFuseSize(17, 1.5)).toBe(16);

    // 2,5 mm² max 20 A.
    expect(selectFuseSize(21, 2.5)).toBeLessThanOrEqual(FUSE_MAP[2.5]);
    expect(selectFuseSize(21, 2.5)).toBe(20);

    // Normalfall: kleinste passende Norm-Sicherung.
    expect(selectFuseSize(10, 2.5)).toBe(10);
    expect(selectFuseSize(16, 1.5)).toBe(16);
  });

  it('isFuseFeasible indicates whether a cable can carry the current', () => {
    expect(isFuseFeasible(10, 1.5)).toBe(true);
    expect(isFuseFeasible(16, 1.5)).toBe(true);
    expect(isFuseFeasible(17, 1.5)).toBe(false);
    expect(isFuseFeasible(0, 1.5)).toBe(true);
  });
});
