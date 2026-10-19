import { describe, expect, it } from 'vitest';
import { REGRESSION_SCENARIOS } from '../../../scripts/regression/scenarios';
import {
  decideOptimizationPublish,
  GLOBAL_REROUTE_ATTEMPTS,
  optimizeCableRoutes,
} from './optimizeCableRoutes';
import { computeCableRouteFinalValidation } from './routeValidation';
import { routeAllCables } from './routeAll';
import { clearPathfindingCache } from './pathfinding';
import { improvesRoutingQuality } from '../../../lib/routing/quality';

const fixture = () =>
  structuredClone(REGRESSION_SCENARIOS.find((scenario) => scenario.id.startsWith('p04'))!);
const geometry = (routes: ReturnType<typeof routeAllCables>) =>
  [...routes].map(([id, route]) => [id, route.waypoints]);

describe('bounded global optimization', () => {
  it('strictly improves p04 without changing electrical data or unaffected routes', () => {
    const plan = fixture();
    const snapshot = JSON.stringify(plan);
    const baseline = routeAllCables(plan.nodes, plan.edges);
    const { routes, summary } = optimizeCableRoutes(plan.nodes, plan.edges);
    expect(improvesRoutingQuality(summary.after, summary.before)).toBe(true);
    expect(summary.before.crossings).toBe(2);
    expect(summary.after.crossings).toBe(1);
    expect(summary.after.bends).toBe(10);
    expect(summary.after.lengthPx).toBe(summary.before.lengthPx);
    expect(summary.attempted).toBeLessThanOrEqual(GLOBAL_REROUTE_ATTEMPTS);
    expect(
      [...routes].filter(
        ([id, route]) => JSON.stringify(route.waypoints) !== JSON.stringify(baseline.get(id)?.waypoints)
      )
    ).toHaveLength(1);
    expect(JSON.stringify(plan)).toBe(snapshot);
    expect([...routes.values()].some((route) => route.locked)).toBe(false);
    expect(computeCableRouteFinalValidation(plan.nodes, plan.edges, routes).status).toBe('VALID');
  });
  it('is deterministic and idempotent across cache resets and permutations', () => {
    const plan = fixture();
    const first = optimizeCableRoutes(plan.nodes, plan.edges);
    clearPathfindingCache();
    const second = optimizeCableRoutes([...plan.nodes].reverse(), [...plan.edges].reverse());
    expect(geometry(second.routes)).toEqual(geometry(first.routes));
    expect(second.summary).toEqual(first.summary);
    expect(geometry(optimizeCableRoutes(plan.nodes, plan.edges).routes)).toEqual(geometry(first.routes));
  });
  it('preserves an actual locked route, not just its endpoints', () => {
    const plan = fixture();
    const baseline = routeAllCables(plan.nodes, plan.edges);
    plan.edges = plan.edges.map((edge) => ({
      ...edge,
      data: { ...edge.data, locked: true, lockedWaypoints: baseline.get(edge.id)!.waypoints },
    }));
    const result = optimizeCableRoutes(plan.nodes, plan.edges);
    expect(result.summary.attempted).toBe(0);
    expect(geometry(result.routes)).toEqual(geometry(baseline));
  });
  it('shifts the p04 routing with a translated plan', () => {
    const plan = fixture();
    const original = optimizeCableRoutes(plan.nodes, plan.edges);
    const dx = 137,
      dy = -83;
    const moved = plan.nodes.map((node) => ({
      ...node,
      position: { x: node.position.x + dx, y: node.position.y + dy },
    }));
    const result = optimizeCableRoutes(moved, plan.edges);
    for (const [id, route] of result.routes) {
      expect(route.waypoints.map((point) => ({ x: point.x - dx, y: point.y - dy }))).toEqual(
        original.routes.get(id)!.waypoints
      );
    }
  });
});

const quality = {
  valid: true,
  hardViolations: 0,
  lengthPx: 100,
  bends: 2,
  crossings: 1,
  defects: 0,
};

describe('decideOptimizationPublish', () => {
  it('behält den sichtbaren Stand, wenn der Kandidat nicht besser ist', () => {
    expect(
      decideOptimizationPublish({ published: quality, candidate: { ...quality }, lengthGrows: false })
    ).toBe('unchanged');
  });

  it('lehnt eine längere Einzelleitung ab, auch wenn die Routing-Kennzahl sinkt', () => {
    expect(
      decideOptimizationPublish({
        published: quality,
        candidate: { ...quality, crossings: 0 },
        lengthGrows: true,
      })
    ).toBe('rejected');
  });

  it('übernimmt eine echte Verbesserung', () => {
    expect(
      decideOptimizationPublish({
        published: quality,
        candidate: { ...quality, crossings: 0 },
        lengthGrows: false,
      })
    ).toBe('improved');
  });
});
