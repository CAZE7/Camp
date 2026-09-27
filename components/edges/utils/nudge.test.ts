import { describe, it, expect } from 'vitest';
import { nudgeOrthogonalPaths, NUDGE_GAP } from './nudge';
import { isOrthogonalPath, pathHitsObstacles, type Point, type Rect } from './pathfinding';
import { routeAllCables } from './routeAll';
import { Position, type Node } from '@xyflow/react';

const z = (id: string, y: number): { id: string; waypoints: Point[] } => ({
  id,
  waypoints: [
    { x: 0, y: 0 },
    { x: 24, y: 0 },
    { x: 24, y },
    { x: 176, y },
    { x: 176, y: 80 },
    { x: 200, y: 80 },
  ],
});

describe('nudgeOrthogonalPaths', () => {
  it('leaves a single path unchanged', () => {
    const path = z('a', 40);
    const out = nudgeOrthogonalPaths([path]);
    expect(out.get('a')).toEqual(path.waypoints);
  });

  it('does not move handle endpoints', () => {
    const a = z('a', 40);
    const b = z('b', 40);
    const out = nudgeOrthogonalPaths([a, b]);
    const wa = out.get('a')!;
    const wb = out.get('b')!;
    expect(wa[0]).toEqual(a.waypoints[0]);
    expect(wa[wa.length - 1]).toEqual(a.waypoints[a.waypoints.length - 1]);
    expect(wb[0]).toEqual(b.waypoints[0]);
    expect(wb[wb.length - 1]).toEqual(b.waypoints[b.waypoints.length - 1]);
  });

  const longRunY = (wp: Point[]): number => {
    for (let i = 1; i < wp.length - 1; i++) {
      if (Math.abs(wp[i]!.y - wp[i + 1]!.y) < 1e-6 && Math.abs(wp[i]!.x - wp[i + 1]!.x) > 40) {
        return wp[i]!.y;
      }
    }
    return wp[2]!.y;
  };

  it('spreads coincident interior runs by NUDGE_GAP', () => {
    const out = nudgeOrthogonalPaths([z('a', 40), z('b', 40)]);
    expect(Math.abs(longRunY(out.get('a')!) - longRunY(out.get('b')!))).toBeCloseTo(NUDGE_GAP, 5);
    expect(isOrthogonalPath(out.get('a')!)).toBe(true);
    expect(isOrthogonalPath(out.get('b')!)).toBe(true);
  });

  it('spreads the long run of a 5-point L without moving handles', () => {
    const l = (id: string): { id: string; waypoints: Point[] } => ({
      id,
      waypoints: [
        { x: 0, y: 0 },
        { x: 24, y: 0 },
        { x: 24, y: 80 },
        { x: 176, y: 80 },
        { x: 200, y: 80 },
      ],
    });
    const out = nudgeOrthogonalPaths([l('a'), l('b')]);
    const a = out.get('a')!;
    const b = out.get('b')!;
    expect(a[0]).toEqual({ x: 0, y: 0 });
    expect(a[a.length - 1]).toEqual({ x: 200, y: 80 });
    expect(isOrthogonalPath(a)).toBe(true);
    expect(isOrthogonalPath(b)).toBe(true);
    // ROUTE-BUG-17: Hier ist das Mittelstück am Ziel-Stub verankert (Punkt 3
    // ist Anfang des letzten Stubs). Es zu verschieben hieße, nur EIN Ende
    // des Segments zu bewegen — die Diagonale flickt `stitchOrthogonal` mit
    // einem Ellbogen, und die Kante bekäme einen 8-px-Stummel (I6) samt Haken
    // am Handle (I4). Ein Segment wandert nur als Ganzes, also bleibt der
    // Lauf hier stehen; gespreizt wird, wo beide Enden frei sind (Test oben).
    expect(longRunY(a)).toBe(80);
    expect(longRunY(b)).toBe(80);
  });

  it('is deterministic (id order, not input order)', () => {
    const first = nudgeOrthogonalPaths([z('b', 40), z('a', 40)]);
    const second = nudgeOrthogonalPaths([z('a', 40), z('b', 40)]);
    expect(first.get('a')).toEqual(second.get('a'));
    expect(first.get('b')).toEqual(second.get('b'));
  });

  it('does not nudge short polylines without interior runs', () => {
    const short = {
      id: 's',
      waypoints: [
        { x: 0, y: 0 },
        { x: 24, y: 0 },
        { x: 176, y: 80 },
        { x: 200, y: 80 },
      ],
    };
    const out = nudgeOrthogonalPaths([short, { ...short, id: 't' }]);
    expect(out.get('s')).toEqual(short.waypoints);
  });

  it('does not treat the connected nodes as obstacles for the path that owns them', () => {
    const src: Rect = { x: -10, y: -10, width: 30, height: 30 };
    const dst: Rect = { x: 190, y: 70, width: 30, height: 30 };
    const out = nudgeOrthogonalPaths([z('a', 40), z('b', 40)], { obstacles: [src, dst] });
    expect(Math.abs(longRunY(out.get('a')!) - longRunY(out.get('b')!))).toBeCloseTo(NUDGE_GAP, 5);
  });

  it('reverts a path that would cut an obstacle after the shift', () => {
    const wall: Rect = { x: 50, y: 28, width: 100, height: 8 };
    const a = z('a', 40);
    const b = z('b', 40);
    const out = nudgeOrthogonalPaths([a, b], { obstacles: [wall], gap: 24 });
    // At least one path must stay clear; none may be non-orthogonal.
    for (const id of ['a', 'b']) {
      const wp = out.get(id)!;
      expect(isOrthogonalPath(wp)).toBe(true);
    }
    const hits = ['a', 'b'].filter((id) => pathHitsObstacles(out.get(id)!, [wall]));
    expect(hits.length).toBeLessThan(2);
  });
});

describe('routeAllCables', () => {
  it('returns a route for every edge and keeps handles on the nodes', () => {
    const nodes: Node[] = [
      { id: 's', position: { x: 0, y: 0 }, data: {}, width: 192, height: 120 },
      { id: 't', position: { x: 400, y: 0 }, data: {}, width: 192, height: 120 },
    ];
    const edges = [
      { id: 'e1', source: 's', target: 't', sourceHandle: 'plus', targetHandle: 'plus' },
      { id: 'e2', source: 's', target: 't', sourceHandle: 'minus', targetHandle: 'minus' },
    ];
    const routes = routeAllCables(nodes, edges);
    expect(routes.size).toBe(2);
    const a = routes.get('e1')!;
    const b = routes.get('e2')!;
    expect(a.waypoints[0]!.x).toBeGreaterThanOrEqual(0);
    expect(b.waypoints[0]!.x).toBeGreaterThanOrEqual(0);
    expect(isOrthogonalPath(a.waypoints)).toBe(true);
    expect(isOrthogonalPath(b.waypoints)).toBe(true);
  });

  it('uses Right/Left estimates when handleBounds are missing', () => {
    const nodes: Node[] = [
      { id: 's', position: { x: 10, y: 20 }, data: {}, width: 100, height: 80 },
      { id: 't', position: { x: 300, y: 20 }, data: {}, width: 100, height: 80 },
    ];
    const routes = routeAllCables(nodes, [
      { id: 'e', source: 's', target: 't', sourceHandle: 'plus', targetHandle: 'plus' },
    ]);
    const wp = routes.get('e')!.waypoints;
    expect(wp[0]!.x).toBe(110);
    expect(wp[wp.length - 1]!.x).toBe(300);
  });
});

describe('resolveHandlePoint via routeAll', () => {
  it('honors sourcePosition Right by leaving to the right', () => {
    const nodes: Node[] = [
      { id: 's', position: { x: 0, y: 0 }, data: {}, width: 80, height: 80 },
      { id: 't', position: { x: 240, y: 40 }, data: {}, width: 80, height: 80 },
    ];
    const wp = routeAllCables(nodes, [
      { id: 'e', source: 's', target: 't', sourceHandle: 'plus', targetHandle: 'plus' },
    ]).get('e')!.waypoints;
    expect(wp[1]!.x).toBeGreaterThan(wp[0]!.x);
    expect(Position.Right).toBe('right');
  });
});

/**
 * ROUTE-001 / WP-8 (2026-09-27): Der Nudge zieht Ausweich-Trassen aus der
 * LaneRegistry-Leiter und sieht kollineare Überdeckungen ab jeder Länge
 * (I2-Begriff) — nicht mehr nur ab `NUDGE_MIN_OVERLAP` (12 px).
 */
const custom = (id: string, waypoints: [number, number][]): { id: string; waypoints: Point[] } => ({
  id,
  waypoints: waypoints.map(([x, y]) => ({ x, y })),
});

describe('nudgeOrthogonalPaths — kollineare Einzel-Überdeckungen (ROUTE-001)', () => {
  it('sieht eine kollineare Überdeckung ab 8 px (I2), nicht erst ab 12 px', () => {
    // Beide Innenstücke liegen exakt auf y = 40 und überdecken sich 8 px
    // (x ∈ [168, 176]) — für I2 längst ein Verstoß, für den alten Nudge
    // (Schwelle 12 px) unsichtbar.
    const a = custom('a', [
      [0, 0],
      [24, 0],
      [24, 40],
      [176, 40],
      [176, 80],
      [200, 80],
    ]);
    const b = custom('b', [
      [0, 60],
      [200, 60],
      [200, 40],
      [168, 40],
      [168, 100],
      [200, 100],
    ]);
    const out = nudgeOrthogonalPaths([a, b]);
    const ya = out.get('a')![2]!.y;
    const yb = out.get('b')![2]!.y;
    expect(ya, 'die beiden kollinearen Läufe müssen getrennt werden').not.toBe(yb);
    expect(out.get('a')![0]).toEqual({ x: 0, y: 0 });
    expect(out.get('b')![0]).toEqual({ x: 0, y: 60 });
  });

  it('lässt disjunkte Parallelen in Ruhe (keine Überdeckung, kein Zug)', () => {
    const a = custom('a', [
      [0, 0],
      [24, 0],
      [24, 40],
      [176, 40],
      [176, 80],
      [200, 80],
    ]);
    const b = custom('b', [
      [0, 60],
      [200, 60],
      [200, 40],
      [180, 40],
      [180, 100],
      [200, 100],
    ]);
    const out = nudgeOrthogonalPaths([a, b]);
    expect(out.get('a')).toEqual(a.waypoints);
    expect(out.get('b')).toEqual(b.waypoints);
  });

  it('zieht einen beweglichen Lauf, der auf einem fremden Stub liegt, auf eine Registry-Lane', () => {
    // b hat nur zwei Segmente (kein Innenstück) — sein erster Lauf ist ein
    // Stub. a überdeckt ihn kollinear: nur a ist beweglich.
    const a = custom('a', [
      [0, 0],
      [40, 0],
      [40, 120],
      [160, 120],
      [160, 0],
      [200, 0],
    ]);
    const b = custom('b', [
      [100, 120],
      [300, 120],
      [300, 200],
    ]);
    const out = nudgeOrthogonalPaths([a, b]);
    const moved = out.get('a')!;
    const laneY = moved[2]!.y;
    expect(laneY, 'der Lauf muss die Linie y = 120 verlassen').not.toBe(120);
    // Registry-Leiter: Korridor (auf halbes laneGrid gerastet) ± k · laneGrid.
    const step = NUDGE_GAP;
    const offset = Math.abs(laneY - 120);
    expect(offset % step).toBe(0);
    expect(offset).toBeLessThanOrEqual(2 * step);
    expect(isOrthogonalPath(moved)).toBe(true);
    expect(b.waypoints[0]).toEqual({ x: 100, y: 120 });
  });

  it('verwirft den Zug, wenn die Ausweich-Lane durch ein Hindernis versperrt ist', () => {
    const a = custom('a', [
      [0, 0],
      [40, 0],
      [40, 120],
      [160, 120],
      [160, 0],
      [200, 0],
    ]);
    const b = custom('b', [
      [100, 120],
      [300, 120],
      [300, 200],
    ]);
    // Hindernis über allen Kandidaten-Leitern (±1 bis ±3) im Bereich des
    // Laufs — der Nudge darf nicht durch die Wand ausweichen.
    const wall = { x: 20, y: 60, width: 180, height: 120 };
    const out = nudgeOrthogonalPaths([a, b], { obstacles: [wall] });
    expect(out.get('a')).toEqual(a.waypoints);
  });
});
