import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  collidingNodeIds,
  findNearestFreePosition,
  nodeRect,
  PALETTE_PLACEMENT_PADDING,
  rectsOverlap,
  segmentIntersectsRect,
} from './collision';

const node = (id: string, x: number, y: number, width = 192, height = 120): Node => ({
  id,
  type: 'battery',
  position: { x, y },
  width,
  height,
  data: {},
});

describe('node collision resolution', () => {
  it('detects positive-area overlap but permits touching borders', () => {
    expect(rectsOverlap(nodeRect(node('a', 0, 0, 100, 100)), nodeRect(node('b', 99, 0, 100, 100)))).toBe(
      true
    );
    expect(rectsOverlap(nodeRect(node('a', 0, 0, 100, 100)), nodeRect(node('b', 100, 0, 100, 100)))).toBe(
      false
    );
  });

  it('returns all colliding nodes except itself', () => {
    const dragged = node('dragged', 40, 40, 100, 100);
    expect(
      collidingNodeIds(dragged, [dragged, node('a', 0, 0, 80, 80), node('b', 120, 120, 80, 80)]).sort()
    ).toEqual(['a', 'b']);
  });

  it('snaps a free position to the 16 px grid', () => {
    expect(findNearestFreePosition(node('a', 17, 31), [node('a', 17, 31)])).toEqual({ x: 16, y: 32 });
  });

  it('finds the nearest collision-free grid position', () => {
    const dragged = node('dragged', 0, 0, 32, 32);
    const blockers = [dragged, node('blocker', 0, 0, 32, 32)];
    const free = findNearestFreePosition(dragged, blockers);
    expect(Math.abs(free.x % 16)).toBe(0);
    expect(Math.abs(free.y % 16)).toBe(0);
    expect(collidingNodeIds({ ...dragged, position: free }, blockers)).toEqual([]);
    expect(Math.hypot(free.x, free.y)).toBeLessThanOrEqual(48);
  });

  it('M16: avoids existing routed cable corridors and preserves clearance padding on palette drop', () => {
    const candidate = node('new-component', 200, 100, 192, 120);
    const existing = [node('fuse-1', 0, 100, 192, 120)];
    // Horizontal cable running across y = 160 from x = 192 to x = 800
    const cables = [{ x1: 192, y1: 160, x2: 800, y2: 160 }];
    const placed = findNearestFreePosition(candidate, existing, [16, 16], 128, {
      padding: PALETTE_PLACEMENT_PADDING,
      routedSegments: cables,
    });
    expect(collidingNodeIds(candidate, existing, placed, PALETTE_PLACEMENT_PADDING)).toEqual([]);
    const placedRect = nodeRect(candidate, placed);
    expect(segmentIntersectsRect(cables[0]!, placedRect)).toBe(false);
  });
});
