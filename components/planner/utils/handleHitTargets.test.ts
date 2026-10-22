import { describe, expect, it } from 'vitest';
import { HANDLE_HIT_TARGET_SCREEN_PX, separateHandleHitTargets } from './handleHitTargets';

describe('screen-space handle targets', () => {
  it('uses the 44 px minimum target size', () => {
    expect(HANDLE_HIT_TARGET_SCREEN_PX).toBe(44);
  });

  it('keeps already separated ports in place', () => {
    expect(separateHandleHitTargets([10, 60])).toEqual([0, 0]);
  });

  it('separates close plus/minus targets symmetrically at low zoom', () => {
    const offsets = separateHandleHitTargets([5, 23]);
    const centers = [5 + (offsets[0] ?? 0), 23 + (offsets[1] ?? 0)];

    expect(offsets).toEqual([-13, 13]);
    expect(centers[1]! - centers[0]!).toBe(HANDLE_HIT_TARGET_SCREEN_PX);
  });

  it('preserves input order while resolving an out-of-order group', () => {
    const offsets = separateHandleHitTargets([23, 5]);
    const centers = [23 + (offsets[0] ?? 0), 5 + (offsets[1] ?? 0)].sort((a, b) => a - b);

    expect(offsets).toEqual([13, -13]);
    expect(centers[1]! - centers[0]!).toBe(HANDLE_HIT_TARGET_SCREEN_PX);
  });

  it('separates chains of nearby handles with the smallest centered correction', () => {
    const offsets = separateHandleHitTargets([0, 20, 40]);
    const centers = [0 + (offsets[0] ?? 0), 20 + (offsets[1] ?? 0), 40 + (offsets[2] ?? 0)];

    expect(offsets).toEqual([-24, 0, 24]);
    expect(centers[1]! - centers[0]!).toBe(HANDLE_HIT_TARGET_SCREEN_PX);
    expect(centers[2]! - centers[1]!).toBe(HANDLE_HIT_TARGET_SCREEN_PX);
  });
});
