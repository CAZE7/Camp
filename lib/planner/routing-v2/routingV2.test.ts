import { describe, expect, it } from 'vitest';
import type { PlannerEdge, PlannerNode } from '../domainModel';
import { GEOMETRY } from '../tokens';
import { LaneRegistry } from '../geometry/lanes';
import { routeAllEdges } from './orchestrator';
import { routeCost } from '../routing-core/costModel';

const node = (id: string, type: string, x: number, y: number): PlannerNode => ({
  id,
  type,
  position: { x, y },
  data: { label: id },
  width: 100,
  height: 60,
});

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string
): PlannerEdge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  data: { length: 1 },
});

describe('Routing V2 core', () => {
  it('assigns stable lanes independent of edge insertion order', () => {
    const edges = [edge('e-b', 'b', 'c', 'plus', 'plus'), edge('e-a', 'a', 'c', 'plus', 'plus')];
    const reversed = [...edges].reverse();

    const first = new LaneRegistry(edges).routeOrder();
    const second = new LaneRegistry(reversed).routeOrder();

    expect(first).toEqual(second);
    expect(first.length).toBe(2);
  });

  it('routeCost() reacts to collision, lane congestion and hops', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];

    const empty = routeCost({ path: { points } });
    const congested = routeCost({
      path: { points },
      collision: 1,
      laneCongestion: 1,
      hops: 1,
    });

    expect(congested.cost).toBeGreaterThan(empty.cost);
    expect(congested.collision).toBe(1);
    expect(congested.laneCongestion).toBe(1);
    expect(congested.hops).toBe(1);
  });

  it('routes a small schematic without edge-node collisions', () => {
    const nodes: PlannerNode[] = [
      node('battery', 'battery', 0, 0),
      node('fuse', 'fuse', 240, 0),
      node('consumer', 'consumer', 480, 0),
    ];
    const edges: PlannerEdge[] = [
      edge('e1', 'battery', 'fuse', 'plus', 'plus'),
      edge('e2', 'fuse', 'consumer', 'plus', 'plus'),
    ];

    const result = routeAllEdges({ nodes, edges });

    expect(result.edges.length).toBe(2);
    expect(result.diagnostics.maxEdgeNodeCollisions).toBe(0);
    expect(result.diagnostics.maxEdgeEdgeOverlaps).toBe(0);
    expect(result.diagnostics.minClearance).toBeGreaterThanOrEqual(GEOMETRY.cableClearance);
  });

  it('routes around an obstacle instead of through it', () => {
    const nodes: PlannerNode[] = [
      { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 100, height: 60 },
      {
        id: 'obstacle',
        type: 'consumer',
        position: { x: 150, y: 0 },
        data: { label: 'OB' },
        width: 100,
        height: 60,
      },
      { id: 'b', type: 'inverter', position: { x: 300, y: 0 }, data: { label: 'B' }, width: 100, height: 60 },
    ];
    const edges: PlannerEdge[] = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: { length: 1 },
      },
    ];

    const result = routeAllEdges({ nodes, edges });

    expect(result.diagnostics.maxEdgeNodeCollisions).toBe(0);
    expect(result.diagnostics.maxEdgeEdgeOverlaps).toBe(0);
    expect(result.diagnostics.minClearance).toBeGreaterThanOrEqual(GEOMETRY.cableClearance);
    expect(result.edges[0]!.points.length).toBeGreaterThan(2);
  });

  it('keeps a crossing-prone fixture collision-free and crossing-free', () => {
    const nodes: PlannerNode[] = [
      {
        id: 'battery',
        type: 'battery',
        position: { x: 0, y: 0 },
        data: { label: 'Battery' },
        width: 120,
        height: 80,
      },
      {
        id: 'shunt',
        type: 'shunt',
        position: { x: 160, y: 0 },
        data: { label: 'Shunt' },
        width: 120,
        height: 80,
      },
      {
        id: 'busbar',
        type: 'busbar',
        position: { x: 320, y: 0 },
        data: { label: 'Busbar' },
        width: 120,
        height: 80,
      },
      {
        id: 'fuse',
        type: 'fuse',
        position: { x: 480, y: 0 },
        data: { label: 'Fuse' },
        width: 120,
        height: 80,
      },
      {
        id: 'consumer',
        type: 'consumer',
        position: { x: 640, y: 0 },
        data: { label: 'Consumer' },
        width: 120,
        height: 80,
      },
      {
        id: 'charger',
        type: 'charger',
        position: { x: 160, y: 200 },
        data: { label: 'Charger' },
        width: 120,
        height: 80,
      },
      {
        id: 'inverter',
        type: 'inverter',
        position: { x: 480, y: 200 },
        data: { label: 'Inverter' },
        width: 120,
        height: 80,
      },
      {
        id: 'solar',
        type: 'solar',
        position: { x: 0, y: 400 },
        data: { label: 'Solar' },
        width: 120,
        height: 80,
      },
      {
        id: 'mppt',
        type: 'charger',
        position: { x: 160, y: 400 },
        data: { label: 'MPPT' },
        width: 120,
        height: 80,
      },
      {
        id: 'shore',
        type: 'shorePower',
        position: { x: 640, y: 400 },
        data: { label: 'Shore' },
        width: 120,
        height: 80,
      },
    ];
    const mk = (
      id: string,
      source: string,
      target: string,
      sourceHandle?: string,
      targetHandle?: string
    ): PlannerEdge => ({
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
      data: { length: 1 },
    });
    const edges: PlannerEdge[] = [
      mk('e1', 'battery', 'shunt', 'plus', 'plus'),
      mk('e2', 'shunt', 'busbar', 'plus', 'plus'),
      mk('e3', 'battery', 'fuse', 'plus', 'plus'),
      mk('e4', 'fuse', 'consumer', 'plus', 'plus'),
      mk('e5', 'battery', 'charger', 'minus', 'minus'),
      mk('e6', 'charger', 'busbar', 'plus', 'plus'),
      mk('e7', 'busbar', 'inverter', 'plus', 'plus'),
      mk('e8', 'solar', 'mppt', 'plus', 'plus'),
      mk('e9', 'mppt', 'busbar', 'plus', 'plus'),
      mk('e10', 'shore', 'busbar', 'plus', 'plus'),
      mk('e11', 'busbar', 'consumer', 'plus', 'plus'),
      mk('e12', 'inverter', 'consumer', 'plus', 'plus'),
    ];

    const first = routeAllEdges({ nodes, edges });
    const second = routeAllEdges({ nodes: [...nodes].reverse(), edges: [...edges].reverse() });

    expect(first.diagnostics.maxEdgeNodeCollisions).toBe(0);
    expect(first.diagnostics.maxEdgeEdgeOverlaps).toBe(0);
    expect(first.diagnostics.totalCrossings).toBeLessThanOrEqual(2);
    expect(first.diagnostics.minClearance).toBeGreaterThanOrEqual(GEOMETRY.cableClearance);
    expect(first.edges).toEqual(second.edges);
  });

  it('keeps the result deterministic across repeated runs', () => {
    const nodes: PlannerNode[] = [
      node('battery', 'battery', 0, 0),
      node('consumer', 'consumer', 240, 0),
      node('inverter', 'inverter', 480, 0),
    ];
    const edges: PlannerEdge[] = [
      edge('e1', 'battery', 'consumer', 'plus', 'plus'),
      edge('e2', 'consumer', 'inverter', 'plus', 'plus'),
    ];

    const first = routeAllEdges({ nodes, edges });
    const second = routeAllEdges({ nodes: [...nodes].reverse(), edges: [...edges].reverse() });

    expect(first.edges).toEqual(second.edges);
    expect(first.diagnostics.totalCollisions).toBe(second.diagnostics.totalCollisions);
  });
});
