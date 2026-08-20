import { Position, getSmoothStepPath } from 'reactflow';

export const SMOOTH_STEP_BORDER_RADIUS = 10;
export const PLUS_PATH_OFFSET = 20;
export const MINUS_PATH_OFFSET = 32;
export const PLUS_LABEL_NUDGE = -40;
export const MINUS_LABEL_NUDGE = 40;
export const PARALLEL_LABEL_SPREAD = 22;
/**
 * Abstand zwischen gebündelten Leitungen derselben Trasse.
 * 16 px entsprechen bei Zoom 1 gut zwei Kabeldurchmessern — nah genug, damit
 * die Bündelung als Trasse lesbar bleibt, weit genug für saubere Trennung.
 */
export const PARALLEL_LANE_SPREAD = 16;

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
  sourceHandle?: string | null;
};

const sharePair = (a: LabelEdgeRef, b: LabelEdgeRef): boolean =>
  (a.source === b.source && a.target === b.target) ||
  (a.source === b.target && a.target === b.source);

/**
 * Kabeltyp einer Leitung, abgeleitet aus dem Quell-Anschluss.
 * Reihenfolge = Sortierrang der Lanes: gleiche Typen liegen dadurch
 * zwangsläufig nebeneinander im Bündel ("gleiche Kabeltypen gruppieren").
 */
export const CABLE_TYPE_ORDER = ['dc-plus', 'dc-minus', 'ac', 'signal'] as const;
export type CableLaneType = (typeof CABLE_TYPE_ORDER)[number];

export const cableLaneType = (sourceHandle?: string | null): CableLaneType => {
  const handle = sourceHandle?.toLowerCase() ?? '';
  if (handle.includes('minus')) return 'dc-minus';
  if (handle.includes('ac')) return 'ac';
  if (handle.includes('plus')) return 'dc-plus';
  return 'signal';
};

/** Plus zuerst, dann Minus, dann 230 V, dann Rest — deterministisch. */
const cableTypeRank = (edge: LabelEdgeRef): number =>
  CABLE_TYPE_ORDER.indexOf(cableLaneType(edge.sourceHandle));

/**
 * Paralleler Versatz (Lane) für gebündelte Leitungen. Kanten, die dasselbe
 * Node-Paar verbinden, bekommen jeweils einen eigenen Versatz, damit sie als
 * Trasse nebeneinander liegen statt übereinander.
 *
 * Sortiert wird nach Kabeltyp (Plus → Minus → 230 V → Rest) und erst danach
 * nach id. Zwei Plus-Leitungen liegen damit immer direkt nebeneinander, auch
 * wenn ihre ids alphabetisch auseinanderfallen. Der Abstand beträgt
 * PARALLEL_LANE_SPREAD (16 px) je Lane.
 */
export const parallelLaneOffset = (input: {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  siblingEdges: LabelEdgeRef[];
}): number => {
  const group = input.siblingEdges
    .filter((edge) => sharePair(edge, { id: input.edgeId, source: input.source, target: input.target }))
    .sort((a, b) => cableTypeRank(a) - cableTypeRank(b) || a.id.localeCompare(b.id));
  if (group.length <= 1) return polarityPathOffset(input.sourceHandle);
  const idx = Math.max(0, group.findIndex((edge) => edge.id === input.edgeId));
  return PLUS_PATH_OFFSET + idx * PARALLEL_LANE_SPREAD;
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
