import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCableRoutes,
  completeCableRouteGeneration,
  getCableRoute,
  getCableRouteFinalValidation,
  getCableRouteGeneration,
  publishCableRouteGeneration,
} from './cableRouteStore';
import { routeAllCables } from './routeAll';
import type { RouteGenerationStatus } from '../../../lib/routing/generation';

const nodes = [
  { id: 'a', data: {}, position: { x: 0, y: 0 }, width: 192, height: 120 },
  { id: 'b', data: {}, position: { x: 500, y: 0 }, width: 192, height: 120 },
];
const edges = [{ id: 'e', source: 'a', target: 'b' }];
const status: RouteGenerationStatus = {
  hash: 'first',
  generation: 1,
  revision: 1,
  allowed: true,
  converged: true,
};
beforeEach(clearCableRoutes);
function publishInitial() {
  publishCableRouteGeneration(status);
  completeCableRouteGeneration(nodes, edges, status, routeAllCables(nodes, edges));
}
describe('transactional routing publication', () => {
  it('publishes valid geometry and verdict together', () => {
    publishInitial();
    expect(getCableRouteFinalValidation()?.status).toBe('VALID');
    expect(getCableRouteGeneration()?.geometryHash).toBe('first');
    expect(getCableRouteGeneration()?.state).toBe('valid');
  });
  it('retains the previous valid geometry on incomplete candidate or exception', () => {
    publishInitial();
    const original = getCableRoute('e');
    completeCableRouteGeneration(nodes, edges, status, new Map());
    expect(getCableRoute('e')).toBe(original);
    expect(getCableRouteGeneration()?.state).toBe('retained');
    completeCableRouteGeneration(nodes, edges, status, undefined, 'search failed');
    expect(getCableRoute('e')).toBe(original);
    expect(getCableRouteGeneration()?.reason).toBe('search failed');
  });
  it('revalidates retained geometry after moving a device and marks it stale', () => {
    publishInitial();
    const next = { ...status, hash: 'moved', generation: 2, geometryHash: 'first' };
    publishCableRouteGeneration(next);
    const moved = nodes.map((node) => (node.id === 'b' ? { ...node, position: { x: 600, y: 0 } } : node));
    completeCableRouteGeneration(moved, edges, next, new Map());
    expect(getCableRouteFinalValidation()?.status).toBe('INVALID');
    expect(getCableRouteGeneration()?.state).toBe('stale');
    expect(getCableRouteGeneration()?.geometryHash).toBe('first');
  });
  it('rejects late results without changing the snapshot', () => {
    publishInitial();
    publishCableRouteGeneration({ ...status, hash: 'new', generation: 2 });
    expect(completeCableRouteGeneration(nodes, edges, status, new Map())).toBe(false);
    expect(getCableRouteGeneration()?.hash).toBe('new');
    expect(getCableRoute('e')).toBeDefined();
  });
  it('marks failure with no previous generation as error, not VALID', () => {
    publishCableRouteGeneration(status);
    completeCableRouteGeneration(nodes, edges, status, undefined, 'budget exhausted');
    expect(getCableRouteGeneration()?.state).toBe('error');
    expect(getCableRouteFinalValidation()?.status).toBe('INVALID');
  });
  it('does not retain deleted cables', () => {
    publishInitial();
    completeCableRouteGeneration(nodes, [], status, new Map());
    expect(getCableRoute('e')).toBeUndefined();
    expect(getCableRouteFinalValidation()?.status).toBe('VALID');
  });
});

it('owns immutable published waypoint snapshots, independent of the candidate cache', () => {
  const routes = routeAllCables(nodes, edges);
  const point = { ...routes.get('e')!.waypoints[0]! };
  publishCableRouteGeneration(status);
  completeCableRouteGeneration(nodes, edges, status, routes);
  routes.get('e')!.waypoints[0]!.x += 123;
  expect(getCableRoute('e')!.waypoints[0]).toEqual(point);
  expect(Object.isFrozen(getCableRoute('e')!.waypoints)).toBe(true);
  expect(Object.isFrozen(getCableRoute('e')!.waypoints[0])).toBe(true);
});
