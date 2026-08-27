import { describe, it, expect } from 'vitest';
import { isBackboneConnection } from './backbone';

describe('isBackboneConnection', () => {
  it('treats core distribution links as backbone', () => {
    expect(isBackboneConnection('battery', 'busbar')).toBe(true);
    expect(isBackboneConnection('busbar', 'fuse')).toBe(true);
    expect(isBackboneConnection('battery', 'shunt')).toBe(true);
  });

  it('treats branches to consumers/chargers as non-backbone', () => {
    expect(isBackboneConnection('fuse', 'consumer')).toBe(false);
    expect(isBackboneConnection('busbar', 'inverter')).toBe(false);
    expect(isBackboneConnection('battery', 'consumer')).toBe(false);
  });

  it('returns false for missing types', () => {
    expect(isBackboneConnection(undefined, 'busbar')).toBe(false);
    expect(isBackboneConnection('battery', undefined)).toBe(false);
  });
});
