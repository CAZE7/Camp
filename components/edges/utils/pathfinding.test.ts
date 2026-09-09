import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Position, type Node } from '@xyflow/react';
import {
  findCablePath,
  catalogWaypoints,
  catalogCandidates,
  simplifyWaypoints,
  isOrthogonalPath,
  pathHitsObstacles,
  portFrame,
  pathLength,
  countBends,
  manhattan,
  segmentHitsRect,
  inflateRect,
  containsPoint,
  countCrossings,
  nodesToObstacles,
  clearPathfindingCache,
  pathfindingFallbackCount,
  resetPathfindingTelemetry,
  remainingCostLowerBound,
  BEND_COST,
  OBSTACLE_MARGIN,
  type Point,
  type Rect,
} from './pathfinding';
import { waypointsToPath, parallelLaneOffset, polarityPathOffset, edgeLabelNudge } from './pathUtils';
import { ROUTING_SCENARIOS } from './routingScenarios';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';

beforeEach(() => {
  clearPathfindingCache();
});

const rightLeft = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const route = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  obstacles: Rect[] = [],
  extra: Partial<Parameters<typeof findCablePath>[0]> = {}
) =>
  findCablePath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    ...rightLeft,
    obstacles,
    skipCache: true,
    ...extra,
  });

describe('geometry primitives', () => {
  it('manhattan is L1', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });

  it('inflateRect grows equally on all sides', () => {
    expect(inflateRect({ x: 10, y: 20, width: 30, height: 40 }, 5)).toEqual({
      x: 5,
      y: 15,
      width: 40,
      height: 50,
    });
  });

  it('containsPoint is strict (boundary is outside)', () => {
    const r: Rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(containsPoint(r, { x: 5, y: 5 })).toBe(true);
    expect(containsPoint(r, { x: 0, y: 5 })).toBe(false);
    expect(containsPoint(r, { x: 10, y: 5 })).toBe(false);
  });

  it('segmentHitsRect detects proper crossings only', () => {
    const r: Rect = { x: 10, y: 10, width: 20, height: 20 };
    expect(segmentHitsRect({ x: 0, y: 20 }, { x: 40, y: 20 }, r)).toBe(true);
    expect(segmentHitsRect({ x: 0, y: 5 }, { x: 40, y: 5 }, r)).toBe(false);
    expect(segmentHitsRect({ x: 10, y: 0 }, { x: 10, y: 40 }, r)).toBe(false); // on boundary
    expect(segmentHitsRect({ x: 20, y: 0 }, { x: 20, y: 40 }, r)).toBe(true);
  });

  it('simplifyWaypoints drops collinear joints', () => {
    const simplified = simplifyWaypoints([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 5 },
    ]);
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 5 },
    ]);
  });

  it('simplifyWaypoints keeps a collinear reversal (U-stub)', () => {
    const simplified = simplifyWaypoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 20, y: 0 },
    ]);
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 20, y: 0 },
    ]);
  });
});

describe('catalog (obstacle-free)', () => {
  it('routes a horizontal facing pair as orthogonal path from start to end', () => {
    const pts = catalogWaypoints({
      sourceX: 0,
      sourceY: 0,
      targetX: 200,
      targetY: 0,
      ...rightLeft,
    });
    expect(isOrthogonalPath(pts)).toBe(true);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 200, y: 0 });
  });

  it('prefers an L over a Z when handles face each other', () => {
    const pts = catalogWaypoints({
      sourceX: 0,
      sourceY: 0,
      targetX: 200,
      targetY: 80,
      ...rightLeft,
    });
    // Port-Stubs erzwingen zwei Ecken; ein Z hätte drei.
    expect(countBends(pts)).toBe(2);
    expect(pts.some((p) => Math.abs(p.x - 24) < 1e-6 && Math.abs(p.y - 80) < 1e-6)).toBe(true);
    expect(pathLength(pts)).toBeGreaterThanOrEqual(manhattan({ x: 0, y: 0 }, { x: 200, y: 80 }));
  });

  it('offers both L-shapes as catalog candidates', () => {
    const candidates = catalogCandidates({
      sourceX: 0,
      sourceY: 0,
      targetX: 200,
      targetY: 80,
      ...rightLeft,
    });
    const elbows = candidates.map((pts) => pts.map((p) => `${p.x},${p.y}`).join('>'));
    expect(elbows.some((s) => s.includes('176,0') || s.includes('200,0'))).toBe(true);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('uses an L when handles are perpendicular', () => {
    const pts = catalogWaypoints({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 80,
      targetPosition: Position.Top,
    });
    expect(isOrthogonalPath(pts)).toBe(true);
    expect(countBends(pts)).toBeGreaterThanOrEqual(1);
  });

  it('loops when both handles face the same way (U-shape)', () => {
    const pts = catalogWaypoints({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 80,
      targetY: 60,
      targetPosition: Position.Right,
    });
    expect(isOrthogonalPath(pts)).toBe(true);
    expect(pts.some((p) => p.x > 80)).toBe(true);
  });
});

describe('findCablePath — invariants', () => {
  it('is orthogonal, starts and ends on the handles', () => {
    const result = route(0, 0, 240, 120);
    expect(isOrthogonalPath(result.waypoints)).toBe(true);
    expect(result.waypoints[0]).toEqual({ x: 0, y: 0 });
    expect(result.waypoints[result.waypoints.length - 1]).toEqual({ x: 240, y: 120 });
    expect(result.path.startsWith('M ')).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(manhattan({ x: 0, y: 0 }, { x: 240, y: 120 }));
  });

  it('uses the catalog when nothing is in the way', () => {
    const result = route(0, 50, 300, 50);
    expect(result.usedSearch).toBe('catalog');
    expect(pathHitsObstacles(result.waypoints, [])).toBe(false);
  });

  it('takes the free L when the other L is blocked', () => {
    // Blockt die waagerechte Trasse auf y=0, die senkrechte bei x=24 bleibt frei.
    const wall: Rect = { x: 80, y: -20, width: 24, height: 40 };
    const result = route(0, 0, 220, 100, [wall]);
    expect(result.usedSearch).toBe('catalog');
    const inflated = [inflateRect(wall, OBSTACLE_MARGIN)];
    expect(pathHitsObstacles(result.waypoints, inflated)).toBe(false);
    expect(countBends(result.waypoints)).toBeLessThanOrEqual(2);
  });

  it('still goes around a tall wall when many far-away obstacles would clip a naive window', () => {
    const wall: Rect = { x: 90, y: -220, width: 24, height: 440 };
    const dummies: Rect[] = [];
    for (let i = 0; i < 80; i++) {
      dummies.push({ x: 800 + i * 12, y: 800 + i * 12, width: 4, height: 4 });
    }
    const result = route(0, 0, 240, 0, [wall, ...dummies]);
    const inflated = [inflateRect(wall, OBSTACLE_MARGIN)];
    expect(pathHitsObstacles(result.waypoints, inflated)).toBe(false);
    expect(result.waypoints.some((p) => p.y < -220 || p.y > 220)).toBe(true);
    // CI läuft mit Coverage + Node 24 deutlich langsamer als lokal; der Test
    // ist bewusst ein Worst-Case mit 80 irrelevanten Dummy-Obstacles und
    // liegt lokal bereits bei ~5.5 s. 90 s verhindern Flakes, ohne die
    // Invariante zu lockern.
  }, 90_000);

  it('goes around a blocking rectangle instead of through it', () => {
    const wall: Rect = { x: 80, y: 0, width: 40, height: 120 };
    const result = route(0, 40, 220, 40, [wall]);
    expect(isOrthogonalPath(result.waypoints)).toBe(true);
    const inflated = [inflateRect(wall, OBSTACLE_MARGIN)];
    expect(pathHitsObstacles(result.waypoints, inflated)).toBe(false);
    expect(result.waypoints.some((p) => p.y < 0 || p.y > 120)).toBe(true);
  });

  it('ignores the obstacle that contains the start (connected node)', () => {
    const self: Rect = { x: -20, y: -20, width: 40, height: 40 };
    const result = route(0, 0, 200, 0, [self]);
    expect(result.waypoints[0]).toEqual({ x: 0, y: 0 });
    expect(result.usedSearch).toBe('catalog');
  });

  it('is deterministic', () => {
    const wall: Rect = { x: 60, y: 10, width: 30, height: 80 };
    const a = route(0, 40, 180, 50, [wall]);
    const b = route(0, 40, 180, 50, [wall]);
    expect(a.waypoints).toEqual(b.waypoints);
    expect(a.path).toBe(b.path);
  });

  it('leaves to the right from a Right handle (first non-trivial step)', () => {
    const result = route(10, 10, 200, 80);
    const pts = result.waypoints;
    expect(pts[1]!.x).toBeGreaterThan(pts[0]!.x);
    expect(pts[1]!.y).toBe(pts[0]!.y);
  });

  it('arrives from the left into a Left handle', () => {
    const result = route(10, 10, 200, 80);
    const pts = result.waypoints;
    const n = pts.length;
    expect(pts[n - 2]!.x).toBeLessThan(pts[n - 1]!.x);
    expect(pts[n - 2]!.y).toBe(pts[n - 1]!.y);
  });

  it('routes a maze of three walls without collisions', () => {
    const walls: Rect[] = [
      { x: 70, y: -40, width: 24, height: 120 },
      { x: 140, y: 20, width: 24, height: 140 },
      { x: 210, y: -40, width: 24, height: 120 },
    ];
    const result = route(0, 40, 300, 40, walls);
    expect(isOrthogonalPath(result.waypoints)).toBe(true);
    const inflated = walls.map((w) => inflateRect(w, OBSTACLE_MARGIN));
    expect(pathHitsObstacles(result.waypoints, inflated)).toBe(false);
    expect(result.length).toBeGreaterThan(manhattan({ x: 0, y: 40 }, { x: 300, y: 40 }));
  });

  it('same point collapses to a degenerate but valid path', () => {
    const result = route(40, 40, 40, 40);
    expect(result.waypoints[0]).toEqual({ x: 40, y: 40 });
    expect(result.waypoints[result.waypoints.length - 1]).toEqual({ x: 40, y: 40 });
  });

  it('plus/minus offsets produce distinct corridors', () => {
    const plus = route(0, 0, 200, 80, [], { lane: 24 });
    const minus = route(0, 0, 200, 80, [], { lane: 38 });
    expect(plus.waypoints).not.toEqual(minus.waypoints);
  });

  it('picks a less-crossing alternative when the default is congested', () => {
    const traffic: [Point, Point][] = [
      [
        { x: 80, y: -40 },
        { x: 80, y: 160 },
      ],
      [
        { x: 100, y: -40 },
        { x: 100, y: 160 },
      ],
      [
        { x: 120, y: -40 },
        { x: 120, y: 160 },
      ],
    ];
    const result = route(0, 40, 220, 40, [], { crossingSegments: traffic });
    expect(result.crossings).toBeLessThanOrEqual(3);
    expect(isOrthogonalPath(result.waypoints)).toBe(true);
  });

  it('length never beats manhattan (orthogonal lower bound)', () => {
    const scenes: Array<[number, number, number, number, Rect[]]> = [
      [0, 0, 100, 0, []],
      [0, 0, 100, 50, []],
      [0, 40, 240, 40, [{ x: 90, y: 0, width: 30, height: 90 }]],
      [0, 0, 180, 180, [{ x: 40, y: 40, width: 80, height: 80 }]],
    ];
    for (const [sx, sy, tx, ty, obs] of scenes) {
      const result = route(sx, sy, tx, ty, obs);
      expect(result.length + 1e-6).toBeGreaterThanOrEqual(manhattan({ x: sx, y: sy }, { x: tx, y: ty }));
    }
  });
});

describe('optimality vs naive catalog', () => {
  it('A* is not longer than a colliding catalog that punched through', () => {
    const wall: Rect = { x: 90, y: -10, width: 20, height: 80 };
    const result = route(0, 30, 220, 30, [wall]);
    const naive = catalogWaypoints({
      sourceX: 0,
      sourceY: 30,
      targetX: 220,
      targetY: 30,
      ...rightLeft,
    });
    // Naive catalog typically runs through the wall; routed path may be longer, but must be clear.
    const inflated = [inflateRect(wall, OBSTACLE_MARGIN)];
    expect(pathHitsObstacles(result.waypoints, inflated)).toBe(false);
    if (!pathHitsObstacles(naive, inflated)) {
      expect(result.length).toBeLessThanOrEqual(pathLength(naive) + BEND_COST);
    }
  });

  it('with no obstacles, search cost equals catalog cost', () => {
    const result = route(0, 10, 180, 70);
    const catalog = catalogWaypoints({
      sourceX: 0,
      sourceY: 10,
      targetX: 180,
      targetY: 70,
      ...rightLeft,
    });
    expect(result.usedSearch).toBe('catalog');
    expect(result.length).toBe(pathLength(simplifyWaypoints(catalog)));
  });
});

describe('seeded random scenes', () => {
  const mulberry32 = (seed: number) => () => {
    let a = (seed += 0x6d2b79f5);
    a = Math.imul(a ^ (a >>> 15), a | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };

  it('stays orthogonal and collision-free across 40 random boards', () => {
    const rnd = mulberry32(20260827);
    for (let n = 0; n < 40; n++) {
      const sx = Math.round(rnd() * 40);
      const sy = Math.round(rnd() * 200);
      const tx = 260 + Math.round(rnd() * 40);
      const ty = Math.round(rnd() * 200);
      const obstacles: Rect[] = [];
      for (let k = 0; k < 6; k++) {
        obstacles.push({
          x: 60 + rnd() * 140,
          y: rnd() * 180,
          width: 18 + rnd() * 24,
          height: 18 + rnd() * 40,
        });
      }
      const result = route(sx, sy, tx, ty, obstacles);
      expect(isOrthogonalPath(result.waypoints)).toBe(true);
      expect(result.waypoints[0]).toEqual({ x: sx, y: sy });
      expect(result.waypoints[result.waypoints.length - 1]).toEqual({ x: tx, y: ty });

      // R-7: Stub-Invarianten — der Pfad verlässt den Handle in
      // Austrittsrichtung und biegt frühestens nach ≥ ROUTE_MIN_STUB (24 px)
      // ab (kein Richtungswechsel im Stub-Bereich, kein U-Turn am Handle).
      expect(result.waypoints[1]!.y).toBe(sy);
      expect(result.waypoints[1]!.x - sx).toBeGreaterThanOrEqual(24);
      const preLast = result.waypoints[result.waypoints.length - 2]!;
      expect(preLast.y).toBe(ty);
      expect(tx - preLast.x).toBeGreaterThanOrEqual(24);

      const s2 = { x: sx + 24, y: sy };
      const t2 = { x: tx - 24, y: ty };
      const inflated = obstacles
        .filter((r) => !containsPoint(r, { x: sx, y: sy }) && !containsPoint(r, { x: tx, y: ty }))
        .map((r) => inflateRect(r, OBSTACLE_MARGIN))
        // R-7: Bauteile, deren AUFGEBLÄHTE Box den Stub-Endpunkt überdeckt,
        // gelten als „am Anschluss anliegend“ — der Router sucht dort mit
        // 2 px Restfreigabe statt den 24-px-Stub zu kürzen (siehe
        // `searchOnce` in pathfinding.ts). Sie bleiben ungetestet; alle
        // anderen Boxen müssen mit vollem 14-px-Abstand vermieden werden.
        .filter((r) => !containsPoint(r, s2) && !containsPoint(r, t2));
      expect(pathHitsObstacles(result.waypoints, inflated)).toBe(false);
    }
  });
});

describe('nodesToObstacles / cache / svg', () => {
  it('R-10: Handle-Bounds erweitern die Hindernis-Box (überstehende Anschlüsse)', () => {
    const node = {
      id: 'a',
      position: { x: 100, y: 100 },
      width: 192,
      height: 120,
      data: {},
      // Handle ragt 6 px links über und 4 px unter die Node-Box.
      handleBounds: {
        source: [{ id: 'plus', x: -6, y: 50, width: 8, height: 8, position: Position.Left }],
        target: [{ id: 'in', x: 190, y: 118, width: 8, height: 8, position: Position.Bottom }],
      },
    } as unknown as Node;
    const rects = nodesToObstacles([node], new Set());
    expect(rects).toHaveLength(1);
    expect(rects[0]!.x).toBe(94); // 100 − 6
    expect(rects[0]!.y).toBe(100);
    expect(rects[0]!.width).toBe(198); // bis 190 + 8 = 198? → 292+6 … tatsächlich max(292, 198+?)…
    expect(rects[0]!.height).toBe(126); // bis 100 + 118 + 8 = 226 → 126
  });

  it('R-10: ohne handleBounds bleibt es bei der gemessenen Node-Box', () => {
    const node = { id: 'a', position: { x: 0, y: 0 }, width: 160, height: 90, data: {} } as unknown as Node;
    const rects = nodesToObstacles([node], new Set());
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 160, height: 90 });
  });

  it('R-10: OBSTACLE_MARGIN (14) deckt das Clearance-Ziel (≥ 12 px)', () => {
    expect(OBSTACLE_MARGIN).toBeGreaterThanOrEqual(12);
  });

  it('skips excluded node ids', () => {
    const rects = nodesToObstacles(
      [
        { id: 'a', position: { x: 0, y: 0 }, data: {}, width: 10, height: 10 },
        { id: 'b', position: { x: 50, y: 50 }, data: {}, width: 10, height: 10 },
      ],
      new Set(['a'])
    );
    expect(rects).toHaveLength(1);
    expect(rects[0]!.x).toBe(50);
  });

  it('heuristic never exceeds a known optimal remaining cost', () => {
    expect(remainingCostLowerBound(0, 0, 0, 10, 0, 0)).toBe(10);
    expect(remainingCostLowerBound(0, 0, 0, 10, 5, 0)).toBe(15 + BEND_COST);
  });

  it('cache distinguishes different crossing geometries, not just their count', () => {
    const base = {
      sourceX: 0,
      sourceY: 40,
      targetX: 200,
      targetY: 40,
      ...rightLeft,
      obstacles: [] as Rect[],
    };
    const a = findCablePath({
      ...base,
      crossingSegments: [
        [
          { x: 80, y: -40 },
          { x: 80, y: 160 },
        ],
        [
          { x: 100, y: -40 },
          { x: 100, y: 160 },
        ],
        [
          { x: 120, y: -40 },
          { x: 120, y: 160 },
        ],
      ],
    });
    clearPathfindingCache();
    const b = findCablePath({
      ...base,
      crossingSegments: [
        [
          { x: 10, y: 40 },
          { x: 190, y: 40 },
        ],
        [
          { x: 10, y: 41 },
          { x: 190, y: 41 },
        ],
        [
          { x: 10, y: 42 },
          { x: 190, y: 42 },
        ],
      ],
    });
    expect(a.crossings).not.toBe(b.crossings);
  });

  it('cache returns the same object on identical requests', () => {
    const input = {
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 40,
      ...rightLeft,
      obstacles: [] as Rect[],
    };
    const a = findCablePath(input);
    const b = findCablePath(input);
    expect(a).toBe(b);
  });

  it('cache distinguishes different own-obstacle identities and geometry', () => {
    clearPathfindingCache();
    const ownSource = { x: 70, y: -24, width: 60, height: 48 };
    const offRoute = { x: 70, y: 120, width: 60, height: 48 };
    const input = {
      sourceX: 0,
      sourceY: 0,
      targetX: 200,
      targetY: 0,
      ...rightLeft,
      obstacles: [ownSource, offRoute] as Rect[],
    };
    const direct = findCablePath({ ...input, ownObstacles: [ownSource] });
    const detoured = findCablePath({ ...input, ownObstacles: [offRoute] });
    expect(detoured).not.toBe(direct);
    expect(detoured.waypoints).not.toEqual(direct.waypoints);
  });

  it('waypointsToPath emits a move and at least one line', () => {
    const d = waypointsToPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      4
    );
    expect(d.startsWith('M ')).toBe(true);
    expect(d).toContain(' L ');
    expect(d).toContain(' Q ');
  });

  it('countCrossings counts foreign segments, not own corners twice', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const others: [Point, Point][] = [
      [
        { x: 10, y: -5 },
        { x: 10, y: 5 },
      ],
    ];
    expect(countCrossings(path, others)).toBe(1);
  });
});

describe('lane helpers', () => {
  it('spreads parallel plus/minus lanes symmetrically', () => {
    const siblings = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'e2', source: 'a', target: 'b', sourceHandle: 'minus' },
    ];
    const o1 = parallelLaneOffset({
      edgeId: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: 'plus',
      siblingEdges: siblings,
    });
    const o2 = parallelLaneOffset({
      edgeId: 'e2',
      source: 'a',
      target: 'b',
      sourceHandle: 'minus',
      siblingEdges: siblings,
    });
    expect(o1).toBeCloseTo(-o2);
    expect(o1).not.toBe(0);
  });

  it('polarityPathOffset is larger for minus', () => {
    expect(polarityPathOffset('minus')).toBeGreaterThan(polarityPathOffset('plus'));
  });

  it('edgeLabelNudge only spreads labels that share a handle', () => {
    const siblings = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'e2', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'e3', source: 'a', target: 'b', sourceHandle: 'minus' },
    ];
    const n1 = edgeLabelNudge({
      edgeId: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: 'plus',
      siblingEdges: siblings,
    });
    const n3 = edgeLabelNudge({
      edgeId: 'e3',
      source: 'a',
      target: 'b',
      sourceHandle: 'minus',
      siblingEdges: siblings,
    });
    expect(n1).not.toBe(0);
    expect(n3).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-3: Fallback-Verhalten bei erschöpftem Suchbudget
// ---------------------------------------------------------------------------

describe('Fallback-Verhalten (R-3)', () => {
  it('Referenzplan: Fallback-Quote 0 — jede Kante kommt aus Katalog oder A*', () => {
    resetPathfindingTelemetry();
    for (const scenario of ROUTING_SCENARIOS) {
      const result = findCablePath({ ...scenario.input, skipCache: true });
      expect(result.usedSearch, `${scenario.id}: usedSearch ${result.usedSearch}`).not.toBe('fallback');
      expect(isOrthogonalPath(result.waypoints)).toBe(true);
    }
    expect(pathfindingFallbackCount()).toBe(0);
  });

  // ROUTE-BUG-31: Die Lane-Staffelung verlängert den Stub. Steht ein Bauteil
  // gegenüber, darf diese Verlängerung den Lane-Punkt nicht an das Bauteil
  // heranschieben — die Freigabe ist eine Regel, die Staffelung Komfort.
  it('kappt den Stub an der Bauteil-Freigabe, statt den Lane-Punkt heranzuschieben', () => {
    const wall: Rect = { x: 60, y: -60, width: 140, height: 120 };
    const result = findCablePath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 0,
      targetPosition: Position.Left,
      lane: 48,
      obstacles: [wall],
      skipCache: true,
    });
    const stubEnd = result.waypoints[1]!;
    // Ohne Kappung wäre der Stub 24 + 48 = 72 px lang und der Lane-Punkt
    // läge IN der Box. Mit Kappung gilt: 60 px Spalt − 12 px Freigabe = 48.
    expect(stubEnd.x).toBeGreaterThanOrEqual(ROUTING_TOKENS.stubMin);
    expect(stubEnd.x).toBeLessThanOrEqual(48 + 1e-6);
    // Und die ganze Route hält die Freigabe zum Rohbauteil ein.
    expect(pathHitsObstacles(result.waypoints, [inflateRect(wall, ROUTING_TOKENS.cableClearance)])).toBe(
      false
    );
  });

  // ROUTE-BUG-34: Greift die Kappung, darf das Bündel nicht zu einer Einheit
  // kollabieren — sonst laufen alle gekappten Kanten auf derselben Trasse.
  it('staffelt gekappte Stubs über den Bündel-Rang (ROUTE-BUG-34)', () => {
    const base = {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Top,
      targetX: 0,
      targetY: -400,
      targetPosition: Position.Bottom,
    };
    const inner = portFrame({ ...base, lane: -64, stubCap: 48, stubCapRank: 0 });
    const outer = portFrame({ ...base, lane: -80, stubCap: 48, stubCapRank: 1 });
    // Ohne Rang-Treppe wären beide Stubs 48 px — dieselbe Trasse (I2).
    expect(inner.stub).toBe(48);
    expect(outer.stub).toBe(48 - ROUTING_TOKENS.laneGrid);
  });

  // ROUTE-BUG-35: Rang −1 und +1 derselben Bauteilseite haben denselben
  // Betrag, also gleich lange Stubs und dieselbe Zuführungs-Achse.
  it('zieht den Gleichstand im Bündel nach innen (ROUTE-BUG-35)', () => {
    const base = {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Top,
      targetX: 0,
      targetY: -400,
      targetPosition: Position.Bottom,
    };
    const first = portFrame({ ...base, lane: -16, stubTie: 0 });
    const twin = portFrame({ ...base, lane: 16, stubTie: 1 });
    expect(first.stub).toBe(ROUTING_TOKENS.stubMin + 16);
    expect(twin.stub).toBe(ROUTING_TOKENS.stubMin);
  });

  // ROUTE-BUG-23: Eine Route, die die Bauteil-Freigabe aus geometrischer Not
  // unterschreitet, muss das sagen — statt still enger zu liegen. Dieselben
  // Fälle zählt `npm run routing:audit` als I3.
  it('Freigabe-Notstufe wird gekennzeichnet (tightMarginUsed)', () => {
    const stress = ROUTING_SCENARIOS.find((scenario) => scenario.id === '22-stress-scene');
    if (!stress) throw new Error('Referenzszenario 22 fehlt');
    // Der Ziel-Handle liegt 28 px vom Nachbarbauteil. Stub (24 px) plus
    // Freigabe (12 px) brauchen 36 px — beides gleichzeitig ist geometrisch
    // unmöglich, also greift R-7 („Stub-Recht") und die Route wird enger.
    expect(findCablePath({ ...stress.input, skipCache: true }).tightMarginUsed).toBe(true);

    const free = findCablePath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 200,
      targetY: 80,
      targetPosition: Position.Left,
      obstacles: [],
      skipCache: true,
    });
    expect(free.tightMarginUsed).toBeUndefined();
  });

  it('unerreichbares Ziel: Fallback ist orthogonal, zählt und warnt', () => {
    resetPathfindingTelemetry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Zielring: das Ziel ist vollständig von Hindernissen umschlossen
      // (ohne das Ziel selbst zu enthalten) — kein Pfad existiert.
      const result = findCablePath({
        skipCache: true,
        sourceX: -200,
        sourceY: 0,
        sourcePosition: Position.Right,
        targetX: 0,
        targetY: 0,
        targetPosition: Position.Left,
        obstacles: [
          { x: -80, y: -100, width: 160, height: 40 },
          { x: -80, y: 60, width: 160, height: 40 },
          { x: -80, y: -60, width: 30, height: 120 },
          { x: 50, y: -60, width: 30, height: 120 },
        ],
      });
      expect(result.usedSearch).toBe('fallback');
      expect(isOrthogonalPath(result.waypoints)).toBe(true);
      expect(pathfindingFallbackCount()).toBe(1);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
    resetPathfindingTelemetry();
  });
});

// AUDIT ROUTE-001 (Härtung 2026-09-08): `ownObstacles` — der Produktionspfad
// verwirft nur noch die EIGENE Box; fremde, am Start/Ziel klebende Boxen
// bleiben Hindernisse und werden nicht mehr lautlos durchroutet.
describe('ROUTE-001 ownObstacles — überlappende Fremd-Nodes', () => {
  // Fremde Box, die den Startpunkt (und damit auch den Stub) enthält —
  // das Modell einer an die eigene Node geklebten Nachbar-Node.
  const glued: Rect = { x: -40, y: 20, width: 260, height: 80 }; // enthält (0,60)

  it('Legacy (kein ownObstacles): fremde Box mit Start wird verworfen — dokumentierter Altvertrag', () => {
    resetPathfindingTelemetry();
    const result = route(0, 60, 600, 60, [glued]);
    // Altverhalten: die Box existiert für den Router nicht → „saubere“
    // Direktverbindung Mitten DURCH die fremde Node. Genau diese lautlose
    // Verletzung ist der Audit-Befund ROUTE-001 (Ausnahme a).
    expect(result.usedSearch).not.toBe('fallback');
    expect(pathHitsObstacles(result.waypoints, [glued])).toBe(true);
    resetPathfindingTelemetry();
  });

  it('mit ownObstacles: die fremde Klebe-Box bleibt Hindernis — Konflikt wird markiert statt versteckt', () => {
    resetPathfindingTelemetry();
    // Eigene Node-Box (liegt NICHT in der Hindernisliste — wie im
    // Produktionspfad, wo routeAll die eigene Node vorab ausschließt).
    const own: Rect = { x: -12, y: 48, width: 24, height: 24 };
    const result = route(0, 60, 600, 60, [glued], { ownObstacles: [own] });
    // Die Box ist unüberwindbar (Start liegt in ihr): der Router darf das
    // NICHT als Freigabe ausgeben — er fällt auf den markierten Notfallpfad.
    expect(result.usedSearch).toBe('fallback');
    expect(result.fallbackHitsObstacles).toBe(true);
    expect(pathfindingFallbackCount()).toBe(1);
    // Und: es bleibt eine echte Kollision — nur jetzt ZÄHLBAR und sichtbar.
    expect(pathHitsObstacles(result.waypoints, [glued])).toBe(true);
    resetPathfindingTelemetry();
  });

  it('mit ownObstacles: die eigene Box selbst wird weiterhin verworfen (Referenzgleichheit)', () => {
    resetPathfindingTelemetry();
    // Die eigene Box steht hier ausnahmsweise IN der Liste — sie darf nur
    // verworfen werden, weil sie per Referenz in ownObstacles steht.
    const ownA: Rect = { x: -16, y: 44, width: 32, height: 32 }; // enthält Start (0,60)
    const ownB: Rect = { x: 584, y: 44, width: 32, height: 32 }; // enthält Ziel (600,60)
    const result = route(0, 60, 600, 60, [ownA, ownB], { ownObstacles: [ownA, ownB] });
    expect(result.usedSearch).not.toBe('fallback');
    // Gerade Direktverbindung ohne jeden Umweg: wären die eigenen Boxen
    // Hindernisse geblieben, müsste die Route ausweichen (Knicke > 0,
    // Länge > 600). Die Strecke selbst schneidet naturgemäß die eigene Box
    // am Stub — darum schließt der Produktionspfad sie vorab aus.
    expect(result.bends).toBe(0);
    expect(result.length).toBeCloseTo(600, 6);
    resetPathfindingTelemetry();
  });

  it('mit ownObstacles: frei liegende fremde Box wird wie bisher umfahren (kein Verhaltensbruch)', () => {
    resetPathfindingTelemetry();
    const blocker: Rect = { x: 120, y: 20, width: 80, height: 80 }; // frei im Korridor
    const ownA: Rect = { x: -16, y: 44, width: 32, height: 32 };
    const ownB: Rect = { x: 584, y: 44, width: 32, height: 32 };
    const result = route(0, 60, 600, 60, [blocker], { ownObstacles: [ownA, ownB] });
    expect(result.usedSearch).not.toBe('fallback');
    expect(pathHitsObstacles(result.waypoints, [blocker])).toBe(false);
    expect(isOrthogonalPath(result.waypoints)).toBe(true);
    resetPathfindingTelemetry();
  });
});
