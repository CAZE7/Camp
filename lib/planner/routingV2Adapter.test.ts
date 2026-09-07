import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { applyAdvancedLayout, routeEdgesV2 } from './routingV2Adapter';
import type { CableEdgeData } from '../../components/edges/CableEdge';

const node = (id: string, type: string, x: number, y: number): Node => ({
  id,
  type,
  position: { x, y },
  data: { label: id },
  width: 120,
  height: 80,
});

const edge = (id: string, source: string, target: string): Edge<CableEdgeData> => ({
  id,
  source,
  target,
  type: 'cableEdge',
  data: { length: 1 },
});

describe('routingV2Adapter - advanced layout integration', () => {
  it('routeEdgesV2 attaches a routed polyline to every routable edge', () => {
    const nodes = [node('a', 'battery', 0, 0), node('b', 'busbar', 160, 0), node('c', 'consumer', 320, 0)];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];

    const routed = routeEdgesV2(nodes, edges);

    for (const current of routed) {
      expect(current.data?.geometry?.points?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('applyAdvancedLayout runs ELK (with Dagre fallback) and then routes the result', async () => {
    const nodes = [
      node('a', 'battery', 0, 0),
      node('b', 'busbar', 160, 0),
      node('c', 'consumer', 320, 0),
      node('d', 'charger', 160, 200),
      node('e', 'consumer', 320, 200),
    ];
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'a', 'd'),
      edge('e4', 'd', 'c'),
      edge('e5', 'b', 'e'),
    ];

    const result = await applyAdvancedLayout(nodes, edges, 'LR');

    expect(result.nodes).toHaveLength(nodes.length);
    expect(result.nodes.every((current) => typeof current.position.x === 'number')).toBe(true);
    for (const current of result.edges) {
      expect(current.data?.geometry?.points?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  }, 20_000);
});
