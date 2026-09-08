import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { routeAllCables, type RouteEdgeRef } from './routeAll';
import { nodeObstacleMap } from './pathfinding';
import { validateFinalRouting } from '../../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';

/**
 * AUDIT ROUTE-001 (Härtung 2026-09-08): „Edge×Node = HARD" im Produktionspfad.
 *
 * Früher wurde eine an die eigene Node geklebte FREMDE Node-Box (überlappt
 * den Start/Stub) beim Hindernisaufbau lautlos verworfen — der Router zog
 * die Leitung durch sie hindurch, und nichts zählte das. Jetzt gilt:
 *  - nur die eigene Box darf verworfen werden (`ownObstacles`),
 *  - der unvermeidbare Konflikt läuft als MARKIERTER Fallback
 *    (`fallbackHitsObstacles === true`) — die Marke überlebt den
 *    RouteAll-Rebuild,
 *  - und die harte Verletzung steht im Final-Validation-Report (I1) —
 *    derselben Funktion, mit der die App den Report im Render mitführt.
 */

const makeNode = (id: string, x: number, y: number): Node =>
  ({ id, type: 'consumer', position: { x, y }, width: 192, height: 120, data: { label: id } }) as Node;

const finalReport = (
  nodes: Node[],
  edges: RouteEdgeRef[],
  routes: Map<string, { waypoints: { x: number; y: number }[] }>
) => {
  const routed: RoutedEdge[] = edges.flatMap((edge) => {
    const route = routes.get(edge.id);
    return route
      ? [{ id: edge.id, source: edge.source, target: edge.target, waypoints: route.waypoints }]
      : [];
  });
  const obstacleById = nodeObstacleMap(nodes);
  const rects: NodeRect[] = nodes.flatMap((node) => {
    const rect = obstacleById.get(node.id);
    return rect ? [{ id: node.id, ...rect }] : [];
  });
  return validateFinalRouting(routed, rects);
};

describe('routeAllCables — ROUTE-001 Kollisionsgarantie bei geklebten Nachbar-Nodes', () => {
  it('überlappende Fremd-Node: markierter Fallback statt lautloser Durchroutung; I1 zählt die Verletzung', () => {
    // a bei (0,0) 192×120 → rechter Handle bei (192, 60) — die Fremd-Node
    // „glue" (120,20) 192×120 überlappt genau diesen Punkt.
    const nodes = [makeNode('a', 0, 0), makeNode('glue', 120, 20), makeNode('b', 800, 0)];
    const edges: RouteEdgeRef[] = [{ id: 'e-a-b', source: 'a', target: 'b' }];

    const routes = routeAllCables(nodes, edges);
    const route = routes.get('e-a-b');
    expect(route).toBeDefined();
    // Kein lautloses „konform": der unvermeidbare Konflikt ist markiert.
    expect(route!.usedSearch).toBe('fallback');
    expect(route!.fallbackHitsObstacles).toBe(true);

    // … und die harte Verletzung steht im Final-Validation-Report (I1),
    // statt nur in einem Dev-Log.
    const report = finalReport(nodes, edges, routes);
    expect(report.counts.edgeNodeCollisions).toBeGreaterThanOrEqual(1);
    expect(
      report.violations.some((v) => v.invariant === 'I1' && v.edgeId === 'e-a-b' && v.otherId === 'glue')
    ).toBe(true);
    expect(report.status).toBe('INVALID');
  });

  it('Kontrolle: ungeklebter Gleichplan — kein Fallback, keine I1-Verletzung, Marke bleibt aus', () => {
    // „glue" sitzt frei unter dem Korridor (bei 200 px Höhe klar außerhalb).
    const nodes = [makeNode('a', 0, 0), makeNode('glue', 120, 320), makeNode('b', 800, 0)];
    const edges: RouteEdgeRef[] = [{ id: 'e-a-b', source: 'a', target: 'b' }];

    const routes = routeAllCables(nodes, edges);
    const route = routes.get('e-a-b');
    expect(route).toBeDefined();
    expect(route!.usedSearch).not.toBe('fallback');
    expect(route!.fallbackHitsObstacles).toBeFalsy();

    const report = finalReport(nodes, edges, routes);
    expect(report.violations.some((v) => v.invariant === 'I1' && v.edgeId === 'e-a-b')).toBe(false);
  });
});
