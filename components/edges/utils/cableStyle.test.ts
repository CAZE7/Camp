import { describe, it, expect } from 'vitest';
import {
  cableStrokeWidth,
  BACKBONE_STROKE_WIDTH,
  NORMAL_STROKE_WIDTH,
  TRUNK_BRANCH_STROKE_WIDTH,
  SOLAR_STROKE_WIDTH,
  CAN_STROKE_WIDTH,
  SENSOR_STROKE_WIDTH,
} from './cableStyle';

describe('cableStrokeWidth', () => {
  it('draws backbone cables at 3 px (Dark Engineering) and normal cables at 2 px (D-4)', () => {
    // Perfekte Lösung: MAIN 3px per Modul 2 (vorher 4px Werft)
    expect(cableStrokeWidth({ isBackbone: true })).toBe(3);
    expect(cableStrokeWidth({ isBackbone: false })).toBe(2);
    expect(BACKBONE_STROKE_WIDTH).toBe(3);
    expect(NORMAL_STROKE_WIDTH).toBe(2);
  });

  it('adds one pixel on hover/selection as pointer-independent feedback', () => {
    expect(cableStrokeWidth({ isBackbone: false, emphasized: true })).toBe(3);
    expect(cableStrokeWidth({ isBackbone: true, emphasized: true })).toBe(4);
  });

  it('thins out branches in trunk mode while keeping the backbone at 3 px', () => {
    expect(cableStrokeWidth({ isBackbone: false, trunkMode: true })).toBe(TRUNK_BRANCH_STROKE_WIDTH);
    expect(cableStrokeWidth({ isBackbone: true, trunkMode: true })).toBe(BACKBONE_STROKE_WIDTH);
  });

  it('supports role-based hierarchy (Modul 2 — MAIN 3px, BRANCH 2px, CAN/SENSOR filigran)', () => {
    expect(cableStrokeWidth({ role: 'dcMain' })).toBe(3);
    expect(cableStrokeWidth({ role: 'dcBranch' })).toBe(2);
    expect(cableStrokeWidth({ role: 'solarMain' })).toBe(SOLAR_STROKE_WIDTH);
    expect(cableStrokeWidth({ role: 'canBus' })).toBe(CAN_STROKE_WIDTH);
    expect(cableStrokeWidth({ role: 'sensor' })).toBe(SENSOR_STROKE_WIDTH);
    expect(cableStrokeWidth({ role: 'dcMain', emphasized: true })).toBe(4);
  });

  it('never returns a width below one pixel', () => {
    const widths = [
      cableStrokeWidth({ isBackbone: false, trunkMode: true }),
      cableStrokeWidth({ isBackbone: false }),
      cableStrokeWidth({ isBackbone: true, trunkMode: true, emphasized: true }),
      cableStrokeWidth({ role: 'sensor' }),
    ];
    widths.forEach((width) => expect(width).toBeGreaterThanOrEqual(1));
  });
});
