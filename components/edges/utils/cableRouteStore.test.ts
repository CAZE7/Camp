import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';
import {
  clearCableRoutes,
  createThrottledRunner,
  edgeTopologySignature,
  getCableRoute,
  nodeLayoutSignature,
  publishCableRoutes,
  ROUTE_THROTTLE_MS,
} from './cableRouteStore';

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
