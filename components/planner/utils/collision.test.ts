import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { collidingNodeIds, findNearestFreePosition, nodeRect, rectsOverlap } from './collision';

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

  /**
   * Live nachgestellt am 02.11.2026 auf 12v-planer.de: Batterie einfügen, dann
   * Wechselrichter einfügen — die Karten überlappen sich um 74 Plan-Pixel
   * (148 Bildschirm-Pixel bei Zoom 2). Der Kandidat ist beim Suchlauf noch nicht
   * gemessen und fiel auf die pauschale Rückfallhöhe von 120 px zurück; die
   * 202 px hohe Karte wurde deshalb auf einer Fläche abgelegt, die die 146 px
   * hohe Batterie längst belegt.
   */
  it('weicht auch einem ungemessenen Kandidaten nach seiner echten Kartenhöhe aus', () => {
    const existing = node('battery-1', 0, 0, 192, 146);
    const candidate: Node = { id: 'new-component', type: 'inverter', data: {}, position: { x: 0, y: 0 } };

    const free = findNearestFreePosition(candidate, [existing]);
    // React Flow misst die Karte erst nach dem Einfügen — dann darf nichts überlappen.
    const mounted = { ...candidate, position: free, measured: { width: 192, height: 202 } };
    expect(collidingNodeIds(mounted, [existing])).toEqual([]);
  });
});
