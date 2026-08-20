import { Position, getSmoothStepPath } from 'reactflow';

export const SMOOTH_STEP_BORDER_RADIUS = 10;
export const PLUS_PATH_OFFSET = 20;
export const MINUS_PATH_OFFSET = 32;
export const PLUS_LABEL_NUDGE = -40;
export const MINUS_LABEL_NUDGE = 40;
export const PARALLEL_LABEL_SPREAD = 22;

export interface PathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  /** First/last orthogonal stub length. Plus/Minus use different values so pairs do not share a corner. */
  offset?: number;
}

/**
 * Orthogonal schematic routing — the only path used for cables and pipes.
 * Bezier curves (and the old isProMode branch) are intentionally gone.
 */
export const calculateEdgePath = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  offset = PLUS_PATH_OFFSET,
}: PathParams): [string, number, number, number, number] => {
  return getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: SMOOTH_STEP_BORDER_RADIUS,
    offset,
  });
};

export const polarityPathOffset = (sourceHandle?: string | null): number => {
  if (sourceHandle?.includes('minus')) return MINUS_PATH_OFFSET;
  return PLUS_PATH_OFFSET;
};

export const polarityLabelNudge = (sourceHandle?: string | null): number => {
  if (sourceHandle?.includes('minus')) return MINUS_LABEL_NUDGE;
  if (sourceHandle?.includes('plus')) return PLUS_LABEL_NUDGE;
  return 0;
};

export type LabelEdgeRef = {
  id: string;
  source: string;
  target: string;
};

/**
 * Keeps plus/minus labels apart and spreads labels when several edges share a node pair.
 */
export const edgeLabelNudge = (input: {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  siblingEdges: LabelEdgeRef[];
}): number => {
  const polarity = polarityLabelNudge(input.sourceHandle);
  const group = input.siblingEdges.filter(
    (edge) =>
      (edge.source === input.source && edge.target === input.target) ||
      (edge.source === input.target && edge.target === input.source)
  );
  if (group.length <= 1) return polarity;
  const idx = Math.max(0, group.findIndex((edge) => edge.id === input.edgeId));
  const spread = (idx - (group.length - 1) / 2) * PARALLEL_LABEL_SPREAD;
  return polarity + spread;
};
