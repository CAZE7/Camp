import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Position, type Edge, type Node } from '@xyflow/react';
import {
  clearCableRoutes,
  computeCableRouteFinalValidation,
  createThrottledRunner,
  edgeTopologySignature,
  getCableRoute,
  getCableRouteFinalValidation,
  nodeLayoutSignature,
  publishCableRoutes,
  publishCableRouteFinalValidation,
  ROUTE_THROTTLE_MS,
} from './cableRouteStore';
import { collectRoutableNodes } from './routableNodes';
import type { RouteEdgeRef } from './routeAll';
import type { RoutableNode } from './nodeGeometry';
import { NODE_FALLBACK_HEIGHT, NODE_FALLBACK_WIDTH, type PathResult } from './pathfinding';
import { totalViolations, validateFinalRouting } from '../../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';

/**
 * R-9 (Cache-/Re-Routing-Korrektheit): Für jede Invalidierungsquelle —
 * Move, Resize, Delete, Connect, Undo/Redo — muss die Layout-Signatur
 * springen, damit CableRouteSync neu routet. Regression: die alte
 * `nodeVersion` war eine Positionssumme; ein Verschieben um (+10, −10)
 * ließ sie unverändert und die Kabel blieben auf der alten Trasse.
 */

const makeNode = (id: string, x: number, y: number, width = 192, height = 120): Node => ({
  id,
  position: { x, y },
  width,
  height,
  data: {},
});

const makeEdge = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} });

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

  it('eine Messung derselben effektiven Fallback-Größe invalidiert das Routing nicht', () => {
    const unmeasured = { id: 'a', position: { x: 0, y: 0 } };
    const measuredAtFallback = {
      ...unmeasured,
      measured: { width: NODE_FALLBACK_WIDTH, height: NODE_FALLBACK_HEIGHT },
    };
    const measuredAtNewSize = { ...unmeasured, measured: { width: 240, height: 160 } };

    expect(nodeLayoutSignature([measuredAtFallback])).toBe(nodeLayoutSignature([unmeasured]));
    expect(nodeLayoutSignature([measuredAtNewSize])).not.toBe(nodeLayoutSignature([unmeasured]));
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

  it('Änderungen an gemessenen Handle-Rechtecken invalidieren das Routing', () => {
    const withHandleAt = (y: number) => ({
      ...makeNode('a', 0, 0),
      internals: {
        handleBounds: {
          source: [{ id: 'port', x: -15, y, width: 10, height: 10, position: Position.Left }],
        },
      },
    });

    const at15 = nodeLayoutSignature([withHandleAt(15)]);
    const at45 = nodeLayoutSignature([withHandleAt(45)]);

    expect(at45).not.toBe(at15);
  });

  it('Knotentypen invalidieren Backbone-Hop-Prioritäten', () => {
    const battery = { ...makeNode('a', 0, 0), type: 'battery' };
    const consumer = { ...makeNode('a', 0, 0), type: 'consumer' };

    expect(nodeLayoutSignature([consumer])).not.toBe(nodeLayoutSignature([battery]));
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
      { id: 'e1', source: 'a', target: 'b', sourceHandle: null, targetHandle: null },
    ]);
    const handled = edgeTopologySignature([makeEdge('e1', 'a', 'b')]);
    const withHandle = edgeTopologySignature([
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus', targetHandle: 'plus' },
    ]);
    expect(plain).not.toBe(withHandle);
    expect(handled).not.toBe(withHandle);
  });

  it('Hop-Prioritätsmerkmale invalidieren die Kantensignatur', () => {
    const base = {
      ...makeEdge('e1', 'a', 'b'),
      data: { edgeDomain: 'AC_230V', crossSection: 2.5, locked: false },
    };
    const changedDomain = { ...base, data: { ...base.data, edgeDomain: 'DC_12V' } };
    const changedSection = { ...base, data: { ...base.data, crossSection: 35 } };
    const locked = { ...base, data: { ...base.data, locked: true } };
    const signature = edgeTopologySignature([base]);

    expect(edgeTopologySignature([changedDomain])).not.toBe(signature);
    expect(edgeTopologySignature([changedSection])).not.toBe(signature);
    expect(edgeTopologySignature([locked])).not.toBe(signature);
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
    expect(report.counts).toEqual({ edgeNodeCollisions: 1, edgeEdgeOverlaps: 0, clearanceViolations: 0, sanityViolations: 0 });
  });

  /**
   * Statische Regression: Ein Rahmen, der irrtümlich als Bauteil in
   * `validateFinalRouting` oder `routeAllCables` landet, kann die Ausgabe
   * ändern. Dieser Unit-Test belegt die Filterwirkung; er belegt NICHT, dass
   * der Rahmen die gemeldete Browser-Oszillation verursacht hat.
   */
  describe('Darstellungs-Knoten sind kein Routing-Input', () => {
    // Entspricht `withBackboneGroup`: deklarierte width/height und style
    // stehen bereits vor der DOM-Messung. Eine tatsächliche Messung darf
    // abweichen; der Diagnose-Snapshot sieht sie, die Route-Signatur nicht.
    const frameAt = (measured: boolean, width = 844, height = 392) => ({
      id: '__planner-backbone-group',
      type: 'backboneGroup',
      position: { x: -44, y: -56 },
      width: 844,
      height: 392,
      style: { width: 844, height: 392 },
      ...(measured ? { measured: { width, height } } : {}),
      data: { label: 'Hauptstromkreis', presentationOnly: true },
    });

    /** Zwei Bauteile mit einer Leitung dazwischen — und einem Rahmen darum. */
    const plan = () => ({
      nodes: [
        makeNode('a', 100, 100, 120, 80),
        makeNode('b', 600, 100, 120, 80),
      ] as unknown as RoutableNode[],
      edges: [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ] as unknown as RouteEdgeRef[],
      routes: new Map<string, PathResult>([
        [
          'e1',
          {
            path: 'M 220 140 L 600 140',
            waypoints: [
              { x: 220, y: 140 },
              { x: 600, y: 140 },
            ],
            labelX: 410,
            labelY: 145,
            offsetX: 0,
            offsetY: 0,
            length: 380,
            bends: 0,
            crossings: 0,
            usedSearch: 'catalog',
          },
        ],
      ]),
    });

    it('zählt den Rahmen nicht als Bauteil (I1 bleibt 0)', () => {
      const { nodes, edges, routes } = plan();
      const withoutFrame = computeCableRouteFinalValidation(nodes, edges, routes);
      const withFrame = computeCableRouteFinalValidation(
        [...nodes, frameAt(true) as unknown as RoutableNode],
        edges,
        routes
      );

      expect(withoutFrame.status).toBe('VALID');
      // Vorher: der Rahmen umschließt beide Enden, die Leitung schneidet
      // seinen Rand ⇒ I1 ≥ 1, obwohl kein Kabel durch ein Bauteil läuft.
      expect(withFrame.counts).toEqual(withoutFrame.counts);
      expect(withFrame.status).toBe('VALID');
    });

    it('Kontrollprobe: derselbe Kasten als Bauteil ist eine echte Verletzung', () => {
      const { nodes, edges, routes } = plan();
      const asComponent = {
        ...frameAt(true),
        type: 'conduit',
        data: { label: 'Leerrohr' },
      } as unknown as RoutableNode;

      const report = computeCableRouteFinalValidation([...nodes, asComponent], edges, routes);

      expect(report.status).toBe('INVALID');
      expect(totalViolations(report.counts)).toBeGreaterThan(0);
    });

    it('eine Messabweichung des Rahmens wird beobachtbar, löst aber kein Routing aus', () => {
      const { nodes } = plan();
      const measured = [...nodes, frameAt(true, 900, 420) as unknown as RoutableNode];
      const unmeasured = [...nodes, frameAt(false) as unknown as RoutableNode];

      // Kontrollprobe: ohne Filter würde eine von den deklarierten Maßen
      // abweichende DOM-Messung die Geometrie-Signatur ändern.
      expect(nodeLayoutSignature(measured)).not.toBe(nodeLayoutSignature(unmeasured));

      const signature = (input: RoutableNode[]) => nodeLayoutSignature(collectRoutableNodes(input).routable);
      expect(signature(measured)).toBe(signature(unmeasured));
      expect(signature(measured)).toBe(nodeLayoutSignature(nodes as unknown as RoutableNode[]));
    });
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
