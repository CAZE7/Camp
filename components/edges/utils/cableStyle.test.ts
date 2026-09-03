import { describe, it, expect } from 'vitest';
import {
  cableStrokeWidth,
  BACKBONE_STROKE_WIDTH,
  NORMAL_STROKE_WIDTH,
  TRUNK_BRANCH_STROKE_WIDTH,
} from './cableStyle';

describe('cableStrokeWidth', () => {
  it('draws backbone cables at 4 px and normal cables at 2 px (D-4)', () => {
    expect(cableStrokeWidth({ isBackbone: true })).toBe(4);
    expect(cableStrokeWidth({ isBackbone: false })).toBe(2);
    expect(BACKBONE_STROKE_WIDTH).toBe(4);
    expect(NORMAL_STROKE_WIDTH).toBe(2);
  });

  it('adds one pixel on hover/selection as pointer-independent feedback', () => {
    expect(cableStrokeWidth({ isBackbone: false, emphasized: true })).toBe(3);
    expect(cableStrokeWidth({ isBackbone: true, emphasized: true })).toBe(5);
  });

  it('thins out branches in trunk mode while keeping the backbone at 4 px', () => {
    expect(cableStrokeWidth({ isBackbone: false, trunkMode: true })).toBe(TRUNK_BRANCH_STROKE_WIDTH);
    expect(cableStrokeWidth({ isBackbone: true, trunkMode: true })).toBe(BACKBONE_STROKE_WIDTH);
  });

  it('never returns a width below one pixel', () => {
    const widths = [
      cableStrokeWidth({ isBackbone: false, trunkMode: true }),
      cableStrokeWidth({ isBackbone: false }),
      cableStrokeWidth({ isBackbone: true, trunkMode: true, emphasized: true }),
    ];
    widths.forEach((width) => expect(width).toBeGreaterThanOrEqual(1));
  });
});
