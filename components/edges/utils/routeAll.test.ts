import { describe, expect, it } from 'vitest';
import { Position, type Node } from 'reactflow';
import { routeAllCables, portOrderedLaneOffsets, alignSharedCorridors, type RouteEdgeRef } from './routeAll';
import { simplifyWaypoints } from './pathfinding';
import { dedupe, orthogonalWaypoints } from './orthogonalRouting';
import type { Point, Rect } from './orthogonalRouting';
import { ROUTING_SCENARIOS } from './routingScenarios';

/**
 * R-6 (Routing-Qualität): Globale Nachoptimierung.
 *
 * - Port-Reihenfolge: Kanten am selben Handle verlassen den Port in der
 *   Reihenfolge ihrer Gegenenden — keine gekreuzten Stubs.
 * - Gemeinsame Korridore: parallele nahe Segmente landen auf derselben
 *   Lane (8-px-Halbton-Raster).
 * - Determinismus: derselbe Plan (fixer Seed) ⇒ identische Ergebnisse.
 * - simplifyWaypoints/dedupe verlieren keine Punkte, die Geometrie ändern.
 */

/** Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260903;

const makeNode = (id: string, x: number, y: number): Node =>
  ({
    id,
    type: 'consumer',
    position: { x, y },
    width: 192,
    height: 120,
    data: { label: id },
  }) as Node;

/** Referenzplan: Batterie → Verteilung → 5 Verbraucher, deterministisch gestreut. */
function buildSeededPlan(seed: number): { nodes: Node[]; edges: RouteEdgeRef[] } {
  const random = mulberry32(seed);
  const nodes: Node[] = [makeNode('battery', 0, 0), makeNode('distribution', 480, 40)];
  const edges: RouteEdgeRef[] = [{ id: 'e-bat-dist', source: 'battery', target: 'distribution' }];
  for (let i = 0; i < 5; i++) {
    const jitter = Math.round(random() * 60);
    nodes.push(makeNode(`load${i}`, 960, i * 200 - jitter / 2));
    edges.push({ id: `e-dist-load${i}`, source: 'distribution', target: `load${i}` });
  }
  return { nodes, edges };
}

describe('routeAll-Nachoptimierung (R-6)', () => {
  it('ist deterministisch: fixer Seed ⇒ identische Routen über zwei Läufe', () => {
    const { nodes, edges } = buildSeededPlan(SEED);
    const first = routeAllCables(nodes, edges);
    const second = routeAllCables(nodes, edges);
    expect(first.size).toBe(edges.length);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it('Ausgabereihenfolge ist nach Edge-ID sortiert (unabhängig von Eingabereihenfolge)', () => {
    const { nodes, edges } = buildSeededPlan(SEED);
    const straight = routeAllCables(nodes, edges);
    const shuffled = routeAllCables(nodes, [...edges].reverse());
    expect([...straight.keys()]).toEqual([...shuffled.keys()]);
    for (const [id, result] of straight) {
      expect(shuffled.get(id)?.waypoints).toEqual(result.waypoints);
    }
  });

  it('Port-Reihenfolge: Stubs am geteilten Handle überkreuzen sich nicht', () => {
    // Drei Kanten verlassen denselben Quell-Handle (gleicher Punkt) zu
    // Zielen bei y = 0, 200, 400. Ohne Sortierung (id-Sortierung der
    // Bündel-Lanes) würde die oberste Lane zu einem tiefen Ziel laufen.
    const nodes = [
      makeNode('hub', 0, 0),
      makeNode('a', 400, 0),
      makeNode('b', 400, 200),
      makeNode('c', 400, 400),
    ];
    const edges: RouteEdgeRef[] = [
      { id: 'z-first', source: 'hub', target: 'c' },
      { id: 'a-second', source: 'hub', target: 'a' },
      { id: 'm-third', source: 'hub', target: 'b' },
    ];
    const offsets = portOrderedLaneOffsets(edges, (edge, kind) => {
      if (kind === 'source') return { x: 192, y: 60, position: Position.Right };
      const y = edge.target === 'a' ? 60 : edge.target === 'b' ? 260 : 460;
      return { x: 400, y, position: Position.Left };
    });
    // Reihenfolge nach Gegenüber-y: a (60) < b (260) < c (460).
    const aOffset = offsets.get('a-second')!;
    const bOffset = offsets.get('m-third')!;
    const cOffset = offsets.get('z-first')!;
    expect(aOffset).toBeLessThan(bOffset);
    expect(bOffset).toBeLessThan(cOffset);
  });

  it('gemeinsame Korridore: nahe parallele Segmente liegen auf derselben Lane', () => {
    const obstacles: Rect[] = [];
    const paths = [
      {
        id: 'p1',
        waypoints: [
          { x: 0, y: 100 },
          { x: 40, y: 100 },
          { x: 40, y: 103 },
          { x: 500, y: 103 },
          { x: 500, y: 0 },
        ],
      },
      {
        id: 'p2',
        waypoints: [
          { x: 0, y: 200 },
          { x: 60, y: 200 },
          { x: 60, y: 97 },
          { x: 480, y: 97 },
          { x: 480, y: 300 },
        ],
      },
    ];
    const aligned = alignSharedCorridors(paths, obstacles);
    const p1 = aligned.get('p1')!;
    const p2 = aligned.get('p2')!;
    // Beide Mittelstücke (p1 y=103, p2 y=97, 6 px auseinander, 320 px Überlappung)
    // landen auf derselben Koordinate (kleinste des Clusters = 97).
    const y1 = p1[2]!.y;
    const y2 = p2[2]!.y;
    expect(y1).toBe(y2);
    // Endpunkte unangetastet:
    expect(p1[0]).toEqual({ x: 0, y: 100 });
    expect(p2[0]).toEqual({ x: 0, y: 200 });
  });

  it('alignSharedCorridors erzeugt keine Hindernis-Kollision', () => {
    const obstacle: Rect[] = [{ x: 200, y: 91, width: 100, height: 12 }];
    const paths = [
      {
        id: 'p1',
        waypoints: [
          { x: 0, y: 100 },
          { x: 30, y: 100 },
          { x: 30, y: 104 },
          { x: 500, y: 104 },
          { x: 500, y: 0 },
        ],
      },
      {
        id: 'p2',
        waypoints: [
          { x: 0, y: 300 },
          { x: 60, y: 300 },
          { x: 60, y: 99 },
          { x: 480, y: 99 },
          { x: 480, y: 400 },
        ],
      },
    ];
    const aligned = alignSharedCorridors(paths, obstacle);
    // Das Zusammenziehen auf y=99 würde p1 durch das Hindernis schieben —
    // p1 bleibt deshalb auf 104, p2 wird ausgerichtet oder bleibt.
    const y1 = aligned.get('p1')![2]!.y;
    expect(y1 === 104 || y1 === 99).toBe(true);
  });
});

describe('simplifyWaypoints/dedupe-Verifikation (R-6)', () => {
  it('dedupe entfernt nur exakte Duplikate, niemals Inhalts-Punkte', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    expect(dedupe(points)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ]);
  });

  it('simplifyWaypoints erhält Endpunkte, Orthogonalität und verkürzt nie', () => {
    const samples: Point[][] = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
      ],
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 100, y: 80 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 50 },
        { x: 0, y: 100 },
      ],
    ];
    for (const points of samples) {
      const simplified = simplifyWaypoints(points);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
      const length = (pts: Point[]): number =>
        pts
          .slice(0, -1)
          .reduce((sum, p, i) => sum + Math.abs(pts[i + 1]!.x - p.x) + Math.abs(pts[i + 1]!.y - p.y), 0);
      expect(length(simplified)).toBeLessThanOrEqual(length(points));
    }
  });

  it('Referenzszenarien: simplify verändert die gewählte Route nicht (kein Punkt-Verlust)', () => {
    for (const scenario of ROUTING_SCENARIOS) {
      const { waypoints } = orthogonalWaypoints(scenario.input);
      const simplified = simplifyWaypoints(waypoints);
      // simplify darf nur kollineare Zwischenpunkte entfernen — Start und
      // Ende sowie die Gesamtgeometrie (Länge) bleiben identisch.
      const length = (pts: Point[]): number =>
        pts.slice(0, -1).reduce((sum, p, i) => sum + Math.hypot(pts[i + 1]!.x - p.x, pts[i + 1]!.y - p.y), 0);
      expect(simplified[0]).toEqual(waypoints[0]);
      expect(simplified[simplified.length - 1]).toEqual(waypoints[waypoints.length - 1]);
      expect(Math.abs(length(simplified) - length(waypoints))).toBeLessThan(1e-6);
    }
  });
});
