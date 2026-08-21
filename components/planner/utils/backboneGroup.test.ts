import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { BACKBONE_GROUP_ID, withBackboneGroup } from './backboneGroup';

const node = (id: string, type: string, x: number, y: number): Node => ({
  id, type, position: { x, y }, width: 192, height: 120, data: {},
});

describe('backbone visual grouping', () => {
  const nodes = [node('battery', 'battery', 100, 100), node('shunt', 'shunt', 400, 240), node('load', 'consumer', 800, 100)];

  it('adds a non-interactive frame around core nodes only', () => {
    const grouped = withBackboneGroup(nodes, true);
    const frame = grouped.find((item) => item.id === BACKBONE_GROUP_ID)!;
    expect(frame.type).toBe('backboneGroup');
    expect(frame.selectable).toBe(false);
    expect(frame.draggable).toBe(false);
    expect(frame.position.x).toBeLessThan(100);
    expect(frame.position.y).toBeLessThan(100);
    expect(Number(frame.style?.width)).toBeGreaterThan(492);
  });

  it('does nothing when disabled or fewer than two core nodes exist', () => {
    expect(withBackboneGroup(nodes, false)).toBe(nodes);
    const oneCore = [nodes[0], nodes[2]];
    expect(withBackboneGroup(oneCore, true)).toBe(oneCore);
  });
});
