import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  waypointsToPath,
  waypointsToPathWithHops,
  calculateEdgePath,
  polarityPathOffset,
  edgeLabelNudge,
  SMOOTH_STEP_BORDER_RADIUS,
  PLUS_PATH_OFFSET,
  MINUS_PATH_OFFSET,
  PARALLEL_LABEL_SPREAD,
  PARALLEL_LANE_SPREAD,
  LABEL_BOX_WIDTH,
  LABEL_BOX_HEIGHT,
  labelBoundingBox,
  boxesOverlap,
  cableLaneType,
  laneOffset,
} from './pathUtils';
import { ALTERNATIVE_ROUTE_GAP } from './pathfinding';
import { Position } from '@xyflow/react';
import * as reactflow from '@xyflow/react';

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    getBezierPath: vi.fn().mockReturnValue(['bezierPath', 0, 0, 0, 0]),
    getSmoothStepPath: vi.fn().mockReturnValue(['smoothStepPath', 0, 0, 0, 0]),
  };
});

describe('calculateEdgePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always uses SmoothStep with borderRadius 10', () => {
    const params = {
      sourceX: 10,
      sourceY: 20,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 200,
      targetPosition: Position.Left,
    };

    const result = calculateEdgePath(params);

    expect(reactflow.getSmoothStepPath).toHaveBeenCalledTimes(1);
    expect(reactflow.getSmoothStepPath).toHaveBeenCalledWith({
      sourceX: 10,
      sourceY: 20,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 200,
      targetPosition: Position.Left,
      borderRadius: SMOOTH_STEP_BORDER_RADIUS,
      offset: PLUS_PATH_OFFSET,
    });
    expect(reactflow.getBezierPath).not.toHaveBeenCalled();
    expect(result).toEqual(['smoothStepPath', 0, 0, 0, 0]);
  });

  it('forwards a custom orthogonal offset (plus/minus stubs)', () => {
    calculateEdgePath({
      sourceX: 0,
      sourceY: 0,
      targetX: 10,
      targetY: 10,
      offset: MINUS_PATH_OFFSET,
    });

    expect(reactflow.getSmoothStepPath).toHaveBeenCalledWith(
      expect.objectContaining({
        borderRadius: SMOOTH_STEP_BORDER_RADIUS,
        offset: MINUS_PATH_OFFSET,
      })
    );
    expect(reactflow.getBezierPath).not.toHaveBeenCalled();
  });
});

describe('polarity helpers', () => {
  it('uses a longer stub for minus so pairs do not share a corner', () => {
    expect(polarityPathOffset('plus')).toBe(PLUS_PATH_OFFSET);
    expect(polarityPathOffset('minus')).toBe(MINUS_PATH_OFFSET);
    expect(polarityPathOffset(null)).toBe(PLUS_PATH_OFFSET);
  });
});

describe('edgeLabelNudge', () => {
  it('returns 0 for a single edge', () => {
    expect(
      edgeLabelNudge({
        edgeId: 'e1',
        source: 'a',
        target: 'b',
        sourceHandle: 'plus',
        siblingEdges: [{ id: 'e1', source: 'a', target: 'b' }],
      })
    ).toBe(0);
  });

  it('spreads labels of parallel edges on the same handle', () => {
    const siblings = [
      { id: 'plus-1', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'plus-2', source: 'a', target: 'b', sourceHandle: 'plus' },
    ];
    const plus1 = edgeLabelNudge({
      edgeId: 'plus-1',
      source: 'a',
      target: 'b',
      sourceHandle: 'plus',
      siblingEdges: siblings,
    });
    const plus2 = edgeLabelNudge({
      edgeId: 'plus-2',
      source: 'a',
      target: 'b',
      sourceHandle: 'plus',
      siblingEdges: siblings,
    });
    expect(plus2 - plus1).toBe(PARALLEL_LABEL_SPREAD);
  });

  it('ordnet Labels deterministisch, auch bei invertierter Store-Reihenfolge (Bug 8)', () => {
    // Store-Reihenfolge z-plus VOR a-plus; die Label-Sortierung stellt
    // alphabetisch um — früher wurde in Store-Reihenfolge indexiert und
    // die Labels lagen gespiegelt zu ihren Lanes (Lane-Reihenfolge liefert
    // seit dem globalen Routing-Pass portFanOutLanes; die Sortierordnung
    // Kabeltyp → id ist in edgeLabelNudge dieselbe).
    const siblings = [
      { id: 'z-plus', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'a-plus', source: 'a', target: 'b', sourceHandle: 'plus' },
    ];
    const nudgeOf = (edgeId: string) =>
      edgeLabelNudge({ edgeId, source: 'a', target: 'b', sourceHandle: 'plus', siblingEdges: siblings });

    expect(nudgeOf('a-plus')).toBeLessThan(nudgeOf('z-plus'));
  });

  it('behandelt null und undefined sourceHandle identisch (Bug 16)', () => {
    const siblings = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: null },
      { id: 'e2', source: 'a', target: 'b' }, // undefined
    ];
    const n1 = edgeLabelNudge({
      edgeId: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: undefined,
      siblingEdges: siblings,
    });
    const n2 = edgeLabelNudge({
      edgeId: 'e2',
      source: 'a',
      target: 'b',
      sourceHandle: null,
      siblingEdges: siblings,
    });
    expect(Math.abs(n1 - n2)).toBe(PARALLEL_LABEL_SPREAD);
  });
});

describe('Label-Sortierung derselben Node-Paar-Gruppe (M10-1)', () => {
  const pair = { source: 'a', target: 'b' };

  it('recognises the cable type from the source handle', () => {
    expect(cableLaneType('battery-plus')).toBe('dc-plus');
    expect(cableLaneType('busbar-minus')).toBe('dc-minus');
    expect(cableLaneType('ac-out')).toBe('ac');
    expect(cableLaneType(null)).toBe('signal');
  });

  it('spreads same-handle labels by id, foreign handles stay at 0', () => {
    // ids sind absichtlich so gewählt, dass alphabetisch Minus zwischen die
    // beiden Plus-Leitungen fiele. edgeLabelNudge spreizt nur Labels der
    // GLEICHEN Handle-Gruppe — eine Minus-Leitung teilt den Labelslot nicht.
    const siblings = [
      { id: 'a-plus', ...pair, sourceHandle: 'plus' },
      { id: 'm-minus', ...pair, sourceHandle: 'minus' },
      { id: 'z-plus', ...pair, sourceHandle: 'plus' },
    ];
    const nudgeOf = (id: string, handle: string) =>
      edgeLabelNudge({ edgeId: id, ...pair, sourceHandle: handle, siblingEdges: siblings });

    const plusA = nudgeOf('a-plus', 'plus');
    const plusZ = nudgeOf('z-plus', 'plus');
    const minus = nudgeOf('m-minus', 'minus');

    expect(Math.abs(plusZ - plusA)).toBe(PARALLEL_LABEL_SPREAD);
    expect(minus).toBe(0);
  });

  it('is deterministic — same input, same nudge', () => {
    const siblings = [
      { id: 'e1', ...pair, sourceHandle: 'plus' },
      { id: 'e2', ...pair, sourceHandle: 'plus' },
    ];
    const first = edgeLabelNudge({ edgeId: 'e2', ...pair, sourceHandle: 'plus', siblingEdges: siblings });
    const second = edgeLabelNudge({
      edgeId: 'e2',
      ...pair,
      sourceHandle: 'plus',
      siblingEdges: [...siblings].reverse(),
    });
    expect(first).toBe(second);
  });
});

describe('M8-3 / M10-1 Label-Boxen', () => {
  it('PARALLEL_LABEL_SPREAD hält 88×20-Boxen auseinander', () => {
    expect(LABEL_BOX_WIDTH).toBe(88);
    expect(LABEL_BOX_HEIGHT).toBe(20);
    expect(PARALLEL_LABEL_SPREAD).toBeGreaterThanOrEqual(LABEL_BOX_HEIGHT);

    const siblings = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'e2', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'e3', source: 'a', target: 'b', sourceHandle: 'plus' },
    ];
    const boxes = siblings.map((edge) => {
      const nudge = edgeLabelNudge({
        edgeId: edge.id,
        source: 'a',
        target: 'b',
        sourceHandle: 'plus',
        siblingEdges: siblings,
      });
      return labelBoundingBox(200, 50 + nudge);
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// R-5: Ein Lane-System — alle Quer-Versätze sind Vielfache der Lane
// ---------------------------------------------------------------------------

describe('Lane-System (R-5)', () => {
  it('laneOffset bildet das eine Raster ab', () => {
    expect(laneOffset(1)).toBe(PARALLEL_LANE_SPREAD);
    expect(laneOffset(0)).toBe(0);
    expect(laneOffset(-2)).toBe(-2 * PARALLEL_LANE_SPREAD);
    expect(laneOffset(1.5)).toBe(24);
  });

  it('Polaritäts- und Bündel-Lanes nutzen dieselbe Logik', () => {
    expect(PLUS_PATH_OFFSET).toBe(laneOffset(1.5));
    expect(MINUS_PATH_OFFSET).toBe(laneOffset(2.5));
    // Minus liegt genau eine ganze Lane unter Plus — keine 14-px-Dissonanz mehr.
    expect(MINUS_PATH_OFFSET - PLUS_PATH_OFFSET).toBe(PARALLEL_LANE_SPREAD);
  });

  it('Ausweich-Trassen der Router liegen auf ganzzahligen Lanes', () => {
    expect(ALTERNATIVE_ROUTE_GAP).toBe(laneOffset(3));
    expect(ALTERNATIVE_ROUTE_GAP * 2).toBe(laneOffset(6));
  });
});

// ---------------------------------------------------------------------------
// WP-7 (#395): Hop-Rendering — Kreuzung ≠ Verbindung
// ---------------------------------------------------------------------------

describe('waypointsToPathWithHops', () => {
  const line = [
    { x: 0, y: 100 },
    { x: 200, y: 100 },
  ];

  it('ist ohne Hops zeichengleich mit waypointsToPath', () => {
    const knick = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ];
    expect(waypointsToPathWithHops(knick, 8)).toBe(waypointsToPath(knick, 8));
    expect(waypointsToPathWithHops(knick, 8, [])).toBe(waypointsToPath(knick, 8));
  });

  it('setzt einen Halbkreis-Bogen um den Kreuzungspunkt', () => {
    const d = waypointsToPathWithHops(line, 8, [{ x: 100, y: 100, orientation: 'horizontal' }]);
    expect(d).toBe('M 0 100 L 92 100 A 8 8 0 0 1 108 100 L 200 100');
  });

  it('wölbt den Bogen richtungsunabhängig zur selben Seite', () => {
    const rechts = waypointsToPathWithHops(line, 8, [{ x: 100, y: 100, orientation: 'horizontal' }]);
    const links = waypointsToPathWithHops([...line].reverse(), 8, [
      { x: 100, y: 100, orientation: 'horizontal' },
    ]);
    // Gegenläufig ⇒ gespiegeltes Sweep-Flag, damit die Wölbung gleich bleibt.
    expect(rechts).toContain('A 8 8 0 0 1');
    expect(links).toContain('A 8 8 0 0 0');
  });

  it('zeichnet mehrere Bögen entlang derselben Strecke in Laufrichtung', () => {
    const d = waypointsToPathWithHops(line, 8, [
      { x: 150, y: 100, orientation: 'horizontal' },
      { x: 50, y: 100, orientation: 'horizontal' },
    ]);
    expect(d).toBe('M 0 100 L 42 100 A 8 8 0 0 1 58 100 L 142 100 A 8 8 0 0 1 158 100 L 200 100');
  });

  it('behandelt senkrechte Strecken gleichwertig', () => {
    const d = waypointsToPathWithHops(
      [
        { x: 40, y: 0 },
        { x: 40, y: 200 },
      ],
      8,
      [{ x: 40, y: 100, orientation: 'vertical' }]
    );
    expect(d).toBe('M 40 0 L 40 92 A 8 8 0 0 1 40 108 L 40 200');
  });

  it('ignoriert Hops, die nicht auf der Leitung liegen', () => {
    const d = waypointsToPathWithHops(line, 8, [
      { x: 100, y: 40, orientation: 'horizontal' },
      { x: 300, y: 100, orientation: 'horizontal' },
      { x: 100, y: 100, orientation: 'vertical' },
    ]);
    expect(d).toBe(waypointsToPath(line, 8));
  });

  it('ignoriert Hops exakt auf einem Endpunkt (dort gibt es nichts zu überbrücken)', () => {
    const d = waypointsToPathWithHops(line, 8, [{ x: 0, y: 100, orientation: 'horizontal' }]);
    expect(d).toBe(waypointsToPath(line, 8));
  });

  it('verteilt Bögen auf beide Schenkel eines Knicks und behält die Ecke', () => {
    const knick = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
    ];
    const d = waypointsToPathWithHops(knick, 8, [
      { x: 100, y: 0, orientation: 'horizontal' },
      { x: 200, y: 100, orientation: 'vertical' },
    ]);
    expect(d).toBe(
      'M 0 0 L 92 0 A 8 8 0 0 1 108 0 L 192 0 Q 200 0 200 8 L 200 92 A 8 8 0 0 1 200 108 L 200 200'
    );
  });

  it('staucht den Bogen, statt in die gerundete Ecke zu laufen', () => {
    const knick = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 60 },
    ];
    // Kreuzung 4 px vor der Ecke: der Bogen darf höchstens Radius 4 haben.
    const d = waypointsToPathWithHops(knick, 8, [{ x: 8, y: 0, orientation: 'horizontal' }]);
    expect(d).toContain('A 4 4 0 0 1');
    expect(d).toContain('Q 20 0');
  });

  it('lässt aufeinander folgende Bögen nicht ineinander laufen', () => {
    const d = waypointsToPathWithHops(line, 8, [
      { x: 100, y: 100, orientation: 'horizontal' },
      { x: 110, y: 100, orientation: 'horizontal' },
    ]);
    // Zweiter Bogen auf Radius 8 würde bei 102 beginnen — vor dem Ende des ersten (108).
    expect(d).toBe('M 0 100 L 92 100 A 8 8 0 0 1 108 100 A 2 2 0 0 1 112 100 L 200 100');
  });

  it('erlaubt einen eigenen Bogenradius unabhängig vom Eckenradius', () => {
    const d = waypointsToPathWithHops(line, 16, [{ x: 100, y: 100, orientation: 'horizontal' }], 8);
    expect(d).toContain('A 8 8 0 0 1');
  });

  it('bleibt bei zu kurzen Wegen leer bzw. unverändert', () => {
    expect(waypointsToPathWithHops([{ x: 0, y: 0 }], 8, [{ x: 0, y: 0, orientation: 'horizontal' }])).toBe(
      ''
    );
  });
});
