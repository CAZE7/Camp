import { describe, it, expect } from 'vitest';
import { hasVoltageDropError, edgeDropInputs } from './voltageDrop';

describe('hasVoltageDropError', () => {
  it('returns false for AC edges (no drop check)', () => {
    expect(
      hasVoltageDropError({
        isAC: true,
        I: 0,
        length: 5,
        crossSection: 1.5,
        sysVoltage: 230,
        cumulativeDropVolts: 10,
      })
    ).toEqual({ totalDropPercentage: 0, hasDropError: false });
  });

  it('flags a DC edge with a total drop above 3%', () => {
    // ownDrop = 10 * (5*2) / (58*1.5) ≈ 1.149 V → 9.6% bei 12V
    const result = hasVoltageDropError({
      isAC: false,
      I: 10,
      length: 5,
      crossSection: 1.5,
      sysVoltage: 12,
      cumulativeDropVolts: 0,
    });
    expect(result.hasDropError).toBe(true);
    expect(result.totalDropPercentage).toBeGreaterThan(3);
  });

  it('does not flag a DC edge with negligible drop', () => {
    const result = hasVoltageDropError({
      isAC: false,
      I: 1,
      length: 0.2,
      crossSection: 10,
      sysVoltage: 12,
      cumulativeDropVolts: 0,
    });
    expect(result.hasDropError).toBe(false);
  });
});

describe('edgeDropInputs', () => {
  it('detects AC edges from data', () => {
    const inputs = edgeDropInputs(
      { id: 'e1', source: 'a', target: 'b', data: { length: 2, edgeDomain: 'AC_230V' } },
      undefined,
      undefined,
      []
    );
    expect(inputs.isAC).toBe(true);
  });

  it('derives DC inputs from length and cross-section', () => {
    const inputs = edgeDropInputs(
      { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 4 } },
      { id: 'a', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 12 } },
      { id: 'b', type: 'battery', position: { x: 100, y: 0 }, data: {} },
      []
    );
    expect(inputs.isAC).toBe(false);
    expect(inputs.length).toBe(3);
  });
});
