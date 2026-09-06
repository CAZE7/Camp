import { describe, expect, it } from 'vitest';
import {
  DagreLayoutEngine,
  snapLayoutToGrid,
  toLayoutEdges,
  toLayoutNodes,
  type LayoutEngine,
} from './elkAdapter';

describe('ELK adapter', () => {
  it('converts planner nodes/edges to layout input', () => {
    const nodes = toLayoutNodes([
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 0, y: 0 }, data: {} },
    ]);
    expect(nodes).toEqual([
      { id: 'a', width: 200, height: 100 },
      { id: 'b', width: 200, height: 100 },
    ]);

    const edges = toLayoutEdges([
      { id: 'e1', source: 'a', target: 'b' },
    ]);
    expect(edges).toEqual([{ id: 'e1', source: 'a', target: 'b' }]);
  });

  it('snaps layout positions deterministically onto the grid', () => {
    const snapped = snapLayoutToGrid({
      positions: new Map([['a', { x: 27, y: 45 }]]),
    });
    expect(snapped.positions.get('a')).toEqual({ x: 32, y: 32 });
  });

  it('dagre fallback lays out a small graph', async () => {
    const engine: LayoutEngine = new DagreLayoutEngine();
    const result = await engine.layout(
      [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
      ],
      [{ id: 'e1', source: 'a', target: 'b' }],
      { direction: 'LR' }
    );
    expect(result.positions.has('a')).toBe(true);
    expect(result.positions.has('b')).toBe(true);
    const a = result.positions.get('a')!;
    const b = result.positions.get('b')!;
    // left-to-right: b liegt rechts von a
    expect(b.x).toBeGreaterThan(a.x);
  });
});
