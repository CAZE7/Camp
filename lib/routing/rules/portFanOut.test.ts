import { describe, expect, it } from 'vitest';
import { assignFanOut, compareFanOutRequests, fanOutPortIndices, type FanOutRequest } from './portFanOut';
import { segmentsCross, type Point, type Segment } from '../geometry';
import { ROUTING_TOKENS } from '../tokens';

/**
 * WP-9 (#398): Tests des Port Fan-Out.
 * Abnahme: deterministisch (gleicher Input → gleiche Reihenfolge), keine
 * quellnahen Kreuzungen im Busbar-Szenario, konsistent mit FIXED_ORDER,
 * nutzt die Geometrie-Primitives für die Zielsortierung.
 */

const grid = ROUTING_TOKENS.laneGrid;

const req = (edgeId: string, x: number, y: number): FanOutRequest => ({ edgeId, farEnd: { x, y } });

describe('Sortiervertrag', () => {
  it('horizontal: y des Gegenübers entscheidet; vertikal: x', () => {
    expect(compareFanOutRequests('horizontal', req('a', 0, 10), req('b', 999, 20))).toBeLessThan(0);
    expect(compareFanOutRequests('vertical', req('a', 10, 0), req('b', 20, -999))).toBeLessThan(0);
  });

  it('stabile Edge-ID als Tie-Breaker bei gleicher Zielposition', () => {
    expect(compareFanOutRequests('horizontal', req('a', 0, 10), req('b', 0, 10))).toBeLessThan(0);
    expect(compareFanOutRequests('horizontal', req('b', 0, 10), req('a', 0, 10))).toBeGreaterThan(0);
  });
});

describe('assignFanOut', () => {
  const requests = [req('e-3', 500, 300), req('e-1', 500, 50), req('e-2', 500, 180)];

  it('ordnet nach Zielposition, Versatz = symmetricLaneIndex × laneGrid', () => {
    const result = assignFanOut('horizontal', requests);
    expect(result.map((a) => a.edgeId)).toEqual(['e-1', 'e-2', 'e-3']);
    expect(result.map((a) => a.laneIndex)).toEqual([-1, 0, 1]);
    expect(result.map((a) => a.offset)).toEqual([-grid, 0, grid]);
  });

  it('deterministisch: permutierte Eingabe ⇒ identisches Ergebnis (ADR 0010)', () => {
    const a = JSON.stringify(assignFanOut('horizontal', requests));
    const b = JSON.stringify(assignFanOut('horizontal', [...requests].reverse()));
    const c = JSON.stringify(assignFanOut('horizontal', [requests[1]!, requests[0]!, requests[2]!]));
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('fanOutPortIndices liefert dieselbe Ordnung für ELK FIXED_ORDER (eine Quelle)', () => {
    const assignments = assignFanOut('horizontal', requests);
    const indices = fanOutPortIndices('horizontal', requests);
    for (const a of assignments) expect(indices.get(a.edgeId)).toBe(a.order);
  });
});

describe('Szenario „Busbar + Fan-Out": keine quellnahen Kreuzungen', () => {
  it('Stubs zu 4 Verbrauchern kreuzen sich am Port nicht', () => {
    // Busbar-Port rechts bei (400, 200); 4 Verbraucher in gemischter
    // Registrierungs-Reihenfolge auf verschiedenen Höhen.
    const port: Point = { x: 400, y: 200 };
    const targets: Record<string, Point> = {
      'e-d': { x: 700, y: 380 },
      'e-a': { x: 700, y: 40 },
      'e-c': { x: 700, y: 260 },
      'e-b': { x: 700, y: 150 },
    };
    const requests = Object.entries(targets).map(([edgeId, farEnd]) => ({ edgeId, farEnd }));
    const assignments = assignFanOut('horizontal', requests);

    // Quellnaher Stub je Kante: Port (+Lane-Versatz) → horizontaler Auslauf →
    // vertikal auf Zielhöhe (L-Stub). Verschachtelter Fan-Out: die äußerste
    // Lane knickt zuerst ab, innere Lanes laufen weiter, bevor sie abbiegen.
    const maxAbsLane = Math.max(...assignments.map((a) => Math.abs(a.laneIndex)));
    const stubs: Segment[][] = assignments.map((a) => {
      const start: Point = { x: port.x, y: port.y + a.offset };
      const elbowX = port.x + 2 * ROUTING_TOKENS.stubMin + (maxAbsLane - Math.abs(a.laneIndex)) * grid;
      const target = targets[a.edgeId]!;
      return [
        [start, { x: elbowX, y: start.y }],
        [
          { x: elbowX, y: start.y },
          { x: elbowX, y: target.y },
        ],
      ];
    });

    for (let i = 0; i < stubs.length; i++) {
      for (let j = i + 1; j < stubs.length; j++) {
        for (const s1 of stubs[i]!) {
          for (const s2 of stubs[j]!) {
            expect(segmentsCross(s1, s2)).toBe(false);
          }
        }
      }
    }

    // Reihenfolge am Port entspricht der Zielhöhe (kein Vertauschen).
    expect(assignments.map((a) => a.edgeId)).toEqual(['e-a', 'e-b', 'e-c', 'e-d']);
  });
});
