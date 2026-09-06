import { describe, expect, it } from 'vitest';
import {
  BEND_RADIUS,
  CABLE_CLEARANCE,
  GEOMETRY,
  LANE_GRID,
  STUB_MIN,
  bundleWidth,
  laneOffset,
  roundToLaneGrid,
} from './geometryTokens';
import {
  aabbFromPoints,
  aabbOverlap,
  bendCount,
  inflateAABB,
  isAxisAligned,
  orthogonalLPath,
  pathLength,
  pathSegments,
  pointInAABB,
  roundPathToGrid,
  segmentLength,
} from './primitives';

describe('geometry tokens (single source of truth)', () => {
  it('publishes the agreed V2 base values', () => {
    expect(GEOMETRY.cableClearance).toBe(12);
    expect(GEOMETRY.stubMin).toBe(24);
    expect(GEOMETRY.laneGrid).toBe(16);
    expect(GEOMETRY.bendRadius).toBe(8);
  });

  it('exposes convenient aliases that reference the same values', () => {
    expect(CABLE_CLEARANCE).toBe(12);
    expect(STUB_MIN).toBe(24);
    expect(LANE_GRID).toBe(16);
    expect(BEND_RADIUS).toBe(8);
  });

  it('is frozen so geometry can never be mutated at runtime', () => {
    expect(Object.isFrozen(GEOMETRY)).toBe(true);
    expect(() => {
      (GEOMETRY as any).cableClearance = 999;
    }).toThrow();
  });

  it('rounds to the lane grid deterministically', () => {
    expect(roundToLaneGrid(7)).toBe(0);
    expect(roundToLaneGrid(9)).toBe(16);
    expect(roundToLaneGrid(16)).toBe(16);
    expect(roundToLaneGrid(24)).toBe(32);
    expect(roundToLaneGrid(25)).toBe(32);
    expect(roundToLaneGrid(10, 10)).toBe(10);
  });

  it('computes lane offsets and bundle widths from the clearance token', () => {
    expect(laneOffset(0)).toBe(0);
    expect(laneOffset(1)).toBe(12);
    expect(laneOffset(3)).toBe(36);
    expect(bundleWidth(1)).toBe(0);
    expect(bundleWidth(4)).toBe(36);
  });
});

describe('geometry primitives', () => {
  it('computes segment and path lengths', () => {
    expect(segmentLength({ from: { x: 0, y: 0 }, to: { x: 3, y: 4 } })).toBe(5);
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
      ])
    ).toBe(20);
  });

  it('splits a path into axis-aligned segments', () => {
    const segs = pathSegments([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs.every(isAxisAligned)).toBe(true);
  });

  it('builds an orthogonal L-path with exactly one elbow (2 bends)', () => {
    const path = orthogonalLPath({ x: 0, y: 0 }, { x: 100, y: 40 });
    expect(path).toHaveLength(4);
    expect(bendCount(path)).toBe(2);
  });

  it('rounds a path to the grid', () => {
    const path = roundPathToGrid([
      { x: 7, y: 9 },
      { x: 20, y: 9 },
    ]);
    expect(path[0]).toEqual({ x: 0, y: 16 });
    expect(path[1]).toEqual({ x: 16, y: 16 });
  });

  it('inflates and tests AABBs', () => {
    const box = aabbFromPoints({ x: 10, y: 20 }, { x: 30, y: 40 });
    expect(box).toEqual({ x: 10, y: 20, width: 20, height: 20 });

    const padded = inflateAABB(box, 5);
    expect(padded).toEqual({ x: 5, y: 15, width: 30, height: 30 });

    expect(pointInAABB({ x: 20, y: 30 }, box)).toBe(true);
    expect(pointInAABB({ x: 0, y: 0 }, box)).toBe(false);
  });

  it('detects overlapping and separated AABBs', () => {
    const a = aabbFromPoints({ x: 0, y: 0 }, { x: 10, y: 10 });
    const b = aabbFromPoints({ x: 5, y: 5 }, { x: 15, y: 15 });
    const c = aabbFromPoints({ x: 20, y: 20 }, { x: 30, y: 30 });
    expect(aabbOverlap(a, b)).toBe(true);
    expect(aabbOverlap(a, c)).toBe(false);
  });
});
