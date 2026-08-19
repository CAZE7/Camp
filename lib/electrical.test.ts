import { describe, it, expect } from 'vitest';
import {
  DERATE_FACTOR,
  FUSE_MAP,
  VDE_AMPACITY,
  calculateMaxFuse,
  lookupThermalCrossSection,
  calculateCrossSection,
  getEdgeDomain,
  getHandleDomain,
  VDE_COPPER_RESISTIVITY,
  VDE_COPPER_CONDUCTIVITY,
  VDE_MAX_DROP_VOLTS_DC_12V,
  VDE_MAX_DROP_VOLTS_AC_230V,
} from './electrical';

describe('electrical safety refactoring tests', () => {
  it('should have the correct DERATE_FACTOR', () => {
    expect(DERATE_FACTOR).toBe(0.70);
  });

  it('should expose unified copper constants', () => {
    expect(VDE_COPPER_RESISTIVITY).toBe(0.0175);
    expect(VDE_COPPER_CONDUCTIVITY).toBeCloseTo(1 / 0.0175, 5);
    expect(VDE_MAX_DROP_VOLTS_DC_12V).toBeCloseTo(1.2, 5);
    expect(VDE_MAX_DROP_VOLTS_AC_230V).toBeCloseTo(6.9, 5);
  });

  it('FUSE_MAP values must never exceed VDE_AMPACITY (conductor protection)', () => {
    for (const cs of Object.keys(FUSE_MAP)) {
      const fuse = FUSE_MAP[Number(cs)];
      const ampacity = VDE_AMPACITY[Number(cs)];
      expect(fuse).toBeLessThanOrEqual(ampacity);
    }
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

  it('falls back to minimum cross section for zero/negative current', () => {
    expect(lookupThermalCrossSection(0)).toBe(1.5);
    expect(lookupThermalCrossSection(-10)).toBe(1.5);
  });

  it('should calculate AC_230V cross section using 3% (6.9V) drop limit', () => {
    // Thermal dimensioning dominates in these examples (10A -> 1.5, 30A -> 10).
    expect(calculateCrossSection(10, 5, undefined, 'AC_230V')).toBe(1.5);
    expect(calculateCrossSection(30, 10, undefined, 'AC_230V')).toBe(10.0);
    expect(calculateCrossSection(30, 10, 16.0, 'AC_230V')).toBe(16.0);
  });

  it('should calculate DC_12V cross section using 10% (1.2V) drop limit', () => {
    // 50A over 10m: dropArea = 50 * 20 / (57.14 * 1.2) = 14.58 mm² -> 16.
    // Thermal lookup for 50A: requiredAmpacity = 71.4A -> 25mm² -> wins.
    const longHighCurrent = calculateCrossSection(50, 10, undefined, 'DC_12V');
    expect(longHighCurrent).toBe(25.0);

    // Short small load is dominated by the 1.5 mm² minimum / thermal lookup.
    expect(calculateCrossSection(5, 1, undefined, 'DC_12V')).toBe(1.5);
  });

  it('returns minimum cross section for zero current or zero length', () => {
    expect(calculateCrossSection(0, 5)).toBe(1.5);
    expect(calculateCrossSection(10, 0)).toBe(1.5);
  });

  it('should identify inverter AC handles correctly in getEdgeDomain', () => {
    // Inverter AC source output -> consumer230v
    expect(getEdgeDomain('inverter', 'consumer230v', 'plus', 'plus')).toBe('AC_230V');
    expect(getEdgeDomain('inverter', 'consumer230v', 'ac_out', 'L')).toBe('AC_230V');
    expect(getEdgeDomain('inverter', 'consumer230v', 'output', 'plus')).toBe('AC_230V');

    // Shore power / consumer230v nodes dominate regardless of handle
    expect(getEdgeDomain('shorePower', 'inverter', 'plus', 'ac_in')).toBe('AC_230V');

    // DC handles or unrelated handles should return DC_12V
    expect(getEdgeDomain('inverter', 'battery', 'minus', 'minus')).toBe('DC_12V');
    expect(getEdgeDomain('inverter', 'battery', 'ground', 'ground')).toBe('DC_12V');
  });

  it('classifies the battery->inverter DC supply (target "plus") as DC_12V', () => {
    // Regression test: the left inverter TARGET handle "plus" is the 12V DC
    // input from the battery. It must NOT be classified as AC.
    expect(getEdgeDomain('battery', 'inverter', 'plus', 'plus')).toBe('DC_12V');
  });

  it('classifies shorePower -> inverter AC-in as AC_230V', () => {
    expect(getEdgeDomain('shorePower', 'inverter', 'plus', 'ac_in')).toBe('AC_230V');
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
});
