import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  computeAffectedEdgeIds,
  routeAllCables,
  routeIncrementalCables,
  topoKeyOf,
  type RouteEdgeRef,
  type RoutePrevState,
} from './routeAll';
import { nodeObstacleMap, type PathResult } from './pathfinding';
import { computeCableRouteFinalValidation } from './cableRouteStore';

/**
 * P-1/P-5 (#397): Inkrementelles Re-Routing — Affected-Set statt globalem
 * Re-Route.
 *
 * Nach Auto-Wire trudeln Messwerte frameweise ein; der alte globale Pass
 * verlegte dabei JEDE Kante neu (sichtbares Springen über 1–3 Frames). Der
 * inkrementelle Pass verlegt nur betroffene Kanten neu und übernimmt alle
 * übrigen exakt aus dem Vorlauf: gleiche Wege UND gleiche Objekt-Identität
 * (kein Re-Render, kein Flackern). Der `onRouted`-Zähler weist O(betroffen)
 * statt O(E) nach.
 */

const makeNode = (id: string, x: number, y: number, width = 192, height = 120): Node =>
  ({
    id,
    type: 'consumer',
    position: { x, y },
    width,
    height,
    data: { label: id },
  }) as Node;

/** Hub mit drei Verbrauchern plus einer weit entfernten Fremdkante. */
function buildHubPlan(): { nodes: Node[]; edges: RouteEdgeRef[] } {
  const nodes: Node[] = [
    makeNode('hub', 0, 0),
    makeNode('a', 600, -320),
    makeNode('b', 600, 40),
    makeNode('c', 600, 400),
    makeNode('p', 2200, 2200),
    makeNode('q', 2800, 2200),
  ];
  const edges: RouteEdgeRef[] = [
    { id: 'e-hub-a', source: 'hub', target: 'a' },
    { id: 'e-hub-b', source: 'hub', target: 'b' },
    { id: 'e-hub-c', source: 'hub', target: 'c' },
    { id: 'e-far', source: 'p', target: 'q' },
  ];
  return { nodes, edges };
}

const buildPrev = (nodes: Node[], edges: RouteEdgeRef[]): RoutePrevState => ({
  routes: routeAllCables(nodes, edges),
  rects: nodeObstacleMap(nodes),
  topo: new Map(edges.map((edge) => [edge.id, topoKeyOf(edge)])),
});

const violationCount = (nodes: Node[], edges: RouteEdgeRef[], routes: Map<string, PathResult>): number =>
  computeCableRouteFinalValidation(nodes, edges, routes).violations.length;

describe('computeAffectedEdgeIds (P-1)', () => {
  it('bewegter Knoten: inzidente Kanten plus Port-Geschwister, keine Fremdkanten', () => {
    const { nodes, edges } = buildHubPlan();
    const prev = buildPrev(nodes, edges);
    const moved = nodes.map((node) => (node.id === 'b' ? { ...node, position: { x: 630, y: 60 } } : node));
    const affected = computeAffectedEdgeIds(nodeObstacleMap(moved), edges, prev);
    // e-hub-b hängt am bewegten Knoten; e-hub-a/c teilen den Hub-Port
    // (Lanes/Ränge verschieben sich gemeinsam, ROUTE-BUG-12/22/34/35).
    expect([...affected].sort()).toEqual(['e-hub-a', 'e-hub-b', 'e-hub-c']);
    expect(affected.has('e-far')).toBe(false);
  });

  it('neue Kante: sie selbst plus Port-Geschwister beider Enden', () => {
    const { nodes, edges } = buildHubPlan();
    const before = edges.filter((edge) => edge.id !== 'e-hub-c');
    const prev = buildPrev(nodes, before);
    const affected = computeAffectedEdgeIds(nodeObstacleMap(nodes), edges, prev);
    expect(affected.has('e-hub-c')).toBe(true);
    expect(affected.has('e-hub-a')).toBe(true);
    expect(affected.has('e-hub-b')).toBe(true);
    expect(affected.has('e-far')).toBe(false);
  });

  it('umverdrahtete Kante (Reconnect) wird erkannt (kein Stale-Pfad, R-9)', () => {
    const { nodes, edges } = buildHubPlan();
    const prev = buildPrev(nodes, edges);
    const reconnected = edges.map((edge) => (edge.id === 'e-hub-c' ? { ...edge, target: 'b' } : edge));
    const affected = computeAffectedEdgeIds(nodeObstacleMap(nodes), reconnected, prev);
    expect(affected.has('e-hub-c')).toBe(true);
  });

  it('unveränderter Plan: leeres Affected-Set', () => {
    const { nodes, edges } = buildHubPlan();
    const prev = buildPrev(nodes, edges);
    expect(computeAffectedEdgeIds(nodeObstacleMap(nodes), edges, prev).size).toBe(0);
  });
});

describe('routeIncrementalCables (P-1/P-5)', () => {
  it('kalter Vorlauf (leer) verhält sich wie der Voll-Pass', () => {
    const { nodes, edges } = buildHubPlan();
    const full = routeAllCables(nodes, edges);
    const routed: string[] = [];
    const incr = routeIncrementalCables(
      nodes,
      edges,
      { routes: new Map(), rects: new Map(), topo: new Map() },
      (id) => routed.push(id)
    );
    expect(routed.sort()).toEqual([...edges.map((edge) => edge.id)].sort());
    expect([...incr.entries()]).toEqual([...full.entries()]);
  });

  it('unveränderter Plan: kein Re-Route, alle Objekte identisch (kein Re-Render)', () => {
    const { nodes, edges } = buildHubPlan();
    const prev = buildPrev(nodes, edges);
    const routed: string[] = [];
    const second = routeIncrementalCables(nodes, edges, prev, (id) => routed.push(id));
    expect(routed).toEqual([]);
    for (const edge of edges) {
      expect(second.get(edge.id)).toBe(prev.routes.get(edge.id));
    }
  });

  it('bewegter Knoten: nur Betroffene neu verlegt, Fremdkante referenzstabil', () => {
    const { nodes, edges } = buildHubPlan();
    const prev = buildPrev(nodes, edges);
    const moved = nodes.map((node) => (node.id === 'b' ? { ...node, position: { x: 630, y: 60 } } : node));
    const affected = computeAffectedEdgeIds(nodeObstacleMap(moved), edges, prev);
    const routed: string[] = [];
    const second = routeIncrementalCables(moved, edges, prev, (id) => routed.push(id));
    // Der Router verlegt exakt das Affected-Set: O(betroffen) statt O(E).
    expect(routed.sort()).toEqual([...affected].sort());
    for (const edge of edges) {
      if (affected.has(edge.id)) {
        expect(second.get(edge.id)?.waypoints.length ?? 0).toBeGreaterThanOrEqual(2);
      } else {
        expect(second.get(edge.id)).toBe(prev.routes.get(edge.id));
      }
    }
    expect(second.get('e-far')).toBe(prev.routes.get('e-far'));
    expect(violationCount(moved, edges, second)).toBe(0);
  });

  it('Settle-Szenario: verspätetes Messmaß bewegt nur die eigene Umgebung', () => {
    // Lauf 1 mit Fallback-Maßen am Knoten c, Lauf 2 mit gemessenem Maß —
    // exakt die Auto-Wire-Sequenz, die früher alle Trassen springen ließ.
    const { nodes, edges } = buildHubPlan();
    const fallback = nodes.map((node) => (node.id === 'c' ? { ...node, width: 120, height: 80 } : node));
    const prev = buildPrev(fallback, edges);
    expect(violationCount(fallback, edges, prev.routes)).toBe(0);
    const routed: string[] = [];
    const second = routeIncrementalCables(nodes, edges, prev, (id) => routed.push(id));
    expect(routed).toContain('e-hub-c');
    expect(routed).not.toContain('e-far');
    // Die ferne Trasse behält Weg UND Identität: kein Springen, kein Flackern.
    expect(second.get('e-far')).toBe(prev.routes.get('e-far'));
    expect(second.get('e-far')?.waypoints).toEqual(prev.routes.get('e-far')?.waypoints);
    expect(violationCount(nodes, edges, second)).toBe(0);
  });

  it('neue Kante: Fremdkante bleibt stabil, Invarianten halten', () => {
    const { nodes, edges } = buildHubPlan();
    const before = edges.filter((edge) => edge.id !== 'e-hub-c');
    const prev = buildPrev(nodes, before);
    const routed: string[] = [];
    const second = routeIncrementalCables(nodes, edges, prev, (id) => routed.push(id));
    expect(routed).toContain('e-hub-c');
    expect(second.get('e-far')).toBe(prev.routes.get('e-far'));
    expect(violationCount(nodes, edges, second)).toBe(0);
  });

  it('Reconnect: umverdrahtete Kante wird neu verlegt (kein Stale-Pfad)', () => {
    const { nodes, edges } = buildHubPlan();
    const prev = buildPrev(nodes, edges);
    const reconnected = edges.map((edge) => (edge.id === 'e-hub-c' ? { ...edge, target: 'b' } : edge));
    const routed: string[] = [];
    const second = routeIncrementalCables(nodes, reconnected, prev, (id) => routed.push(id));
    expect(routed).toContain('e-hub-c');
    expect(second.get('e-hub-c')?.waypoints.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(violationCount(nodes, reconnected, second)).toBe(0);
  });

  it('ist deterministisch: gleicher Vorlauf plus gleiche Eingabe ⇒ gleiche Wege', () => {
    const { nodes, edges } = buildHubPlan();
    const prev = buildPrev(nodes, edges);
    const moved = nodes.map((node) => (node.id === 'b' ? { ...node, position: { x: 630, y: 60 } } : node));
    const first = routeIncrementalCables(moved, edges, prev);
    const second = routeIncrementalCables(moved, edges, prev);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });
});
