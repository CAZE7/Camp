import { describe, expect, it } from 'vitest';
import {
  aabbFromPoints,
  point,
  segment,
  type OrthogonalPath,
  type RoutedEdge,
  type Segment,
} from '../geometry';
import {
  detectCollisions,
  detectEdgeEdgeClearance,
  detectEdgeEdgeCrossing,
  detectEdgeEdgeOverlap,
  detectEdgeNodeCollisions,
  segmentDistance,
  segmentsCrossProperly,
  segmentsIntersect,
  type CollisionNode,
} from './collision';
import { cheapestRoute, routeCost } from './costModel';
import { applyHop, applyHopPlan, planHopping } from './hopping';
import { LaneRegistry } from './laneRegistry';

const edge = (id: string, source: string, target: string, path: RoutedEdge['path'], priority = 1): RoutedEdge => ({
  edgeId: id,
  source,
  target,
  priority,
  path,
});

describe('collision engine (geometric central truth)', () => {
  it('detects a transversal edge-edge crossing', () => {
    const a: Segment = segment(point(0, 0), point(10, 0));
    const b: Segment = segment(point(5, -5), point(5, 5));
    expect(segmentsIntersect(a, b)).toBe(true);
    expect(segmentsCrossProperly(a, b)).toBe(true);
  });

  it('does not count shared endpoints as proper crossings', () => {
    const a: Segment = segment(point(0, 0), point(10, 0));
    const b: Segment = segment(point(10, 0), point(10, 10));
    expect(segmentsIntersect(a, b)).toBe(true);
    expect(segmentsCrossProperly(a, b)).toBe(false);
  });

  it('detects collinear overlap between parallel edges', () => {
    const crossings = detectEdgeEdgeOverlap([
      edge('e1', 'a', 'c', [point(0, 0), point(10, 0)]),
      edge('e2', 'b', 'd', [point(2, 0), point(8, 0)]),
    ]);
    expect(crossings).toHaveLength(1);
    expect(crossings[0].kind).toBe('edge-edge-overlap');
  });

  it('detects clearance violation for near-parallel edges', () => {
    const near = detectEdgeEdgeClearance(
      [
        edge('e1', 'a', 'b', [point(0, 0), point(10, 0)]),
        edge('e2', 'c', 'd', [point(0, 4), point(10, 4)]),
      ],
      8
    );
    expect(near).toHaveLength(1);
    expect(near[0].kind).toBe('edge-edge-clearance');
    expect(near[0].clearance).toBeCloseTo(4, 1);
  });

  it('does not flag spaced parallel edges beyond clearance', () => {
    const ok = detectEdgeEdgeClearance(
      [
        edge('e1', 'a', 'b', [point(0, 0), point(10, 0)]),
        edge('e2', 'c', 'd', [point(0, 30), point(10, 30)]),
      ],
      8
    );
    expect(ok).toHaveLength(0);
  });

  it('detects an edge-node collision against a FOREIGN node using padded AABB', () => {
    const nodes: CollisionNode[] = [
      { id: 'n1', aabb: aabbFromPoints(point(20, -10), point(30, 10)) },
    ];
    const collisions = detectEdgeNodeCollisions(
      [edge('e1', 'a', 'b', [point(0, 0), point(40, 0)])],
      nodes
    );
    expect(collisions).toHaveLength(1);
    expect(collisions[0].nodeId).toBe('n1');
  });

  it('does NOT flag an edge for touching its own source/target nodes', () => {
    const nodes: CollisionNode[] = [
      { id: 'a', aabb: aabbFromPoints(point(0, 0), point(10, 10)) },
      { id: 'b', aabb: aabbFromPoints(point(30, 0), point(40, 10)) },
    ];
    // Kante startet an der Grenze von a und endet an der Grenze von b.
    const collisions = detectEdgeNodeCollisions(
      [edge('e1', 'a', 'b', [point(10, 5), point(30, 5)])],
      nodes
    );
    expect(collisions).toHaveLength(0);
  });

  it('runs the full detection pipeline sorted by severity', () => {
    const nodes: CollisionNode[] = [
      { id: 'n1', aabb: aabbFromPoints(point(20, -10), point(30, 10)) },
    ];
    const collisions = detectCollisions(
      [
        edge('e1', 'a', 'b', [point(0, 0), point(40, 0)]),
        edge('e2', 'c', 'd', [point(0, 8), point(40, 8)]),
        edge('e3', 'e', 'f', [point(15, -20), point(15, 20)]),
        edge('e4', 'g', 'h', [point(10, 0), point(30, 0)]), // kollinear mit e1 → error
      ],
      nodes,
      { minClearance: 16 }
    );
    expect(collisions.length).toBeGreaterThanOrEqual(2);
    expect(collisions[0].severity).toBe('error');
  });

  it('computes segment distance to overlaps as zero', () => {
    const a: Segment = segment(point(0, 0), point(10, 0));
    const b: Segment = segment(point(5, 0), point(15, 0));
    expect(segmentDistance(a, b)).toBe(0);
  });
});

describe('lane registry (deterministic trunk assignment)', () => {
  it('assigns stable, collision-free lanes to parallel edges', () => {
    const registry = new LaneRegistry();
    const a = registry.acquire('e1', 'busbar', 'consumer');
    const b = registry.acquire('e2', 'busbar', 'consumer');

    expect(a.lane).toBeGreaterThanOrEqual(0);
    expect(a.offset).toBe(a.lane * 12);
    expect(a.lane).not.toBe(b.lane);

    // Zweiter Aufruf liefert dieselbe Zuweisung (deterministisch).
    const aAgain = registry.acquire('e1', 'busbar', 'consumer');
    expect(aAgain.lane).toBe(a.lane);
  });

  it('exposes lanes per trunk and full width', () => {
    const registry = new LaneRegistry();
    registry.acquire('e1', 'busbar', 'consumer');
    registry.acquire('e2', 'busbar', 'consumer');
    registry.acquire('e3', 'busbar', 'consumer');

    const lanes = registry.lanesForTrunk('busbar', 'consumer');
    expect(lanes).toHaveLength(3);
    expect(new Set(lanes).size).toBe(3);
    expect(registry.trunkWidth(lanes)).toBeGreaterThan(0);
  });

  it('keeps different trunks independent', () => {
    const registry = new LaneRegistry();
    registry.acquire('e1', 'busbar', 'consumer');
    registry.acquire('e2', 'solar', 'charger');
    expect(registry.lanesForTrunk('busbar', 'consumer')).toHaveLength(1);
    expect(registry.lanesForTrunk('solar', 'charger')).toHaveLength(1);
  });
});

describe('cost model', () => {
  it('penalizes length, bends, collisions and hops', () => {
    const straight = routeCost({ path: [point(0, 0), point(100, 0)] });
    const bent = routeCost({ path: [point(0, 0), point(50, 0), point(50, 50)] });
    expect(bent.total).toBeGreaterThan(straight.total);
    expect(bent.bends).toBe(1);

    const collided = routeCost({
      path: [point(0, 0), point(100, 0)],
      collisions: 2,
    });
    expect(collided.total).toBeGreaterThan(straight.total);

    const hopped = routeCost({ path: [point(0, 0), point(100, 0)], hops: 1 });
    expect(hopped.total).toBeGreaterThan(straight.total);
  });

  it('selects the cheapest route', () => {
    const cheap = routeCost({ path: [point(0, 0), point(10, 0)] });
    const expensive = routeCost({ path: [point(0, 0), point(200, 0)] });
    expect(cheapestRoute([expensive, cheap])?.total).toBe(cheap.total);
  });
});

describe('crossing hopping', () => {
  it('makes the higher-priority backbone stay straight and hops the branch', () => {
    const backbone = edge('bb', 'a', 'b', [point(0, 0), point(100, 0)], 10);
    const branch = edge('br', 'c', 'd', [point(50, -40), point(50, 40)], 1);

    const plan = planHopping([backbone, branch], [
      { kind: 'edge-edge-crossing', severity: 'warning', edgeIds: ['bb', 'br'], message: 'x' },
    ]);

    expect(plan.hops).toHaveLength(1);
    expect(plan.hops[0].edgeId).toBe('br');
    expect(plan.hopCountByEdge.get('bb')).toBeUndefined();

    const resulting = applyHopPlan([backbone, branch], plan);
    const backboneAfter = resulting.find((e) => e.edgeId === 'bb')!;
    const branchAfter = resulting.find((e) => e.edgeId === 'br')!;

    // Backbone bleibt unverändert
    expect(backboneAfter.path).toEqual(backbone.path);
    // Branch bekommt zusätzliche Punkte (Hop)
    expect(branchAfter.path.length).toBeGreaterThan(branch.path.length);
  });

  it('applies a hop to a path inline', () => {
    const path = applyHop(
      [point(0, 0), point(10, 0)],
      { edgeId: 'br', at: point(5, 0), offset: 8, direction: { x: 0, y: 1 } }
    );
    expect(path.length).toBeGreaterThan(2);
  });

  it('anchors the hop on the actual crossing point inside the segment', () => {
    // Vertikale Kante, Kreuzung liegt bei y=50 im Segment (0..100).
    const path: OrthogonalPath = [point(0, 0), point(0, 100)];
    const hopped = applyHop(
      path,
      { edgeId: 'br', at: point(0, 50), offset: 12, direction: { x: 1, y: 0 } }
    );

    // Der Kreuzungspunkt bleibt exakt erhalten (kein "Verschieben" auf einen Vertex).
    expect(hopped).toContainEqual(point(0, 50));
    // Der Detour weicht seitlich (x+12) aus und kehrt zurück.
    expect(hopped).toContainEqual(point(12, 50));
    // Start und Ende bleiben unverändert.
    expect(hopped[0]).toEqual(point(0, 0));
    expect(hopped[hopped.length - 1]).toEqual(point(0, 100));
  });
});
