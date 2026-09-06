import { Position, getBezierPath, getSmoothStepPath } from 'reactflow';

export interface PathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  isProMode?: boolean;
}

export const calculateEdgePath = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  isProMode,
}: PathParams): [string, number, number, number, number] => {
  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };

  return isProMode
    ? getSmoothStepPath({ ...pathParams, borderRadius: 10 })
    : getBezierPath(pathParams);
};
