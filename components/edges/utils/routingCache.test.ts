import { describe, it, expect } from 'vitest';
import { type Node } from 'reactflow';
import {
  getObstacleMap,
  obstaclesExcluding,
  crossingSegmentsExcluding,
  crossingSegmentsNear,
} from './routingCache';

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

// ---------------------------------------------------------------------------
// R-4: Kreuzungs-Scan bleibt in großen Plänen aktiv (Spatial-Index)
// ---------------------------------------------------------------------------

describe('crossingSegmentsNear (R-4)', () => {
  /** 150 Knoten in einem Raster + 150 Kettenkanten — der alte Plan stieg bei 120 aus. */
  const buildBigPlan = () => {
    const nodes: Node[] = [];
    const edges: { id: string; source: string; target: string }[] = [];
    for (let i = 0; i < 150; i++) {
      nodes.push(makeNode(`n${i}`, (i % 15) * 240, Math.floor(i / 15) * 200));
      if (i > 0 && i % 15 !== 0) {
        edges.push({ id: `e${i}`, source: `n${i - 1}`, target: `n${i}` });
      }
    }
    return { nodes, edges };
  };

  it('liefert bei 150 Kanten noch Nachbarschafts-Segmente (früher: Abbruch bei 120)', () => {
    const { nodes, edges } = buildBigPlan();
    expect(edges.length).toBeGreaterThan(120);
    const region = { x: 0, y: 0, width: 1000, height: 1000 };
    const segs = crossingSegmentsNear(nodes, edges, { id: 'e10', source: 'n9', target: 'n10' }, region);
    expect(segs.length).toBeGreaterThan(0);
  });

  it('stimmt mit dem Brute-Force-Ergebnis überein (gleicher Ausschluss, Region-Filter)', () => {
    const { nodes, edges } = buildBigPlan();
    const current = { id: 'e10', source: 'n9', target: 'n10' };
    const region = { x: 1000, y: 0, width: 900, height: 800 };
    const viaIndex = crossingSegmentsNear(nodes, edges, current, region);
    const bruteForce = crossingSegmentsExcluding(nodes, edges, current).filter((seg) => {
      const minX = Math.min(seg[0].x, seg[1].x);
      const maxX = Math.max(seg[0].x, seg[1].x);
      const minY = Math.min(seg[0].y, seg[1].y);
      const maxY = Math.max(seg[0].y, seg[1].y);
      return (
        maxX >= region.x &&
        minX <= region.x + region.width &&
        maxY >= region.y &&
        minY <= region.y + region.height
      );
    });
    // Der Index ist ein grober Vorfilter auf Zellbasis: er darf leicht mehr
    // liefern (Zellnachbarn), aber keinen Treffer der Brute-Force-Region
    // verlieren.
    const key = (seg: [unknown, unknown]): string => JSON.stringify(seg);
    const indexKeys = new Set(viaIndex.map(key));
    for (const seg of bruteForce) {
      expect(indexKeys.has(key(seg)), `fehlend: ${key(seg)}`).toBe(true);
    }
  });

  it('Kanten desselben Node-Paars bleiben ausgeschlossen', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 200, 0), makeNode('c', 400, 0)];
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
      { id: 'e3', source: 'b', target: 'c' },
    ];
    const region = { x: -100, y: -100, width: 800, height: 400 };
    const segs = crossingSegmentsNear(nodes, edges, { id: 'e1', source: 'a', target: 'b' }, region);
    expect(segs).toHaveLength(1); // nur b→c; b→a (gleiches Paar) ist ausgenommen
  });
});
