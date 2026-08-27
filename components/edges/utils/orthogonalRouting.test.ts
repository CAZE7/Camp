import { describe, it, expect } from 'vitest';
import { Position, type Node } from 'reactflow';
import {
  routeWaypoints,
  avoidObstacles,
  waypointsToPath,
  polylineMidpoint,
  segmentCrossesRect,
  buildOrthogonalPath,
  orthogonalWaypoints,
  nodesToObstacles,
  sourceExitVector,
  targetEntryVector,
  segmentsIntersect,
  countCrossings,
  waypointsToSegments,
  edgesToCrossingSegments,
  MAX_ACCEPTABLE_CROSSINGS,
  Segment,
} from './orthogonalRouting';

describe('direction vectors', () => {
  it('maps positions to exit/entry directions', () => {
    expect(sourceExitVector(Position.Right)).toEqual({ x: 1, y: 0 });
    expect(sourceExitVector(Position.Left)).toEqual({ x: -1, y: 0 });
    expect(sourceExitVector(Position.Top)).toEqual({ x: 0, y: -1 });
    expect(sourceExitVector(Position.Bottom)).toEqual({ x: 0, y: 1 });
    // Target wird von der gegenüberliegenden Seite betreten.
    expect(targetEntryVector(Position.Left)).toEqual({ x: 1, y: 0 });
    expect(targetEntryVector(Position.Right)).toEqual({ x: -1, y: 0 });
  });
});

describe('routeWaypoints', () => {
  it('produces a Z-shaped path for left-to-right flow (source right, target left)', () => {
    const pts = routeWaypoints({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 100,
      targetPosition: Position.Left,
    });
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 100 });
    // Alle Segmente müssen achsenparallel sein.
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
  });

  it('applies lane offset to intermediate corridor', () => {
    const base = routeWaypoints({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 100,
      targetPosition: Position.Left,
      offset: 20,
    });
    expect(base[0]).toEqual({ x: 0, y: 0 });
    expect(base[base.length - 1]).toEqual({ x: 100, y: 100 });
    expect(base[1].x).toBe(70); // (0+100)/2 + 20
  });

  it('routes around (loop) when target is behind the source', () => {
    const pts = routeWaypoints({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 100,
      targetPosition: Position.Right,
    });
    const xs = pts.map((p) => p.x);
    expect(Math.max(...xs)).toBeGreaterThan(100);
  });
});

describe('segmentCrossesRect', () => {
  const rect = { x: 50, y: 50, width: 20, height: 20 };

  it('detects a vertical segment crossing a rect', () => {
    expect(segmentCrossesRect({ x: 55, y: 0 }, { x: 55, y: 100 }, rect)).toBe(true);
  });

  it('detects a horizontal segment crossing a rect', () => {
    expect(segmentCrossesRect({ x: 0, y: 55 }, { x: 100, y: 55 }, rect)).toBe(true);
  });

  it('ignores segments outside the rect', () => {
    expect(segmentCrossesRect({ x: 30, y: 0 }, { x: 30, y: 100 }, rect)).toBe(false);
    expect(segmentCrossesRect({ x: 0, y: 30 }, { x: 100, y: 30 }, rect)).toBe(false);
  });
});

describe('avoidObstacles', () => {
  it('detours a vertical path around a node in the middle', () => {
    const waypoints = [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ];
    const obstacle = { x: 80, y: 80, width: 40, height: 40 };
    const routed = avoidObstacles(waypoints, [obstacle], 10);

    // Der Pfad darf das aufgeblähte Hindernis nicht mehr kreuzen.
    for (let i = 0; i < routed.length - 1; i++) {
      expect(segmentCrossesRect(routed[i], routed[i + 1], { x: 70, y: 70, width: 60, height: 60 })).toBe(
        false
      );
    }
    expect(routed.length).toBeGreaterThan(2);
  });

  it('returns the path unchanged when there are no obstacles', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    expect(avoidObstacles(waypoints, [])).toEqual(waypoints);
  });
});

describe('waypointsToPath', () => {
  it('starts with M and ends at the last waypoint', () => {
    const path = waypointsToPath(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 100 },
      ],
      10
    );
    expect(path.startsWith('M 0 0')).toBe(true);
    expect(path).toContain('Q');
    expect(path).toContain('100 100');
  });
});

describe('polylineMidpoint', () => {
  it('returns the middle of a straight line', () => {
    expect(
      polylineMidpoint([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ])
    ).toEqual({ x: 50, y: 0 });
  });
});

describe('buildOrthogonalPath', () => {
  it('returns a valid path plus label coordinates', () => {
    const result = buildOrthogonalPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 200,
      targetY: 100,
      targetPosition: Position.Left,
      obstacles: [{ x: 90, y: -20, width: 40, height: 140 }],
    });
    expect(result.path.startsWith('M')).toBe(true);
    expect(Number.isFinite(result.labelX)).toBe(true);
    expect(Number.isFinite(result.labelY)).toBe(true);
  });
});

describe('nodesToObstacles', () => {
  it('excludes source and target nodes', () => {
    const rects = nodesToObstacles(
      [
        { id: 'a', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', position: { x: 100, y: 0 }, data: {} },
        { id: 'c', position: { x: 200, y: 0 }, data: {} },
      ],
      new Set(['a', 'b'])
    );
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBe(200);
    expect(rects[0].width).toBeGreaterThan(0);
  });
});

describe('Kreuzungs-Erkennung', () => {
  it('detects crossing segments and ignores parallel ones', () => {
    expect(
      segmentsIntersect(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 5, y: -5 },
          { x: 5, y: 5 },
        ]
      )
    ).toBe(true);
    expect(
      segmentsIntersect(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 0, y: 8 },
          { x: 10, y: 8 },
        ]
      )
    ).toBe(false);
  });

  it('counts every crossing of a polyline', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const others: Segment[] = [
      [
        { x: 20, y: -10 },
        { x: 20, y: 10 },
      ],
      [
        { x: 60, y: -10 },
        { x: 60, y: 10 },
      ],
      [
        { x: 90, y: 50 },
        { x: 110, y: 50 },
      ],
      [
        { x: 0, y: 500 },
        { x: 100, y: 500 },
      ],
    ];
    expect(countCrossings(route, others)).toBe(3);
    expect(countCrossings(route, [])).toBe(0);
  });

  it('turns waypoints into segments', () => {
    expect(
      waypointsToSegments([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ])
    ).toHaveLength(2);
  });
});

describe('buildOrthogonalPath — Ausweichroute bei Kabelknäuel', () => {
  const base = {
    sourceX: 0,
    sourceY: 0,
    sourcePosition: Position.Right,
    targetX: 400,
    targetY: 100,
    targetPosition: Position.Left,
    offset: 0,
  };

  it('keeps the standard lane when there is nothing to gain', () => {
    const withoutOthers = buildOrthogonalPath(base);
    expect(withoutOthers.crossings).toBe(0);
    expect(withoutOthers.path.startsWith('M')).toBe(true);
  });

  it('keeps the standard lane at three or fewer crossings (no nervous re-routing)', () => {
    const others: Segment[] = [40, 120, 160].map(
      (y) =>
        [
          { x: 150, y },
          { x: 250, y },
        ] as Segment
    );
    const result = buildOrthogonalPath({ ...base, crossingSegments: others });
    const reference = buildOrthogonalPath(base);
    expect(result.crossings).toBeLessThanOrEqual(MAX_ACCEPTABLE_CROSSINGS);
    expect(result.path).toBe(reference.path);
  });

  it('picks a wider lane when more than three cables are crossed', () => {
    // Vier kurze Sperren genau auf dem vertikalen Standard-Korridor (x = 200),
    // die eine um 32 px versetzte Route (x = 232) nicht mehr trifft.
    const others: Segment[] = [20, 40, 60, 80].map(
      (y) =>
        [
          { x: 190, y },
          { x: 210, y },
        ] as Segment
    );

    const standard = buildOrthogonalPath(base);
    const standardCrossings = countCrossings(orthogonalWaypoints(base).waypoints, others);
    const rerouted = buildOrthogonalPath({ ...base, crossingSegments: others });

    expect(standardCrossings).toBe(4);
    expect(rerouted.crossings).toBeLessThan(4);
    expect(rerouted.path).not.toBe(standard.path);
  });
});

describe('edgesToCrossingSegments', () => {
  const nodes: Node[] = [
    { id: 'a', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} },
    { id: 'b', position: { x: 300, y: 0 }, width: 100, height: 100, data: {} },
    { id: 'c', position: { x: 300, y: 300 }, width: 100, height: 100, data: {} },
  ];

  it('approximates other edges by their node centres', () => {
    const segments = edgesToCrossingSegments(
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
      ],
      nodes,
      (edge) => edge.id === 'e1'
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual([
      { x: 50, y: 50 },
      { x: 350, y: 350 },
    ]);
  });

  it('skips edges whose nodes are unknown', () => {
    const segments = edgesToCrossingSegments([{ id: 'x', source: 'a', target: 'ghost' }], nodes, () => false);
    expect(segments).toHaveLength(0);
  });
});

describe('parallele Lanes bleiben geometrisch getrennt (A5)', () => {
  it('places three lanes 16 px apart on the vertical corridor', () => {
    const lanes = [-16, 0, 16].map((offset) =>
      routeWaypoints({
        sourceX: 0,
        sourceY: 0,
        sourcePosition: Position.Right,
        targetX: 400,
        targetY: 200,
        targetPosition: Position.Left,
        offset,
      })
    );
    const xs = lanes.map((points) => points[1].x);
    expect(xs[0]).toBe(200 - 16);
    expect(xs[1]).toBe(200);
    expect(xs[2]).toBe(200 + 16);
    expect(Math.abs(xs[1] - xs[0])).toBe(16);
    expect(Math.abs(xs[2] - xs[1])).toBe(16);
    expect(new Set(xs).size).toBe(3);
  });
});
