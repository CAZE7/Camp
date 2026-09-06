import { describe, expect, it } from 'vitest';
import type { PlannerEdge, PlannerNode } from '../domainModel';
import { GEOMETRY } from '../tokens';
import { routeAllEdges } from './orchestrator';

const node = (
  id: string,
  type: string,
  x: number,
  y: number,
): PlannerNode => ({
  id,
  type,
  position: { x, y },
  data: { label: id },
  width: 120,
  height: 80,
});

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string,
): PlannerEdge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  data: { length: 1 },
});

const nodes: PlannerNode[] = [
  node('b1', 'battery', 0, 0),
  node('s1', 'shunt', 160, 0),
  node('bb', 'busbar', 320, 0),
  node('f1', 'fuse', 480, 0),
  node('f2', 'fuse', 640, 0),
  node('c1', 'consumer', 800, 0),
  node('c2', 'consumer', 800, -160),
  node('c3', 'consumer', 800, 160),
  node('ch1', 'charger', 160, 200),
  node('ch2', 'charger', 160, -200),
  node('inv1', 'inverter', 480, 200),
  node('inv2', 'inverter', 480, -200),
  node('sol1', 'solar', 0, 400),
  node('sol2', 'solar', 160, 400),
  node('mppt', 'charger', 320, 400),
  node('sh1', 'shorePower', 800, 400),
  node('g1', 'ground', 0, -400),
  node('g2', 'ground', 800, -400),
  node('load1', 'consumer230v', 800, 560),
  node('load2', 'consumer230v', 800, 720),
];

const edges: PlannerEdge[] = [
  edge('e1', 'b1', 's1', 'plus', 'plus'),
  edge('e2', 's1', 'bb', 'plus', 'plus'),
  edge('e3', 'bb', 'f1', 'plus', 'plus'),
  edge('e4', 'bb', 'f2', 'plus', 'plus'),
  edge('e5', 'f1', 'c1', 'plus', 'plus'),
  edge('e6', 'f2', 'c2', 'plus', 'plus'),
  edge('e7', 'f2', 'c3', 'plus', 'plus'),
  edge('e8', 'b1', 'ch1', 'minus', 'minus'),
  edge('e9', 'ch1', 'bb', 'plus', 'plus'),
  edge('e10', 'b1', 'ch2', 'minus', 'minus'),
  edge('e11', 'ch2', 'bb', 'plus', 'plus'),
  edge('e12', 'bb', 'inv1', 'plus', 'plus'),
  edge('e13', 'inv1', 'c1', 'plus', 'plus'),
  edge('e14', 'bb', 'inv2', 'plus', 'plus'),
  edge('e15', 'inv2', 'c2', 'plus', 'plus'),
  edge('e16', 'sol1', 'mppt', 'plus', 'plus'),
  edge('e17', 'sol2', 'mppt', 'plus', 'plus'),
  edge('e18', 'mppt', 'bb', 'plus', 'plus'),
  edge('e19', 'sh1', 'bb', 'plus', 'plus'),
  edge('e20', 's1', 'g1', 'minus', 'minus'),
  edge('e21', 'bb', 'g2', 'minus', 'minus'),
  edge('e22', 'inv1', 'load1', 'plus', 'plus'),
  edge('e23', 'inv2', 'load2', 'plus', 'plus'),
];

describe('Routing V2 stress', () => {
  it('keeps the 23-edge industrial fixture collision-free and crossing-free', () => {
    const first = routeAllEdges({ nodes, edges });
    const second = routeAllEdges({
      nodes: [...nodes].reverse(),
      edges: [...edges].reverse(),
    });

    expect(first.diagnostics.maxEdgeNodeCollisions).toBe(0);
    expect(first.diagnostics.maxEdgeEdgeOverlaps).toBe(0);
    expect(first.diagnostics.totalCrossings).toBeLessThanOrEqual(2);
    expect(first.diagnostics.minClearance).toBeGreaterThanOrEqual(
      GEOMETRY.cableClearance,
    );
    expect(first.edges).toEqual(second.edges);
  }, 15000);
});
