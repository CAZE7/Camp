import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
  clearCableRoutes,
  computeCableRouteFinalValidation,
  createThrottledRunner,
  edgeTopologySignature,
  getCableRoute,
  getCableRouteFinalValidation,
  isPresentationNode,
  nodeLayoutSignature,
  publishCableRoutes,
  publishCableRouteFinalValidation,
  ROUTE_THROTTLE_MS,
  withoutPresentationNodes,
} from './cableRouteStore';
import type { RouteEdgeRef } from './routeAll';
import type { RoutableNode } from './nodeGeometry';
import type { PathResult } from './pathfinding';
import { validateFinalRouting } from '../../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';

/**
 * R-9 (Cache-/Re-Routing-Korrektheit): Für jede Invalidierungsquelle —
 * Move, Resize, Delete, Connect, Undo/Redo — muss die Layout-Signatur
 * springen, damit CableRouteSync neu routet. Regression: die alte
 * `nodeVersion` war eine Positionssumme; ein Verschieben um (+10, −10)
 * ließ sie unverändert und die Kabel blieben auf der alten Trasse.
 */

const makeNode = (id: string, x: number, y: number, width = 192, height = 120): Node =>
  ({ id, position: { x, y }, width, height, data: {} }) as Node;

const makeEdge = (id: string, source: string, target: string): Edge =>
  ({ id, source, target, data: {} }) as Edge;

const nodeSet = (nodes: Node[]): Node[] => nodes;

describe('Invalidierungs-Signaturen (R-9)', () => {
  it('Move: Positionsänderung ändert die Signatur — auch summenneutral (+10, −10)', () => {
    const before = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0), makeNode('b', 100, 100)]));
    const moved = nodeLayoutSignature(nodeSet([makeNode('a', 10, -10), makeNode('b', 100, 100)]));
    expect(moved).not.toBe(before); // alte Summen-Version: 200 === 200 → kein Re-Route (Bug)
  });

  it('Resize: width/height-Änderung ändert die Signatur', () => {
    const before = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0)]));
    const resized = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0, 240, 160)]));
    expect(resized).not.toBe(before);
  });

  it('Delete: fehlender Node ändert die Signatur', () => {
    const before = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0), makeNode('b', 100, 100)]));
    const after = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0)]));
    expect(after).not.toBe(before);
  });

  it('Undo/Redo: die restaurierte Geometrie ergibt exakt die Ausgangssignatur', () => {
    const initial = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0), makeNode('b', 100, 100)]));
    const moved = nodeLayoutSignature(nodeSet([makeNode('a', 42, 17), makeNode('b', 100, 100)]));
    const undone = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0), makeNode('b', 100, 100)]));
    expect(moved).not.toBe(initial);
    expect(undone).toBe(initial);
  });

  it('positionAbsolute schlägt position, wenn vorhanden (React-Flow-Messung)', () => {
    const a = { ...makeNode('a', 0, 0), positionAbsolute: { x: 5, y: 7 } };
    const plain = makeNode('a', 0, 0);
    expect(nodeLayoutSignature([a])).not.toBe(nodeLayoutSignature([plain]));
  });

  it('Connect/Delete/Topologie: jede Kantensignatur-Änderung ist sichtbar', () => {
    const base = edgeTopologySignature([makeEdge('e1', 'a', 'b')]);
    // Connect: neue Kante
    const connected = edgeTopologySignature([makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')]);
    // Delete: Kante weg
    const deleted = edgeTopologySignature([]);
    // Re-Connect: Ziel getauscht
    const retargeted = edgeTopologySignature([makeEdge('e1', 'a', 'c')]);
    expect(connected).not.toBe(base);
    expect(deleted).not.toBe(base);
    expect(retargeted).not.toBe(base);
  });

  it('Handles fließen in die Kantensignatur ein', () => {
    const plain = edgeTopologySignature([
      { id: 'e1', source: 'a', target: 'b', sourceHandle: null, targetHandle: null } as Edge,
    ]);
    const handled = edgeTopologySignature([makeEdge('e1', 'a', 'b')]);
    const withHandle = edgeTopologySignature([
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus', targetHandle: 'plus' } as Edge,
    ]);
    expect(plain).not.toBe(withHandle);
    expect(handled).not.toBe(withHandle);
  });
});

describe('Gedrosseltes Live-Re-Routing (R-9)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('führt Bursts zu genau einem trailing Run aus und läuft sofort bei Abstand', () => {
    const runs: number[] = [];
    const runner = createThrottledRunner(() => runs.push(Date.now()), ROUTE_THROTTLE_MS);

    // Erster Aufruf: sofort (leading).
    runner.schedule();
    expect(runs).toHaveLength(1);

    // Burst innerhalb des Fensters: kein weiterer Run ...
    vi.advanceTimersByTime(10);
    runner.schedule();
    vi.advanceTimersByTime(10);
    runner.schedule();
    expect(runs).toHaveLength(1);

    // ... aber genau einer nach Ablauf des Fensters (trailing).
    vi.advanceTimersByTime(ROUTE_THROTTLE_MS);
    expect(runs).toHaveLength(2);

    // Nach dem Fenster (und außerhalb des trailing-Runs): der nächste
    // Aufruf ist wieder sofort.
    vi.advanceTimersByTime(ROUTE_THROTTLE_MS);
    runner.schedule();
    expect(runs).toHaveLength(3);
  });

  it('cancel verwirft den ausstehenden trailing Run', () => {
    const runs: number[] = [];
    const runner = createThrottledRunner(() => runs.push(Date.now()), ROUTE_THROTTLE_MS);
    runner.schedule();
    runner.schedule(); // trailing geplant
    runner.cancel();
    vi.advanceTimersByTime(ROUTE_THROTTLE_MS * 2);
    expect(runs).toHaveLength(1);
  });
});

describe('Final-Validation-Publikation (AUDIT F-07)', () => {
  it('publiziert den Report des letzten Routinglaufs und clearCableRoutes löscht ihn', () => {
    clearCableRoutes();
    expect(getCableRouteFinalValidation()).toBeUndefined();

    const routed: RoutedEdge[] = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 70 },
          { x: 300, y: 70 },
        ],
      },
    ];
    const rects: NodeRect[] = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
      { id: 'obstacle', x: 140, y: 0, width: 100, height: 100 },
    ];
    const report = validateFinalRouting(routed, rects);
    expect(report.status).toBe('INVALID');

    publishCableRouteFinalValidation(report);
    expect(getCableRouteFinalValidation()).toMatchObject({
      status: 'INVALID',
      edgeCount: 1,
      counts: { edgeNodeCollisions: 1, edgeEdgeOverlaps: 0, clearanceViolations: 0 },
    });

    clearCableRoutes();
    expect(getCableRouteFinalValidation()).toBeUndefined();
  });

  it('publiziert auch ein VALID-Ergebnis, damit der grüne Status sichtbar ist', () => {
    clearCableRoutes();
    const routed: RoutedEdge[] = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 70 },
          { x: 300, y: 70 },
        ],
      },
    ];
    const rects: NodeRect[] = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
    ];
    const report = validateFinalRouting(routed, rects);
    expect(report.status).toBe('VALID');
    publishCableRouteFinalValidation(report);
    expect(getCableRouteFinalValidation()?.status).toBe('VALID');
    clearCableRoutes();
  });

  it('computeCableRouteFinalValidation bildet aus den UI-Waypoints denselben I1-Report', () => {
    const nodes = [
      makeNode('a', 0, 0, 100, 100),
      makeNode('b', 200, 0, 100, 100),
      makeNode('obstacle', 140, 0, 100, 100),
    ] as unknown as RoutableNode[];
    const edges = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: {},
      },
    ] as unknown as RouteEdgeRef[];
    const routes = new Map<string, PathResult>([
      [
        'e1',
        {
          path: 'M 0 70 L 300 70',
          waypoints: [
            { x: 0, y: 70 },
            { x: 300, y: 70 },
          ],
          labelX: 150,
          labelY: 75,
          offsetX: 0,
          offsetY: 0,
          length: 300,
          bends: 0,
          crossings: 0,
          usedSearch: 'catalog',
        },
      ],
    ]);
    const report = computeCableRouteFinalValidation(nodes, edges, routes);
    expect(report.status).toBe('INVALID');
    expect(report.counts).toEqual({ edgeNodeCollisions: 1, edgeEdgeOverlaps: 0, clearanceViolations: 0 });
  });

  // ROUTE-BUG-23: Der Report muss nicht nur zählen, WIE VIELE Züge scheitern,
  // sondern auch sagen, wie viele Leitungen der Router bewusst enger gelegt
  // hat, weil Stub und Mindestabstand geometrisch nicht gleichzeitig passen.
  it('computeCableRouteFinalValidation zählt tightMarginUsed-Leitungen', () => {
    const nodes = [
      makeNode('a', 0, 0, 100, 100),
      makeNode('b', 400, 0, 100, 100),
    ] as unknown as RoutableNode[];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      { id: 'e2', source: 'a', target: 'b', sourceHandle: 'minus', targetHandle: 'minus', data: {} },
    ] as unknown as RouteEdgeRef[];
    const route = (tight?: boolean): PathResult => ({
      path: 'M 100 50 L 400 50',
      waypoints: [
        { x: 100, y: 50 },
        { x: 400, y: 50 },
      ],
      labelX: 250,
      labelY: 55,
      offsetX: 0,
      offsetY: 0,
      length: 300,
      bends: 0,
      crossings: 0,
      usedSearch: 'astar',
      ...(tight ? { tightMarginUsed: true } : {}),
    });
    const report = computeCableRouteFinalValidation(
      nodes,
      edges,
      new Map<string, PathResult>([
        ['e1', route()],
        ['e2', route(true)],
      ])
    );
    expect(report.tightMarginRoutes).toBe(1);
  });
});

describe('cableRouteStore-Publikation (R-9)', () => {
  it('publish ersetzt den Bestand vollständig — gelöschte Kanten verschwinden', () => {
    clearCableRoutes();
    publishCableRoutes(
      new Map([
        [
          'e1',
          {
            path: 'M 0 0',
            waypoints: [],
            labelX: 0,
            labelY: 0,
            offsetX: 0,
            offsetY: 0,
            length: 0,
            bends: 0,
            crossings: 0,
            usedSearch: 'catalog',
          },
        ],
      ])
    );
    expect(getCableRoute('e1')).toBeDefined();
    publishCableRoutes(new Map());
    expect(getCableRoute('e1')).toBeUndefined();
    clearCableRoutes();
  });
});

describe('Präsentations-Nodes (Backbone-Gruppe) nehmen nicht am Routing teil', () => {
  const group = {
    id: '__planner-backbone-group',
    type: 'backboneGroup',
    position: { x: 0, y: 0 },
    data: {},
  } as Node;

  it('isPresentationNode erkennt die Gruppe am Typ, nicht an der ID', () => {
    const renamed: Node = { ...group, id: 'andere-id' };
    expect(isPresentationNode(group)).toBe(true);
    expect(isPresentationNode(renamed)).toBe(true);
    expect(isPresentationNode(makeNode('a', 0, 0))).toBe(false);
  });

  it('withoutPresentationNodes filtert die Gruppe, echte Bauteile bleiben', () => {
    const nodes = [makeNode('a', 0, 0), group, makeNode('b', 300, 0)];
    expect(withoutPresentationNodes(nodes).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('die Gruppe löst kein Re-Routing aus (Signatur ohne Gruppe identisch)', () => {
    // Regression: Die Gruppen-Box (Hindernis um den halben Plan) ließ nach
    // Auto-Wire alle Kabel wiederholt umspringen; jede Neuberechnung der
    // Box stieß einen globalen Pass an.
    const plain = nodeLayoutSignature(nodeSet([makeNode('a', 0, 0), makeNode('b', 300, 0)]));
    const withGroup = nodeLayoutSignature(
      withoutPresentationNodes(nodeSet([makeNode('a', 0, 0), group, makeNode('b', 300, 0)]))
    );
    expect(withGroup).toBe(plain);
  });

  it('computeCableRouteFinalValidation sieht keine Geister-Kollision mit der Gruppe', () => {
    // Die Gruppen-Box umschließt die Leitung vollständig (wie im Browser die
    // Kerntrasse) — ungefiltert wäre das eine I1-Geisterverletzung.
    const enclosingGroup = {
      ...group,
      position: { x: 0, y: 0 },
      measured: { width: 500, height: 200 },
    } as Node;
    const all = [makeNode('a', 0, 0), enclosingGroup, makeNode('b', 300, 0)];
    const nodes = withoutPresentationNodes(all) as unknown as RoutableNode[];
    const edges = [{ id: 'e1', source: 'a', target: 'b' }] as RouteEdgeRef[];
    const routes = new Map<string, PathResult>([
      [
        'e1',
        {
          path: 'M 0 0 L 300 0',
          waypoints: [
            { x: 192, y: 60 },
            { x: 300, y: 60 },
          ],
          labelX: 0,
          labelY: 0,
          offsetX: 0,
          offsetY: 0,
          length: 108,
          bends: 0,
          crossings: 0,
          usedSearch: 'catalog',
        },
      ],
    ]);
    const report = computeCableRouteFinalValidation(nodes, edges, routes);
    // Die Leitung liegt (korrekt) zwischen den Karten — ohne Filter zählte
    // die umschließende Gruppen-Box als I1-Verletzung.
    expect(report.violations.filter((v) => v.invariant === 'I1')).toHaveLength(0);

    // Sensitivität: ungefiltert MUSS dieselbe Geometrie als I1 zählen —
    // sonst würde der Test auch ohne Fix grün.
    const unfiltered = computeCableRouteFinalValidation(all as unknown as RoutableNode[], edges, routes);
    expect(unfiltered.violations.some((v) => v.invariant === 'I1')).toBe(true);
  });
});
