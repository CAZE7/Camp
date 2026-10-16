import { expect, it } from 'vitest';
import { improvesRoutingQuality, type RoutingQuality } from './quality';
const baseline: RoutingQuality = {
  valid: true,
  hardViolations: 0,
  lengthPx: 100,
  crossings: 2,
  bends: 4,
  defects: 0,
};
it('never exchanges hard conditions for better soft metrics', () => {
  expect(
    improvesRoutingQuality(
      { ...baseline, valid: false, hardViolations: 1, lengthPx: 1, crossings: 0, bends: 0 },
      baseline
    )
  ).toBe(false);
});
it('rejects cosmetic tradeoffs and equal quality; accepts strict Pareto improvement', () => {
  expect(improvesRoutingQuality({ ...baseline, lengthPx: 101, crossings: 0 }, baseline)).toBe(false);
  expect(improvesRoutingQuality(baseline, baseline)).toBe(false);
  expect(improvesRoutingQuality({ ...baseline, crossings: 1 }, baseline)).toBe(true);
});
