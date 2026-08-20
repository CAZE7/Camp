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
  it('returns only the polarity nudge for a single edge', () => {
    expect(
      edgeLabelNudge({
        edgeId: 'e1',
        source: 'a',
        target: 'b',
        sourceHandle: 'plus',
        siblingEdges: [{ id: 'e1', source: 'a', target: 'b' }],
      })
    ).toBe(PLUS_LABEL_NUDGE);
  });

  it('spreads labels of parallel edges between the same pair', () => {
    const siblings = [
      { id: 'plus', source: 'a', target: 'b' },
      { id: 'minus', source: 'a', target: 'b' },
    ];
    const plus = edgeLabelNudge({
      edgeId: 'plus',
      source: 'a',
      target: 'b',
      sourceHandle: 'plus',
      siblingEdges: siblings,
    });
    const minus = edgeLabelNudge({
      edgeId: 'minus',
      source: 'a',
      target: 'b',
      sourceHandle: 'minus',
      siblingEdges: siblings,
    });
    expect(minus - plus).toBeGreaterThan(PARALLEL_LABEL_SPREAD);
    expect(plus).toBe(PLUS_LABEL_NUDGE - PARALLEL_LABEL_SPREAD / 2);
    expect(minus).toBe(MINUS_LABEL_NUDGE + PARALLEL_LABEL_SPREAD / 2);
  });
});
