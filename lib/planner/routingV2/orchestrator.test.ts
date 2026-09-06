import { describe, expect, it } from 'vitest';
import type { PlannerNode } from '../domain';
import {
  analyzeRoutingV2,
  attachRoutedPaths,
  buildStraightPath,
  nodeAABB,
  orthogonalRouteCandidates,
  pathToFlat,
  routeSchematicV2,
  selectBestPath,
  shiftPath,
} from './orchestrator';
import { DagreLayoutEngine } from './elkAdapter';

function node(id: string, x: number, y: number): PlannerNode {
  return { id, type: 'consumer', position: { x, y }, data: { watts: 24 } };
}

describe('routing v2 orchestrator', () => {
  it('builds a straight orthogonal path between two nodes', () => {
    const path = buildStraightPath({ x: 0, y: 0 }, { x: 100, y: 40 });
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 100, y: 40 });
  });

  it('shifts a path by an offset', () => {
    const shifted = shiftPath([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0, 12);
    expect(shifted).toEqual([
      { x: 0, y: 12 },
      { x: 10, y: 12 },
    ]);
  });

  it('computes node AABBs with defaults', () => {
    const box = nodeAABB(node('a', 10, 20));
    expect(box).toEqual({ x: 10, y: 20, width: 200, height: 100 });
  });

  it('routes V2 on an already-positioned graph', () => {
    const nodes = [node('a', 0, 0), node('b', 300, 0), node('c', 300, 150)];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', data: { cableFunction: 'main' as const } },
      { id: 'e2', source: 'b', target: 'c', data: { cableFunction: 'consumer' as const } },
    ];
    const analysis = analyzeRoutingV2({ nodes, edges });

    expect(analysis.routedEdges).toHaveLength(2);
    expect(analysis.laneRegistry).toBeInstanceOf(Object);
    // Kanten sind mit Pfaden angereichert
    expect(analysis.routedEdges[0].path.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the backbone straight and hops the lower-priority branch', () => {
    const nodes = [
      node('a', -200, 0),
      node('b', 400, 0),
      node('c', 100, -100),
      node('d', 100, 100),
    ];
    const edges = [
      // Main-Trasse: horizontal, hohe Priorität
      { id: 'main', source: 'a', target: 'b', data: { cableFunction: 'main' as const } },
      // Abzweig: vertikal, niedrige Priorität → kreuzen sich
      { id: 'branch', source: 'c', target: 'd', data: { cableFunction: 'consumer' as const } },
    ];
    const analysis = analyzeRoutingV2({ nodes, edges });

    const crossings = analysis.collisions.filter((c) => c.kind === 'edge-edge-crossing');
    // mindestens ein Crossing, das als Hop aufgelöst wird
    expect(analysis.hops.hops.length).toBeGreaterThanOrEqual(1);
    expect(crossings.length).toBeGreaterThanOrEqual(1);
  });

  it('flattens an orthogonal path into a coordinate array', () => {
    expect(pathToFlat([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toEqual([0, 0, 10, 0]);
  });

  it('generates orthogonal route candidates that leave/enter at node edges', () => {
    const source = nodeAABB(node('a', 0, 0)); // {x:0,y:0,width:200,height:100}
    const target = nodeAABB(node('b', 300, 0));
    const candidates = orthogonalRouteCandidates(source, target, 12);

    expect(candidates.length).toBeGreaterThanOrEqual(3);
    // Alle Kandidaten starten an der rechten Kante von a (x=200) und links an b (x=300).
    const sourceRight = source.x + source.width;
    const targetLeft = target.x;
    for (const c of candidates) {
      expect(c[0].x).toBe(sourceRight);
      expect(c[0].y).toBe(source.y + source.height / 2);
      expect(c[c.length - 1].x).toBe(targetLeft);
      expect(c[c.length - 1].y).toBe(target.y + target.height / 2);
    }
  });

  it('selects the cheapest route using the active cost model (straight wins)', () => {
    const source = nodeAABB(node('a', 0, 0));
    const target = nodeAABB(node('b', 300, 0));
    const candidates = orthogonalRouteCandidates(source, target, 0);

    const best = selectBestPath(candidates);
    // Kostenbewertung: eine gerade Trasse (2 Punkte, keine Biegung) ist am günstigsten.
    expect(best).toEqual([
      { x: source.x + source.width, y: source.y + source.height / 2 },
      { x: target.x, y: target.y + target.height / 2 },
    ]);
  });

  it('reaches edges with routedPath and lane via attachRoutedPaths', () => {
    const nodes = [
      { id: 'a', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
      { id: 'b', type: 'consumer', position: { x: 300, y: 0 }, data: { watts: 24 } },
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } },
    ];

    const routed = attachRoutedPaths(nodes, edges as any);

    expect(routed[0].data).toBeDefined();
    expect(routed[0].data!.routedPath).toBeDefined();
    expect(routed[0].data!.routedPath!.length).toBeGreaterThanOrEqual(4);
    expect(typeof routed[0].data!.lane).toBe('number');
  });

  it('runs the full async pipeline with the dagre fallback engine', async () => {
    const nodes = [node('a', 0, 0), node('b', 0, 0)];
    const edges = [{ id: 'e1', source: 'a', target: 'b', data: { cableFunction: 'main' as const } }];

    const result = await routeSchematicV2({
      nodes,
      edges,
      direction: 'LR',
      layoutEngine: new DagreLayoutEngine(),
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.routedEdges).toHaveLength(1);
    expect(result.layoutResult.positions.has('a')).toBe(true);
    expect(result.layoutResult.positions.has('b')).toBe(true);
    // LR: b liegt rechts von a
    expect(result.layoutResult.positions.get('b')!.x).toBeGreaterThan(
      result.layoutResult.positions.get('a')!.x
    );
  });
});
