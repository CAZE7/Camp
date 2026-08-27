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

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id, type, position: { x: 0, y: 0 }, data,
});

describe('three-column cleanup layout', () => {
  it('classifies components into 5 E-CAD industry pipeline ranks', () => {
    for (const type of ['solar', 'shorePower']) expect(getNodeLayoutRank(node(type, type))).toBe(0);
    for (const type of ['mpptController', 'dcdcCharger']) expect(getNodeLayoutRank(node(type, type))).toBe(1);
    for (const type of ['battery', 'shunt', 'busbar', 'fuse']) expect(getNodeLayoutRank(node(type, type))).toBe(2);
    for (const type of ['inverter']) expect(getNodeLayoutRank(node(type, type))).toBe(3);
    for (const type of ['consumer', 'consumer230v']) expect(getNodeLayoutRank(node(type, type))).toBe(4);
  });

  it('prefers measured dimensions and otherwise uses type/default fallbacks', () => {
    expect(getNodeLayoutSize({ ...node('g', 'ground'), width: 300, height: 40 })).toEqual({ width: 300, height: 40 });
    expect(getNodeLayoutSize(node('g', 'ground'))).toEqual({ width: 128, height: 88 });
    expect(getNodeLayoutSize(node('c', 'conduit'))).toEqual({ width: 256, height: 148 });
    expect(getNodeLayoutSize(node('b', 'battery'))).toEqual({ width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT });
  });

  it('handles an empty graph and preserves edge identities', () => {
    expect(getLayoutedElements([], [])).toEqual({ nodes: [], edges: [] });
    const nodes = [node('battery', 'battery'), node('load', 'consumer')];
    const edges: Edge[] = [{ id: 'edge', source: 'battery', target: 'load' }];
    expect(getLayoutedElements(nodes, edges).edges).toBe(edges);
  });

  it('places source, distribution and load left-to-right with 180 px clear gaps', () => {
    const input = [node('solar', 'solar'), node('fuse', 'fuse'), node('load', 'consumer')];
    const { nodes } = getLayoutedElements(input, []);
    const solar = nodes.find((item) => item.id === 'solar')!;
    const fuse = nodes.find((item) => item.id === 'fuse')!;
    const load = nodes.find((item) => item.id === 'load')!;
    expect(solar.position.x).toBe(LAYOUT_MARGIN);
    expect(fuse.position.x - (solar.position.x + DEFAULT_NODE_WIDTH)).toBe(LAYOUT_RANKSEP);
    expect(load.position.x - (fuse.position.x + DEFAULT_NODE_WIDTH)).toBe(LAYOUT_RANKSEP);
  });

  it('sorts vertically by type hierarchy and leaves 120 px between cards', () => {
    const input = [
      node('fuse', 'fuse'),
      node('busbar', 'busbar'),
      node('shunt', 'shunt'),
    ];
    const { nodes } = getLayoutedElements(input, []);
    const ordered = [...nodes].sort((a, b) => a.position.y - b.position.y);
    expect(ordered.map((item) => item.id)).toEqual(['shunt', 'busbar', 'fuse']);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      expect(ordered[index].position.y - (previous.position.y + getNodeLayoutSize(previous).height)).toBe(LAYOUT_NODESEP);
    }
  });

  it('does not overlap differently sized nodes in any column', () => {
    const input = [
      { ...node('solar', 'solar'), width: 320, height: 160 },
      { ...node('battery', 'battery'), width: 180, height: 100 },
      { ...node('conduit', 'conduit'), width: 400, height: 200 },
      { ...node('load', 'consumer'), width: 280, height: 180 },
    ];
    const { nodes } = getLayoutedElements(input, []);
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const one = nodes[a];
        const two = nodes[b];
        const s1 = getNodeLayoutSize(one);
        const s2 = getNodeLayoutSize(two);
        const overlap = one.position.x < two.position.x + s2.width && one.position.x + s1.width > two.position.x &&
          one.position.y < two.position.y + s2.height && one.position.y + s1.height > two.position.y;
        expect(overlap).toBe(false);
      }
    }
  });

  it('uses the same three-column model for water', () => {
    const { nodes } = getLayoutedElements([
      node('tank', 'freshWaterTank'), node('pump', 'pump'), node('sink', 'sink'),
    ], []);
    expect(nodes.find((item) => item.id === 'tank')!.position.x)
      .toBeLessThan(nodes.find((item) => item.id === 'pump')!.position.x);
    expect(nodes.find((item) => item.id === 'pump')!.position.x)
      .toBeLessThan(nodes.find((item) => item.id === 'sink')!.position.x);
  });
});
