import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatRoutingDebugRun,
  logRoutingRun,
  ROUTING_DEBUG_GLOBAL,
  routingDebugEnabled,
  type RoutingNodeGeometry,
  type RoutingDebugNode,
} from './routingDebug';

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
});
