import { describe, it, expect } from 'vitest';
import { type Node } from 'reactflow';
import { getObstacleMap, obstaclesExcluding, crossingSegmentsExcluding } from './routingCache';

const makeNode = (id: string, x: number, y: number, width?: number, height?: number): Node =>
  ({ id, type: 'consumer', position: { x, y }, width, height, data: { label: id } }) as Node;

describe('routingCache', () => {
  it('baut die Rect-Map mit Fallback-Maßen auf, wenn width/height fehlen', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 100, 100, 300, 200)];
    const map = getObstacleMap(nodes);
    expect(map.size).toBe(2);
    expect(map.get('a')).toEqual({ x: 0, y: 0, width: 192, height: 120 });
    expect(map.get('b')).toEqual({ x: 100, y: 100, width: 300, height: 200 });
  });

  it('liefert für dieselbe Array-Referenz dieselbe (gecachte) Map', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 10, 10)];
    expect(getObstacleMap(nodes)).toBe(getObstacleMap(nodes));
  });

  it('liefert für eine neue Array-Referenz eine frische Map (Positionsänderung)', () => {
    const first = [makeNode('a', 0, 0), makeNode('b', 10, 10)];
    const second = [makeNode('a', 5, 5), makeNode('b', 10, 10)];
    const map1 = getObstacleMap(first);
    const map2 = getObstacleMap(second);
    expect(map1).not.toBe(map2);
    expect(map2.get('a')).toEqual({ x: 5, y: 5, width: 192, height: 120 });
  });

  it('obstaclesExcluding entfernt genau die ausgeschlossenen Knoten', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 100, 100), makeNode('c', 200, 200)];
    const rects = obstaclesExcluding(nodes, new Set(['b']));
    expect(rects).toHaveLength(2);
    expect(rects.map((r) => r.x).sort((x, y) => x - y)).toEqual([0, 200]);
  });

  it('obstaclesExcluding ohne Ausschluss liefert alle Knoten', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 100, 100)];
    expect(obstaclesExcluding(nodes, new Set())).toHaveLength(2);
  });

  describe('crossingSegmentsExcluding', () => {
    const nodes = [
      makeNode('a', 0, 0, 100, 100),
      makeNode('b', 300, 0, 100, 100),
      makeNode('c', 300, 300, 100, 100),
      makeNode('d', 0, 300, 100, 100),
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'c' },
      { id: 'e3', source: 'a', target: 'b' }, // Parallele Kante zu e1
      { id: 'e4', source: 'c', target: 'd' },
    ];

    it('schließt die aktuelle Kante und Kanten desselben Node-Paars aus', () => {
      const segs = crossingSegmentsExcluding(nodes, edges, { id: 'e1', source: 'a', target: 'b' });
      // e2 (a→c) und e4 (c→d) bleiben, e1 & e3 (a↔b) fallen weg.
      expect(segs).toHaveLength(2);
    });

    it('ignoriert die Richtung beim Pärchen-Ausschluss (b→a wie a→b)', () => {
      const segs = crossingSegmentsExcluding(nodes, edges, { id: 'e3', source: 'b', target: 'a' });
      expect(segs).toHaveLength(2);
    });

    it('überspringt Kanten mit unbekannten Endknoten (kein Zentrum)', () => {
      const ghostEdges = [
        { id: 'g1', source: 'a', target: 'b' },
        { id: 'g2', source: 'ghost', target: 'c' },
      ];
      const segs = crossingSegmentsExcluding(nodes, ghostEdges, { id: 'g1', source: 'a', target: 'b' });
      // g2 hat keinen a-Punkt und fliegt raus; g1 wird als aktuelle Kante ausgeschlossen.
      expect(segs).toHaveLength(0);
    });

    it('liefert für dieselbe Knoten-/Kanten-Referenz das gecachte Ergebnis (Referenzgleichheit)', () => {
      const r1 = crossingSegmentsExcluding(nodes, edges, { id: 'e1', source: 'a', target: 'b' });
      const r2 = crossingSegmentsExcluding(nodes, edges, { id: 'e1', source: 'a', target: 'b' });
      expect(r1).toHaveLength(2);
      expect(r2).toHaveLength(2);
      // Die Segmente der Basis sind Referenz-identisch (geteilter Cache).
      expect(r1[0]).toBe(r2[0]);
    });
  });
});
