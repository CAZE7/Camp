import { describe, expect, it } from 'vitest';
import {
  assignFanOut,
  compareFanOutRequests,
  fanOutPortIndices,
  portCross,
  portNormal,
  type FanOutRequest,
} from './portFanOut';
import { segmentsCross, type Point, type Segment } from '../geometry';
import { ROUTING_TOKENS } from '../tokens';

/**
 * WP-9 (#398) / ROUTE-BUG-2: Tests des Port Fan-Out.
 *
 * Abnahme: deterministisch (gleicher Input → gleiche Lanes, ADR 0010), die
 * achsparallelste Kante fährt geradeaus, beide Seiten des Ports bekommen
 * eindeutige Beträge, und im Busbar-Szenario kreuzen sich die Stubs nicht.
 */

const grid = ROUTING_TOKENS.laneGrid;
const stubMin = ROUTING_TOKENS.stubMin;

const req = (edgeId: string, cross: number): FanOutRequest => ({ edgeId, cross });

describe('Sortiervertrag', () => {
  it('Quer-Versatz des Gegenübers entscheidet', () => {
    expect(compareFanOutRequests(req('a', 10), req('b', 20))).toBeLessThan(0);
    expect(compareFanOutRequests(req('a', 20), req('b', 10))).toBeGreaterThan(0);
  });

  it('stabile Edge-ID als Tie-Breaker bei gleichem Quer-Versatz', () => {
    expect(compareFanOutRequests(req('a', 10), req('b', 10))).toBeLessThan(0);
    expect(compareFanOutRequests(req('b', 10), req('a', 10))).toBeGreaterThan(0);
  });
});

describe('portNormal / portCross', () => {
  it('Senkrechte ist rechtsdrehend zur Fahrtrichtung', () => {
    expect(portNormal({ x: 1, y: 0 })).toEqual({ x: 0, y: 1 });
    expect(portNormal({ x: -1, y: 0 })).toEqual({ x: 0, y: -1 });
    expect(portNormal({ x: 0, y: 1 })).toEqual({ x: -1, y: 0 });
    expect(portNormal({ x: 0, y: -1 })).toEqual({ x: 1, y: 0 });
  });

  it('Quer-Versatz projiziert das Gegenende auf die Port-Senkrechte', () => {
    const port: Point = { x: 100, y: 100 };
    // Port zeigt nach rechts ⇒ Querachse ist y.
    expect(portCross(port, { x: 999, y: 130 }, portNormal({ x: 1, y: 0 }))).toBe(30);
    // Port zeigt nach oben ⇒ Querachse ist x.
    expect(portCross(port, { x: 70, y: -999 }, portNormal({ x: 0, y: -1 }))).toBe(-30);
  });
});

describe('assignFanOut', () => {
  const requests = [req('e-3', 300), req('e-1', -50), req('e-2', 0), req('e-4', 120)];

  it('die achsparallelste Kante fährt geradeaus (Lane 0)', () => {
    const result = assignFanOut(requests);
    const byId = new Map(result.map((a) => [a.edgeId, a]));
    expect(byId.get('e-2')!.laneIndex).toBe(0);
    expect(byId.get('e-2')!.offset).toBe(0);
  });

  it('jede Seite zählt eigene Ränge — Beträge sind je Seite eindeutig', () => {
    const result = assignFanOut(requests);
    const byId = new Map(result.map((a) => [a.edgeId, a]));
    // cross < 0 ⇒ negative Seite, |cross| aufsteigend ⇒ innere Lane zuerst.
    expect(byId.get('e-1')!.offset).toBe(-grid);
    // cross > 0: e-4 (120) ist achsparalleler als e-3 (300).
    expect(byId.get('e-4')!.offset).toBe(grid);
    expect(byId.get('e-3')!.offset).toBe(2 * grid);
  });

  it('Einzelkante am Port bleibt auf Lane 0', () => {
    expect(assignFanOut([req('solo', 42)])).toEqual([{ edgeId: 'solo', order: 0, laneIndex: 0, offset: 0 }]);
  });

  it('deterministisch: permutierte Eingabe ⇒ identisches Ergebnis (ADR 0010)', () => {
    const a = JSON.stringify(assignFanOut(requests));
    const b = JSON.stringify(assignFanOut([...requests].reverse()));
    const c = JSON.stringify(assignFanOut([requests[1]!, requests[0]!, requests[3]!, requests[2]!]));
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('fanOutPortIndices liefert dieselbe Ordnung für ELK FIXED_ORDER', () => {
    const assignments = assignFanOut(requests);
    const indices = fanOutPortIndices(requests);
    for (const a of assignments) expect(indices.get(a.edgeId)).toBe(a.order);
  });
});

describe('Szenario „Busbar + Fan-Out": keine quellnahen Kreuzungen', () => {
  it('Stubs zu 4 Verbrauchern kreuzen sich am Port nicht', () => {
    // Busbar-Port oben bei (400, 200), Austritt nach oben; 4 Verbraucher in
    // gemischter Registrierungs-Reihenfolge auf verschiedenen Höhen/Seiten.
    const port: Point = { x: 400, y: 200 };
    const ds: Point = { x: 0, y: -1 };
    const normal = portNormal(ds);
    const targets: Record<string, Point> = {
      'e-d': { x: 700, y: 40 },
      'e-a': { x: 100, y: 40 },
      'e-c': { x: 560, y: 40 },
      'e-b': { x: 400, y: 40 },
    };
    const requests = Object.entries(targets).map(([edgeId, farEnd]) => ({
      edgeId,
      cross: portCross(port, farEnd, normal),
    }));
    const assignments = assignFanOut(requests);

    // Quellnaher Stub je Kante, exakt wie `portFrame` ihn baut: entlang der
    // Port-Achse um `stubMin + |lane|`, dann der Seitenschritt um `lane`,
    // dann senkrecht auf Zielhöhe.
    // Trasse je Kante = der Lauf senkrecht zur Port-Achse nach dem
    // Seitenschritt (dort entscheidet sich, ob zwei Kanten dieselbe Trasse
    // belegen — Invariante I2).
    const trunks: Segment[] = assignments.map((a) => {
      const stub = stubMin + Math.abs(a.offset);
      const s2: Point = { x: port.x + ds.x * stub, y: port.y + ds.y * stub };
      const s3: Point = { x: s2.x + normal.x * a.offset, y: s2.y + normal.y * a.offset };
      const target = targets[a.edgeId]!;
      return [s3, { x: s3.x, y: target.y }];
    });

    for (let i = 0; i < trunks.length; i++) {
      for (let j = i + 1; j < trunks.length; j++) {
        expect(segmentsCross(trunks[i]!, trunks[j]!)).toBe(false);
      }
    }

    // Die achsparallelste Kante (Ziel direkt über dem Port) fährt geradeaus.
    const straight = assignments.find((a) => a.edgeId === 'e-b')!;
    expect(straight.offset).toBe(0);
    // Alle Lanes sind paarweise verschieden — keine doppelte Trassenbelegung.
    const offsets = assignments.map((a) => a.offset);
    expect(new Set(offsets).size).toBe(offsets.length);
  });
});
