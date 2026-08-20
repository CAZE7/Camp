import { describe, it, expect } from 'vitest';
import {
  getLayoutedElements,
  getNodeLayoutRank,
  getNodeLayoutSize,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  LAYOUT_NODESEP,
  LAYOUT_RANKSEP,
  LAYOUT_MARGIN,
} from './layout';
import { Node, Edge } from 'reactflow';

describe('getNodeLayoutRank', () => {
  it('places charge sources left of the battery core and loads right', () => {
    expect(getNodeLayoutRank({ id: 's', type: 'solar', position: { x: 0, y: 0 }, data: {} })).toBe(0);
    expect(getNodeLayoutRank({ id: 'm', type: 'mpptController', position: { x: 0, y: 0 }, data: {} })).toBe(1);
    expect(getNodeLayoutRank({ id: 'b', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Aufbau' } })).toBe(2);
    expect(getNodeLayoutRank({ id: 'f', type: 'fuse', position: { x: 0, y: 0 }, data: {} })).toBe(3);
    expect(getNodeLayoutRank({ id: 'c', type: 'consumer', position: { x: 0, y: 0 }, data: {} })).toBe(4);
  });

  it('treats a starter battery as a source, not as the house battery', () => {
    expect(
      getNodeLayoutRank({ id: 'st', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Starterbatterie' } })
    ).toBe(0);
  });
});

describe('getNodeLayoutSize', () => {
  it('prefers measured dimensions over the type fallback', () => {
    expect(
      getNodeLayoutSize({ id: 'g', type: 'ground', position: { x: 0, y: 0 }, data: {}, width: 300, height: 40 })
    ).toEqual({ width: 300, height: 40 });
  });

  it('uses type-specific sizes for ground and conduit', () => {
    expect(getNodeLayoutSize({ id: 'g', type: 'ground', position: { x: 0, y: 0 }, data: {} })).toEqual({
      width: 128,
      height: 88,
    });
    expect(getNodeLayoutSize({ id: 'c', type: 'conduit', position: { x: 0, y: 0 }, data: {} })).toEqual({
      width: 256,
      height: 148,
    });
  });

  it('falls back to the default 192×120 card', () => {
    expect(getNodeLayoutSize({ id: 'b', type: 'battery', position: { x: 0, y: 0 }, data: {} })).toEqual({
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  });
});

describe('getLayoutedElements', () => {
  it('should handle empty nodes and edges', () => {
    const { nodes, edges } = getLayoutedElements([], []);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it('should layout a single node', () => {
    const inputNodes: Node[] = [{ id: '1', position: { x: 0, y: 0 }, data: {} }];
    const { nodes, edges } = getLayoutedElements(inputNodes, []);

    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('1');
    expect(typeof nodes[0].position.x).toBe('number');
    expect(typeof nodes[0].position.y).toBe('number');
    expect(edges).toEqual([]);
  });

  it('should layout two connected nodes in LR direction', () => {
    const inputNodes: Node[] = [
      { id: '1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'consumer', position: { x: 0, y: 0 }, data: {} },
    ];
    const inputEdges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

    const { nodes, edges } = getLayoutedElements(inputNodes, inputEdges, 'LR');

    expect(nodes.length).toBe(2);
    expect(edges.length).toBe(1);

    const node1 = nodes.find((n) => n.id === '1')!;
    const node2 = nodes.find((n) => n.id === '2')!;

    expect(node2.position.x).toBeGreaterThan(node1.position.x);
  });

  it('snaps functional ranks even without edges: sources, core, loads', () => {
    const inputNodes: Node[] = [
      { id: 'solar', type: 'solar', position: { x: 800, y: 0 }, data: {} },
      { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
      { id: 'load', type: 'consumer', position: { x: 10, y: 0 }, data: {} },
    ];
    const { nodes } = getLayoutedElements(inputNodes, []);
    const solar = nodes.find((n) => n.id === 'solar')!;
    const bat = nodes.find((n) => n.id === 'bat')!;
    const load = nodes.find((n) => n.id === 'load')!;
    expect(solar.position.x).toBeLessThan(bat.position.x);
    expect(bat.position.x).toBeLessThan(load.position.x);
    expect(bat.position.x - solar.position.x).toBeGreaterThanOrEqual(LAYOUT_RANKSEP);
  });

  it('stacks same-rank nodes with nodesep so parallel cables have room', () => {
    const inputNodes: Node[] = [
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: {} },
      { id: 'c2', type: 'consumer', position: { x: 0, y: 0 }, data: {} },
    ];
    const { nodes } = getLayoutedElements(inputNodes, []);
    const dy = Math.abs(nodes[0].position.y - nodes[1].position.y);
    expect(dy).toBeGreaterThanOrEqual(LAYOUT_NODESEP);
  });

  it('does not emit dummy rank nodes', () => {
    const inputNodes: Node[] = [
      { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} },
      { id: 'load', type: 'consumer', position: { x: 0, y: 0 }, data: {} },
    ];
    const { nodes } = getLayoutedElements(inputNodes, []);
    expect(nodes.every((n) => !n.id.startsWith('__rank'))).toBe(true);
    expect(nodes.map((n) => n.id).sort()).toEqual(['bat', 'load']);
  });

  it('keeps water tanks left of taps', () => {
    const inputNodes: Node[] = [
      { id: 'tap', type: 'sink', position: { x: 0, y: 0 }, data: {} },
      { id: 'tank', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} },
    ];
    const { nodes } = getLayoutedElements(inputNodes, []);
    const tank = nodes.find((n) => n.id === 'tank')!;
    const tap = nodes.find((n) => n.id === 'tap')!;
    expect(tank.position.x).toBeLessThan(tap.position.x);
    expect(tank.position.x).toBe(LAYOUT_MARGIN);
  });
});
