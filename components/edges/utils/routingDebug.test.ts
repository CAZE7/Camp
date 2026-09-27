import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRoutingTraceSnapshot,
  describeRoutingStateChange,
  detectAlternatingRoutingCycle,
  formatRoutingDebugRun,
  logRoutingInputChange,
  logRoutingResult,
  logRoutingRun,
  routingDebugGeometrySignature,
  ROUTING_DEBUG_GLOBAL,
  ROUTING_TRACE_GLOBAL,
  routingDebugEnabled,
  type RoutingNodeGeometry,
  type RoutingDebugNode,
} from './routingDebug';
import type { PathResult } from './pathfinding';
import type { FinalValidationReport } from '../../../lib/routing/finalValidation';

/**
 * Die Diagnose aus dem Bugreport („Routing springt zwischen 0 und 20“) muss
 * ohne Konsole prüfbar sein — und sie muss den Zustandswechsel
 * „gemessen ⇄ nicht gemessen“ als Änderung ausweisen, sonst beantwortet sie
 * die Frage nicht, die man ihr stellt.
 */

const node = (
  id: string,
  x: number,
  y: number,
  size: { width?: number; height?: number } | null,
  type = 'consumer'
): RoutingDebugNode => ({
  id,
  type,
  position: { x, y },
  ...(size ? { measured: { width: size.width, height: size.height } } : {}),
  data: {},
});

const geometry = (id: string, width: number | null, height: number | null): RoutingNodeGeometry => ({
  id,
  type: 'consumer',
  x: 0,
  y: 0,
  width,
  height,
});

describe('Routing-Diagnose', () => {
  it('ist ohne Flag aus', () => {
    // Kein NEXT_PUBLIC_ROUTING_DEBUG im Testlauf gesetzt.
    expect(process.env.NEXT_PUBLIC_ROUTING_DEBUG).toBeUndefined();
    expect(routingDebugEnabled()).toBe(false);
  });

  it('formatiert einen Lauf mit Anzahl, Änderung und Knoten-Geometrie', () => {
    const lines = formatRoutingDebugRun(
      1,
      {
        routable: [geometry('a', 192, 120), geometry('b', 192, 120)],
        presentation: [{ id: 'frame', type: 'backboneGroup', x: -44, y: -56, width: 844, height: 392 }],
      },
      new Map()
    );

    expect(lines[0]).toBe('[ROUTING] Lauf 1: 2 geroutet, 1 übersprungen (Darstellung)');
    expect(lines[1]).toContain('a (neu) 0,0:192×120');
    expect(lines[1]).toContain('frame (neu) -44,-56:844×392');
    expect(lines[1]).not.toContain('b 0,0'); // b taucht nur als (neu) auf, nicht zusätzlich
    expect(lines[2]).toContain('a consumer 0,0:192×120');
    expect(lines[3]).toContain('übersprungen frame backboneGroup -44,-56:844×392');
  });

  it('meldet den Wechsel „gemessen ⇄ nicht gemessen“ als Änderung', () => {
    const before = new Map([['frame', '-44,-56:844×392']]);

    const unmeasured = formatRoutingDebugRun(
      2,
      {
        routable: [],
        presentation: [{ id: 'frame', type: 'backboneGroup', x: -44, y: -56, width: null, height: null }],
      },
      before
    );
    expect(unmeasured[1]).toBe('[ROUTING] Δ frame -44,-56:844×392 → -44,-56:—×—');

    const unchanged = formatRoutingDebugRun(
      3,
      {
        routable: [],
        presentation: [{ id: 'frame', type: 'backboneGroup', x: -44, y: -56, width: null, height: null }],
      },
      new Map([['frame', '-44,-56:—×—']])
    );
    expect(unchanged[1]).toBe('[ROUTING] Δ (unverändert)');
  });

  it('meldet entfernte Knoten', () => {
    const lines = formatRoutingDebugRun(
      4,
      { routable: [], presentation: [] },
      new Map([['gone', '1,2:10×10']])
    );
    expect(lines[1]).toBe('[ROUTING] Δ gone 1,2:10×10 → (entfernt)');
  });

  describe('logRoutingRun', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal(ROUTING_DEBUG_GLOBAL, true);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('läuft nur mit Flag und zählt die Läufe hoch', () => {
      expect(routingDebugEnabled()).toBe(true);

      logRoutingRun([node('a', 0, 0, { width: 192, height: 120 })]);
      logRoutingRun([
        node('a', 0, 0, null),
        node('frame', -44, -56, { width: 844, height: 392 }, 'backboneGroup'),
      ]);

      const calls = vi.mocked(console.warn).mock.calls.map((call) => String(call[0]));
      expect(calls[0]).toBe('[ROUTING] Lauf 1: 1 geroutet, 0 übersprungen (Darstellung)');
      expect(calls).toContain('[ROUTING] Lauf 2: 1 geroutet, 1 übersprungen (Darstellung)');
      expect(calls.some((line) => line.includes('a 0,0:192×120 → 0,0:—×—'))).toBe(true);
    });
  });

  describe('strukturierter Laufzeit-Trace', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal(ROUTING_DEBUG_GLOBAL, true);
      vi.stubGlobal(ROUTING_TRACE_GLOBAL, []);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('protokolliert effektive, deklarierte und rohe Messmaße getrennt', () => {
      const snapshot = createRoutingTraceSnapshot([node('unmeasured', 0, 0, null)], [], 'signature');

      expect(snapshot.routableNodes[0]).toMatchObject({
        id: 'unmeasured',
        dimensions: { width: 192, height: 120 },
        declared: { width: null, height: null },
        measured: { width: null, height: null },
      });
    });

    it('enthält getrennte Hashes für geroutete Nodes, Presentation Nodes und Kanten', () => {
      const routable = node('a', 10, 20, { width: 192, height: 120 });
      const frame = {
        ...node('frame', -44, -56, { width: 844, height: 392 }, 'backboneGroup'),
        data: { presentationOnly: true },
      };
      const edges = [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus', data: { edgeDomain: 'DC_12V' } },
      ];
      const snapshot = createRoutingTraceSnapshot([routable, frame], edges, 'route-input-1');

      expect(snapshot.routingSignatureHash).toMatch(/^[\da-f]{8}$/);
      expect(snapshot.nodeHash).toMatch(/^[\da-f]{8}$/);
      expect(snapshot.presentationHash).toMatch(/^[\da-f]{8}$/);
      expect(snapshot.edgeHash).toMatch(/^[\da-f]{8}$/);
      expect(snapshot.graphHash).toMatch(/^[\da-f]{8}$/);
      expect(snapshot.routableNodes[0]).toMatchObject({
        id: 'a',
        position: { x: 10, y: 20 },
        dimensions: { width: 192, height: 120 },
        measured: { width: 192, height: 120 },
        presentationOnly: false,
      });
      expect(snapshot.presentationNodes[0]).toMatchObject({
        id: 'frame',
        dimensions: { width: 844, height: 392 },
        presentationOnly: true,
      });
      expect(snapshot.edges[0]).toMatchObject({ id: 'e1', source: 'a', target: 'b', edgeDomain: 'DC_12V' });
    });

    it('unterscheidet eine Routing-Eingabeänderung von einer Presentation-only-Messung', () => {
      const base = createRoutingTraceSnapshot(
        [node('a', 0, 0, { width: 192, height: 120 })],
        [{ id: 'e1', source: 'a', target: 'b' }],
        'signature-a'
      );
      const resized = createRoutingTraceSnapshot(
        [node('a', 0, 0, { width: 240, height: 120 })],
        [{ id: 'e1', source: 'a', target: 'b' }],
        'signature-b'
      );
      const frameNode = {
        ...node('frame', -44, -56, null, 'backboneGroup'),
        width: 844,
        height: 392,
        data: { presentationOnly: true },
      };
      const frameSized = createRoutingTraceSnapshot(
        [node('a', 0, 0, { width: 192, height: 120 }), frameNode],
        [{ id: 'e1', source: 'a', target: 'b' }],
        'signature-a'
      );
      const measuredFrame = createRoutingTraceSnapshot(
        [
          node('a', 0, 0, { width: 192, height: 120 }),
          { ...frameNode, measured: { width: 844, height: 392 } },
        ],
        [{ id: 'e1', source: 'a', target: 'b' }],
        'signature-a'
      );

      expect(describeRoutingStateChange(base, resized)).toMatchObject({
        kind: 'routing-input-change',
        routingInputChanged: true,
      });
      expect(describeRoutingStateChange(frameSized, measuredFrame)).toMatchObject({
        kind: 'presentation-only-change',
        routingInputChanged: false,
        presentationOnlyChanged: true,
      });
    });

    it('unterscheidet deklarierte Maße von gleich großen DOM-Messwerten', () => {
      const declared = {
        ...node('frame', -44, -56, null, 'backboneGroup'),
        width: 844,
        height: 392,
        data: { presentationOnly: true },
      };
      const measured = { ...declared, measured: { width: 844, height: 392 } };

      expect(routingDebugGeometrySignature([declared])).not.toBe(routingDebugGeometrySignature([measured]));
    });

    it('erkennt den Wechsel A → B → A als Routing-Oszillation', () => {
      expect(detectAlternatingRoutingCycle(['a', 'b'], 'a')).toEqual({
        period: 2,
        signatureHashes: ['a', 'b'],
      });
      expect(detectAlternatingRoutingCycle(['a', 'b'], 'c')).toBeUndefined();
      expect(detectAlternatingRoutingCycle(['a', 'a'], 'a')).toBeUndefined();
    });

    it('protokolliert Mess-Trigger, Routenzahl und Final-Validation strukturiert', () => {
      const input = createRoutingTraceSnapshot(
        [node('a', 0, 0, { width: 192, height: 120 })],
        [{ id: 'e1', source: 'a', target: 'b' }],
        'signature-a'
      );
      const change = describeRoutingStateChange(undefined, input);
      const trigger = logRoutingInputChange(input, change);
      const route: PathResult = {
        path: 'M 0 0 L 200 0',
        hops: [],
        waypoints: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ],
        labelX: 100,
        labelY: 0,
        offsetX: 0,
        offsetY: 0,
        length: 200,
        bends: 0,
        crossings: 0,
        usedSearch: 'astar',
      };
      const report: FinalValidationReport = {
        status: 'VALID',
        counts: { edgeNodeCollisions: 0, edgeEdgeOverlaps: 0, clearanceViolations: 0 },
        violations: [],
        edgeCount: 1,
      };
      logRoutingResult(input, new Map([['e1', route]]), report, [trigger], 2);

      const buffer = (globalThis as unknown as Record<string, unknown>)[ROUTING_TRACE_GLOBAL] as unknown[];
      expect(buffer).toHaveLength(2);
      expect(buffer[0]).toMatchObject({
        event: 'input-change',
        triggerStateChange: { kind: 'initial', routingInputChanged: true },
      });
      expect(buffer[1]).toMatchObject({
        event: 'route-result',
        cableCount: 1,
        violationCount: 0,
        validationStatus: 'VALID',
        triggerStateChanges: [{ sequence: trigger.sequence }],
      });
      expect(
        vi.mocked(console.warn).mock.calls.every(([line]) => String(line).startsWith('[ROUTING_TRACE] '))
      ).toBe(true);
    });
  });
});
