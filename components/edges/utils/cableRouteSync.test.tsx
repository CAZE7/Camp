/**
 * UI-AUDIT 2026-10-13 — Integrationstests für `CableRouteSync`.
 *
 * `CableRouteSync` war vorher nirgends mit echtem React-Flow-Store getestet:
 * `FlowCanvas.test.tsx` stubbt das Modul als No-Op, und die Unit-Tests der
 * `cableRouteStore` prüfen nur die Publish-Funktionen. Damit blieb genau die
 * Strecke ungeprüft, auf der die drei Befunde RS-001/002/003 saßen:
 * Eingabe → Generation → Lauf → Veröffentlichung → UI-Zustand.
 *
 * Diese Datei fährt den echten Pfad (`ReactFlowProvider` + `ReactFlow` +
 * `nodeLookup`), mockt ausschließlich `routeAllCables` und prüft die
 * Zusicherungen, die die Anzeige macht.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, waitFor, type RenderResult } from '@testing-library/react';
import React from 'react';
import { ReactFlow, ReactFlowProvider, type Edge, type Node } from '@xyflow/react';
import {
  CableRouteSync,
  clearCableRoutes,
  getCableRouteSnapshot,
  publishCableRouteResult,
} from './cableRouteStore';
import * as routeAllModule from './routeAll';
import type { PathResult } from './pathfinding';
import type { FinalValidationReport } from '../../../lib/routing/finalValidation';

// Die echte Implementierung wird gebraucht, um den Mock zwischen den Tests
// wieder scharf zu machen: `mockRestore()` würde sie auf `undefined`
// zurücksetzen und der Lauf damit selbst zum Fehlerfall werden.
const hoisted = vi.hoisted(() => ({ real: undefined as unknown }));

vi.mock('./routeAll', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./routeAll')>();
  hoisted.real = actual.routeAllCables;
  return { ...actual, routeAllCables: vi.fn(actual.routeAllCables) };
});

const realRouteAllCables = hoisted.real as typeof routeAllModule.routeAllCables;

const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b', data: {} }];

const nodesAt = (offset: number): Node[] => [
  { id: 'a', position: { x: 0 + offset, y: 0 }, width: 100, height: 100, data: {} },
  { id: 'b', position: { x: 300 + offset, y: 0 }, width: 100, height: 100, data: {} },
];

function Harness({ ns }: { ns: Node[] }) {
  return (
    <ReactFlowProvider>
      <ReactFlow nodes={ns} edges={edges}>
        <CableRouteSync />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

const knownRoute = { waypoints: [{ x: 1, y: 2 }], length: 3 } as unknown as PathResult;
const knownReport = {
  status: 'VALID',
  edgeCount: 1,
  counts: { edgeNodeCollisions: 0, edgeEdgeOverlaps: 0, clearanceViolations: 0 },
  violations: [],
} as unknown as FinalValidationReport;

/**
 * React Flow übernimmt die Knoten asynchron; der erste Lauf sieht deshalb ein
 * leeres `nodeLookup`. Gewartet wird auf den Lauf MIT Knoten — sonst prüft man
 * den Hash des leeren Graphen.
 */
const waitForSettledRun = async (): Promise<void> => {
  await waitFor(() => {
    const snap = getCableRouteSnapshot();
    expect(snap.report).toBeDefined();
    expect(vi.mocked(routeAllModule.routeAllCables)).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'a' })]),
      expect.anything()
    );
    // Veröffentlichtes Ergebnis gehört zur angemeldeten Eingabe.
    expect(snap.publishedHash).toBe(snap.generation?.hash);
  });
};

describe('CableRouteSync — Veröffentlichung und Fehlerpfad (UI-AUDIT RS-001/002/003)', () => {
  let view: RenderResult;

  beforeEach(() => {
    clearCableRoutes();
    vi.mocked(routeAllModule.routeAllCables).mockReset();
    vi.mocked(routeAllModule.routeAllCables).mockImplementation(realRouteAllCables);
  });
  afterEach(() => {
    cleanup();
    clearCableRoutes();
  });

  it('Route, Report und Generation gehören nach einem Lauf zur selben Eingabe', async () => {
    view = render(<Harness ns={nodesAt(0)} />);
    await waitForSettledRun();
    const snap = getCableRouteSnapshot();
    expect(['valid', 'invalid']).toContain(snap.phase);
    expect(snap.publishedGeneration).toBe(snap.generation?.generation);
    expect(snap.errorMessage).toBeUndefined();
  });

  it('ein fehlgeschlagener Lauf lässt die letzte Geometrie und ihren Report unangetastet', async () => {
    view = render(<Harness ns={nodesAt(0)} />);
    await waitForSettledRun();

    // Bekannter, gültiger Stand — das, was im Fehlerfall stehen bleiben muss.
    const generation = getCableRouteSnapshot().generation!;
    const known = new Map([['e1', knownRoute]]);
    publishCableRouteResult({ routes: known, report: knownReport, generation });

    vi.mocked(routeAllModule.routeAllCables).mockImplementation(() => {
      throw new Error('boom');
    });

    // Verschieben erzeugt eine neue Eingabe und damit einen neuen Lauf.
    view.rerender(<Harness ns={nodesAt(40)} />);

    await waitFor(() => expect(getCableRouteSnapshot().phase).toBe('error'));
    const after = getCableRouteSnapshot();
    // Geometrie und Report sind dieselben Objekte — nichts wurde verworfen.
    expect(after.routes).toBe(known);
    expect(after.report).toBe(knownReport);
    expect(after.errorMessage).toContain('boom');
    // Der Fehler gehört zur NEUEN Eingabe, nicht still zur alten.
    expect(after.generation?.hash).not.toBe(generation.hash);
    expect(after.publishedHash).toBe(generation.hash);
  });

  it('ein geworfenes Nicht-Error-Objekt ergibt eine lesbare Meldung, kein [object Object]', async () => {
    view = render(<Harness ns={nodesAt(0)} />);
    await waitForSettledRun();
    vi.mocked(routeAllModule.routeAllCables).mockImplementation(() => {
      // Absicht: genau dieser Fall (geworfenes Nicht-Error-Objekt) ist der
      // Prüfgegenstand — er darf nicht als [object Object] im Badge landen.
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- Nicht-Error ist hier der Testfall.
      throw { detail: 42 };
    });
    view.rerender(<Harness ns={nodesAt(40)} />);
    await waitFor(() => expect(getCableRouteSnapshot().phase).toBe('error'));
    const message = getCableRouteSnapshot().errorMessage ?? '';
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain('[object Object]');
  });

  it('ein späterer erfolgreicher Lauf beendet den Fehlerzustand', async () => {
    view = render(<Harness ns={nodesAt(0)} />);
    await waitForSettledRun();
    vi.mocked(routeAllModule.routeAllCables).mockImplementation(() => {
      throw new Error('boom');
    });
    view.rerender(<Harness ns={nodesAt(40)} />);
    await waitFor(() => expect(getCableRouteSnapshot().phase).toBe('error'));

    vi.mocked(routeAllModule.routeAllCables).mockImplementation(realRouteAllCables);
    view.rerender(<Harness ns={nodesAt(80)} />);

    await waitFor(() => expect(getCableRouteSnapshot().errorMessage).toBeUndefined());
    expect(['valid', 'invalid']).toContain(getCableRouteSnapshot().phase);
  });
});
