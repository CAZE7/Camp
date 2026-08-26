import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateEdgePath,
  polarityPathOffset,
  polarityLabelNudge,
  edgeLabelNudge,
  SMOOTH_STEP_BORDER_RADIUS,
  PLUS_PATH_OFFSET,
  MINUS_PATH_OFFSET,
  PLUS_LABEL_NUDGE,
  MINUS_LABEL_NUDGE,
  PARALLEL_LABEL_SPREAD,
  PARALLEL_LANE_SPREAD,
  parallelLaneOffset,
  cableLaneType,
} from './pathUtils';
import { Position } from 'reactflow';
import * as reactflow from 'reactflow';

vi.mock('reactflow', async () => {
  const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
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

  it('nudges plus labels up and minus labels down', () => {
    expect(polarityLabelNudge('plus')).toBe(PLUS_LABEL_NUDGE);
    expect(polarityLabelNudge('handle-minus')).toBe(MINUS_LABEL_NUDGE);
    expect(polarityLabelNudge(undefined)).toBe(0);
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

  it('ordnet Labels konsistent zu den Lanes, auch bei invertierter Store-Reihenfolge (Bug 8)', () => {
    // Store-Reihenfolge z-plus VOR a-plus; die Lane-Sortierung stellt
    // alphabetisch um. Die Labels müssen derselben Sortierung folgen —
    // vorher wurden sie in Store-Reihenfolge indexiert und lagen gespiegelt
    // zu ihren Lanes.
    const siblings = [
      { id: 'z-plus', source: 'a', target: 'b', sourceHandle: 'plus' },
      { id: 'a-plus', source: 'a', target: 'b', sourceHandle: 'plus' },
    ];
    const nudgeOf = (edgeId: string) =>
      edgeLabelNudge({ edgeId, source: 'a', target: 'b', sourceHandle: 'plus', siblingEdges: siblings });
    const laneOf = (edgeId: string) =>
      parallelLaneOffset({ edgeId, source: 'a', target: 'b', sourceHandle: 'plus', siblingEdges: siblings });

    // a-plus liegt in beiden Ordnungen vor z-plus → kleineres Label-Nudge.
    expect(nudgeOf('a-plus')).toBeLessThan(nudgeOf('z-plus'));
    expect(laneOf('a-plus')).toBeLessThan(laneOf('z-plus'));
    // Konsistenz: Label-Reihenfolge == Lane-Reihenfolge.
    expect(Math.sign(nudgeOf('z-plus') - nudgeOf('a-plus'))).toBe(
      Math.sign(laneOf('z-plus') - laneOf('a-plus'))
    );
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

describe('parallelLaneOffset (Trassen-Bündelung)', () => {
  const pair = { source: 'a', target: 'b' };

  it('keeps a single edge centered (offset 0)', () => {
    expect(
      parallelLaneOffset({
        edgeId: 'e1',
        ...pair,
        sourceHandle: 'plus',
        siblingEdges: [{ id: 'e1', ...pair, sourceHandle: 'plus' }],
      })
    ).toBe(0);
  });

  it('separates three parallel cables by exactly 16 px each (A5)', () => {
    const siblings = [
      { id: 'c', ...pair, sourceHandle: 'plus' },
      { id: 'a', ...pair, sourceHandle: 'plus' },
      { id: 'b', ...pair, sourceHandle: 'minus' },
    ];
    const offsets = siblings
      .map((edge) =>
        parallelLaneOffset({ edgeId: edge.id, ...pair, sourceHandle: edge.sourceHandle, siblingEdges: siblings })
      )
      .sort((x, y) => x - y);

    expect(offsets).toEqual([-16, 0, 16]);
    expect(PARALLEL_LANE_SPREAD).toBe(16);
    expect(offsets[1] - offsets[0]).toBe(16);
    expect(offsets[2] - offsets[1]).toBe(16);
  });

  it('groups identical cable types next to each other, regardless of edge id', () => {
    // ids sind absichtlich so gewählt, dass alphabetisch Minus zwischen die
    // beiden Plus-Leitungen fiele.
    const siblings = [
      { id: 'a-plus', ...pair, sourceHandle: 'plus' },
      { id: 'm-minus', ...pair, sourceHandle: 'minus' },
      { id: 'z-plus', ...pair, sourceHandle: 'plus' },
    ];
    const offsetOf = (id: string, handle: string) =>
      parallelLaneOffset({ edgeId: id, ...pair, sourceHandle: handle, siblingEdges: siblings });

    const plusA = offsetOf('a-plus', 'plus');
    const plusZ = offsetOf('z-plus', 'plus');
    const minus = offsetOf('m-minus', 'minus');

    // Beide Plus-Leitungen liegen direkt nebeneinander, Minus danach.
    expect(Math.abs(plusZ - plusA)).toBe(PARALLEL_LANE_SPREAD);
    expect(minus).toBeGreaterThan(Math.max(plusA, plusZ));
  });

  it('recognises the cable type from the source handle', () => {
    expect(cableLaneType('battery-plus')).toBe('dc-plus');
    expect(cableLaneType('busbar-minus')).toBe('dc-minus');
    expect(cableLaneType('ac-out')).toBe('ac');
    expect(cableLaneType(null)).toBe('signal');
  });

  it('is deterministic — same input, same lane', () => {
    const siblings = [
      { id: 'e1', ...pair, sourceHandle: 'plus' },
      { id: 'e2', ...pair, sourceHandle: 'plus' },
    ];
    const first = parallelLaneOffset({ edgeId: 'e2', ...pair, sourceHandle: 'plus', siblingEdges: siblings });
    const second = parallelLaneOffset({ edgeId: 'e2', ...pair, sourceHandle: 'plus', siblingEdges: [...siblings].reverse() });
    expect(first).toBe(second);
  });
});
