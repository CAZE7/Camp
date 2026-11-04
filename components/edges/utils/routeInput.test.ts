/**
 * P0 / ROUTE-INPUT-001 — Regressionstests gegen Phantom-Leitungen und
 * stille Anschlusswechsel. Der Review-Befund (2026-11) nannte zwei konkrete
 * Code-Stellen: `if (!srcNode && !tgtNode) continue;` und
 * `group?.find(...) ?? group?.[0]`. Beide Fälle sind hier festgenagelt —
 * inklusive der Forderung, dass der LIVE-Report dieselbe Wahrheit nutzt.
 */
import { describe, expect, it } from 'vitest';
import { Position, type Node } from '@xyflow/react';
import { checkRoutingInputs } from './routeInput';
import { resolveHandlePoint, routeAllCables, type RouteEdgeRef } from './routeAll';
import { computeCableRouteFinalValidation } from './cableRouteStore';
import type { RoutableNode } from './nodeGeometry';
import type { PathResult } from './pathfinding';

const makeNode = (id: string, x: number, y: number): Node => ({
  id,
  type: 'consumer',
  position: { x, y },
  width: 192,
  height: 120,
  data: { label: id },
});

/** Gemessene Anschlüsse: plus liegt oben, minus unten (je Seite). */
const measuredHandles = (offsetY: number) => ({
  source: [
    { id: 'minus', x: 192, y: 84 + offsetY, width: 8, height: 8, position: Position.Right },
    { id: 'plus', x: 192, y: 24 + offsetY, width: 8, height: 8, position: Position.Right },
  ],
  target: [
    { id: 'minus', x: 0, y: 84 + offsetY, width: 8, height: 8, position: Position.Left },
    { id: 'plus', x: 0, y: 24 + offsetY, width: 8, height: 8, position: Position.Left },
  ],
});

const withHandles = (node: Node): RoutableNode =>
  ({ ...node, handleBounds: measuredHandles(0) }) as RoutableNode;

describe('checkRoutingInputs — ein Eingangstor für Router und Report', () => {
  it('ein fehlendes Bauteil (nicht nur BEIDE) macht die Leitung unroutbar', () => {
    const nodes = [makeNode('b', 400, 0)];
    const edges: RouteEdgeRef[] = [
      { id: 'e-missing-source', source: 'gone', target: 'b' },
      { id: 'e-missing-target', source: 'b', target: 'gone' },
      { id: 'e-ok', source: 'b', target: 'b' },
    ];
    const check = checkRoutingInputs(nodes as RoutableNode[], edges);

    expect([...check.routableEdgeIds]).toEqual(['e-ok']);
    expect(check.violations.map((v) => [v.edgeId, v.code, v.nodeId, v.side])).toEqual([
      ['e-missing-source', 'ROUTE-MISSING-NODE', 'gone', 'source'],
      ['e-missing-target', 'ROUTE-MISSING-NODE', 'gone', 'target'],
    ]);
    expect(check.violations[0]!.detail).toContain('keine Ersatzkoordinate');
    expect(check.violations[0]!.remedy.length).toBeGreaterThan(10);
  });

  it('Knoten ohne Canvas-Geometrie gilt als fehlend (kein undefined.x)', () => {
    const ghost = { id: 'ghost', type: 'consumer', data: {} } as unknown as RoutableNode;
    const check = checkRoutingInputs(
      [makeNode('b', 0, 0) as RoutableNode, ghost],
      [{ id: 'e', source: 'ghost', target: 'b' }]
    );
    expect(check.routableEdgeIds.size).toBe(0);
    expect(check.violations[0]!.code).toBe('ROUTE-MISSING-NODE');
  });

  it('unbekannter benannter Anschluss ist ein harter Eingabefehler', () => {
    const nodes = [withHandles(makeNode('a', 0, 0))];
    const edges: RouteEdgeRef[] = [
      { id: 'e-unknown', source: 'a', target: 'a', sourceHandle: 'defekt', targetHandle: 'plus' },
      { id: 'e-known', source: 'a', target: 'a', sourceHandle: 'plus', targetHandle: 'minus' },
    ];
    const check = checkRoutingInputs(nodes, edges);
    expect([...check.routableEdgeIds]).toEqual(['e-known']);
    expect(check.violations).toHaveLength(1);
    expect(check.violations[0]).toMatchObject({
      edgeId: 'e-unknown',
      code: 'ROUTE-UNKNOWN-HANDLE',
      nodeId: 'a',
      handleId: 'defekt',
      side: 'source',
    });
  });

  it('ohne gemessene Handles bleibt die dokumentierte R-7-Flussauflösung routbar', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 600, 0)];
    const edges: RouteEdgeRef[] = [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'plus' }];
    expect(checkRoutingInputs(nodes as RoutableNode[], edges).routableEdgeIds.has('e')).toBe(true);
  });

  it('reine Darstellungsknoten werden auch hier nicht als Bauteil gezählt', () => {
    const frame = { ...makeNode('frame', 0, 0), type: 'backboneGroup' } as RoutableNode;
    const check = checkRoutingInputs([frame], [{ id: 'e', source: 'frame', target: 'frame' }]);
    expect(check.routableEdgeIds.size).toBe(0);
  });

  it('deterministisch: Eingabereihenfolge ändert die Befunde nicht', () => {
    const nodes = [makeNode('a', 0, 0)];
    const edges: RouteEdgeRef[] = [
      { id: 'e2', source: 'x', target: 'a' },
      { id: 'e1', source: 'a', target: 'y' },
    ];
    const a = checkRoutingInputs(nodes as RoutableNode[], edges);
    const b = checkRoutingInputs(nodes as RoutableNode[], [...edges].reverse());
    expect(a.violations).toEqual(b.violations);
  });
});

describe('routeAllCables — keine Phantom-Leitung zum Ursprung', () => {
  it('resolveHandlePoint liefert undefined statt (0,0)', () => {
    expect(resolveHandlePoint(undefined, 'plus', 'source')).toBeUndefined();
    expect(resolveHandlePoint({ id: 'x' } as RoutableNode, null, 'source')).toBeUndefined();
  });

  it('ein fehlender Endpunkt erzeugt KEINE Route und verschiebt keine Nachbartrasse', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 600, 0)];
    const edges: RouteEdgeRef[] = [
      { id: 'e-hanging', source: 'a', target: 'deleted' },
      { id: 'e-valid', source: 'a', target: 'b' },
    ];
    const routes = routeAllCables(nodes as RoutableNode[], edges);
    expect(routes.has('e-hanging')).toBe(false);
    expect(routes.has('e-valid')).toBe(true);
    expect(routes.get('e-valid')!.waypoints.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(
      true
    );

    // Die gültige Trasse ist identisch zu einem Lauf ohne die Hängekante.
    const alone = routeAllCables(nodes as RoutableNode[], [edges[1]!]);
    expect(routes.get('e-valid')!.waypoints).toEqual(alone.get('e-valid')!.waypoints);
  });

  it('ein unbekannter Anschluss landet NICHT auf dem ersten gemessenen Handle', () => {
    const node = withHandles(makeNode('a', 0, 0));
    const nodes = [node, withHandles(makeNode('b', 600, 0))];
    const edges: RouteEdgeRef[] = [
      { id: 'e-unknown', source: 'a', target: 'b', sourceHandle: 'nicht-vorhanden', targetHandle: 'plus' },
    ];
    expect(routeAllCables(nodes, edges).size).toBe(0);
    expect(resolveHandlePoint(node, 'nicht-vorhanden', 'source')).toBeUndefined();
    expect(resolveHandlePoint(node, 'plus', 'source')!.y).toBe(28);
    expect(resolveHandlePoint(node, 'minus', 'source')!.y).toBe(88);
  });
});

describe('Live-Report benutzt denselben strengen Validator', () => {
  it('fehlendes Bauteil und unbekannter Anschluss erscheinen als eigene kritische Befunde', () => {
    const nodes = [withHandles(makeNode('a', 0, 0))];
    const edges: RouteEdgeRef[] = [
      { id: 'e-missing', source: 'a', target: 'deleted' },
      { id: 'e-handle', source: 'a', target: 'a', sourceHandle: 'defekt', targetHandle: 'plus' },
    ];
    const routes = routeAllCables(nodes, edges);
    const report = computeCableRouteFinalValidation(nodes, edges, routes);

    expect(report.status).toBe('INVALID');
    expect(routes.size).toBe(0);
    const codes = (report.contractViolations ?? []).map((v) => v.code);
    expect(codes).toContain('ROUTE-MISSING-NODE');
    expect(codes).toContain('ROUTE-UNKNOWN-HANDLE');
    // Kein doppelter ROUTE-MISSING-Befund aus dem Routen-Vertrag.
    expect(codes).not.toContain('ROUTE-MISSING');
    expect(report.counts.contractViolations).toBe(codes.length);
    const missing = report.contractViolations!.find((v) => v.code === 'ROUTE-MISSING-NODE')!;
    expect(missing.nodeId).toBe('deleted');
    expect(missing.remedy).toContain('wiederherstellen');
    const handle = report.contractViolations!.find((v) => v.code === 'ROUTE-UNKNOWN-HANDLE')!;
    expect(handle.handleId).toBe('defekt');
  });

  it('eine trotzdem veröffentlichte Route für eine unroutbare Leitung wird gemeldet', () => {
    const nodes = [makeNode('a', 0, 0)];
    const edges: RouteEdgeRef[] = [{ id: 'e', source: 'a', target: 'gone' }];
    const report = computeCableRouteFinalValidation(
      nodes as RoutableNode[],
      edges,
      new Map([
        [
          'e',
          {
            waypoints: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
            ],
          },
        ],
      ] as never)
    );
    expect(report.contractViolations?.map((v) => v.code)).toContain('ROUTE-UNEXPECTED');
  });
});

/** Vier Vertragsfälle aus AUDIT-ROUTING-2026-10-24 (B-02/B-03). */
describe('strenger Validator im Live-Pfad — Vertragsfälle', () => {
  const nodeA = makeNode('a', 100, 100);
  const nodeB = makeNode('b', 700, 100);
  const nodes = [nodeA, nodeB] as RoutableNode[];
  const edge: RouteEdgeRef = { id: 'e', source: 'a', target: 'b' };

  const routeMap = (waypoints: { x: number; y: number }[]) =>
    new Map([['e', { waypoints }]] as unknown as [string, PathResult][]);

  it('fehlende Route ⇒ ROUTE-MISSING, nicht VALID', () => {
    const report = computeCableRouteFinalValidation(nodes, [edge], new Map());
    expect(report.status).toBe('INVALID');
    expect(report.contractViolations?.map((v) => v.code)).toContain('ROUTE-MISSING');
  });

  it('Ein-Punkt-/Diagonalroute ⇒ ROUTE-SHAPE', () => {
    const report = computeCableRouteFinalValidation(
      nodes,
      [edge],
      routeMap([
        { x: 292, y: 160 },
        { x: 700, y: 300 },
      ])
    );
    expect(report.contractViolations?.map((v) => v.code)).toContain('ROUTE-SHAPE');
  });

  it('Wiedereintritt in das eigene Anschlussgerät ⇒ ROUTE-OWN-NODE', () => {
    const report = computeCableRouteFinalValidation(
      nodes,
      [edge],
      routeMap([
        { x: 292, y: 160 },
        { x: 316, y: 160 },
        { x: 316, y: 300 },
        { x: 180, y: 300 },
        { x: 180, y: 80 },
        { x: 500, y: 80 },
        { x: 500, y: 160 },
        { x: 700, y: 160 },
      ])
    );
    expect(report.contractViolations?.map((v) => v.code)).toContain('ROUTE-OWN-NODE');
  });

  it('langer Port-Stub innerhalb der eigenen Karte ist KEIN Wiedereintritt', () => {
    // Gemessene Handles liegen teils IN der Kartenbox. Der Austritt darf
    // mehrere Segmente brauchen; erst ein erneutes Hineinfahren ist ein Fehler.
    const nodesWithMeasured = [{ ...nodeA, measured: { width: 192, height: 120 } }, nodeB] as RoutableNode[];
    const report = computeCableRouteFinalValidation(
      nodesWithMeasured,
      [edge],
      routeMap([
        { x: 250, y: 160 },
        { x: 280, y: 160 },
        { x: 280, y: 420 },
        { x: 700, y: 420 },
      ])
    );
    expect(report.contractViolations?.map((v) => v.code)).not.toContain('ROUTE-OWN-NODE');
  });
});
