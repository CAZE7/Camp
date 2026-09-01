import { describe, it, expect } from 'vitest';
import { getWireColor, WIRE_COLORS, type WireDomain } from './edgeColors';

describe('getWireColor', () => {
  it('maps 12V DC plus to the red plus token', () => {
    expect(getWireColor({ edgeDomain: 'DC_12V' as WireDomain, isPlus: true })).toBe(WIRE_COLORS.dcPlus);
  });

  it('maps 12V DC minus to the dark minus token', () => {
    expect(getWireColor({ edgeDomain: 'DC_12V' as WireDomain, isPlus: false })).toBe(WIRE_COLORS.dcMinus);
  });

  it('maps 230V AC to the blue AC token', () => {
    expect(getWireColor({ edgeDomain: 'AC_230V' })).toBe(WIRE_COLORS.ac);
  });

  it('maps Solar to the amber token', () => {
    expect(getWireColor({ edgeDomain: 'Solar' })).toBe(WIRE_COLORS.solar);
  });
});
