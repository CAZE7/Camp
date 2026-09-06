import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateEdgePath } from './pathUtils';
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

  it('delegates to getBezierPath when isProMode is false', () => {
    const params = {
      sourceX: 10,
      sourceY: 20,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 200,
      targetPosition: Position.Left,
      isProMode: false,
    };

    const result = calculateEdgePath(params);

    expect(reactflow.getBezierPath).toHaveBeenCalledTimes(1);
    expect(reactflow.getBezierPath).toHaveBeenCalledWith({
      sourceX: 10,
      sourceY: 20,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 200,
      targetPosition: Position.Left,
    });
    expect(reactflow.getSmoothStepPath).not.toHaveBeenCalled();
    expect(result).toEqual(['bezierPath', 0, 0, 0, 0]);
  });

  it('delegates to getBezierPath when isProMode is undefined', () => {
    const params = {
      sourceX: 10,
      sourceY: 20,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 200,
      targetPosition: Position.Left,
    };

    const result = calculateEdgePath(params);

    expect(reactflow.getBezierPath).toHaveBeenCalledTimes(1);
    expect(reactflow.getBezierPath).toHaveBeenCalledWith(params);
    expect(reactflow.getSmoothStepPath).not.toHaveBeenCalled();
    expect(result).toEqual(['bezierPath', 0, 0, 0, 0]);
  });

  it('delegates to getSmoothStepPath with borderRadius when isProMode is true', () => {
    const params = {
      sourceX: 10,
      sourceY: 20,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 200,
      targetPosition: Position.Left,
      isProMode: true,
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
      borderRadius: 10,
    });
    expect(reactflow.getBezierPath).not.toHaveBeenCalled();
    expect(result).toEqual(['smoothStepPath', 0, 0, 0, 0]);
  });
});
