import { Position, getSmoothStepPath } from 'reactflow';
import type { Point } from './pathfinding';

export const SMOOTH_STEP_BORDER_RADIUS = 10;
export const PLUS_PATH_OFFSET = 24;
export const MINUS_PATH_OFFSET = 38;
export const PLUS_LABEL_NUDGE = -48;
export const MINUS_LABEL_NUDGE = 48;
export const PARALLEL_LABEL_SPREAD = 24;
/**
 * Abstand zwischen gebündelten Leitungen derselben Trasse.
 * 20 px entsprechen bei Zoom 1 gut zwei Kabeldurchmessern und halten
 * parallele Leitungen klar trennbar, ohne die Trasse optisch aufzusprengen.
 */
export const PARALLEL_LANE_SPREAD = 20;

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
  (a.source === b.source && a.target === b.target) || (a.source === b.target && a.target === b.source);

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
  if (group.length <= 1) return 0;
  const idx = Math.max(
    0,
    group.findIndex((edge) => edge.id === input.edgeId)
  );
  return (idx - (group.length - 1) / 2) * PARALLEL_LANE_SPREAD;
};

/**
 * Keeps labels apart and spreads labels when several edges share a node pair
 * and handle.
 *
 * Wichtig: Die Gruppe wird EXAKT so sortiert wie parallelLaneOffset (Kabeltyp,
 * dann id). Vorher wurde in Store-Reihenfolge indexiert — die Label-Reihen-
 * folge konnte dadurch gegenüber der Lane-Reihenfolge der Kabel gespiegelt
 * sein (Label von Kabel A lag neben Kabel B), sobald die Kanten-Reihenfolge
 * im Store von der Lane-Sortierung abwich.
 *
 * Handle-Vergleich mit `?? null`-Normalisierung: React Flow liefert
 * `sourceHandle` je nach Entstehung der Kante als `null` oder `undefined`;
 * beide müssen als „kein Handle“ zusammenpassen.
 */
export const edgeLabelNudge = (input: {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  siblingEdges: LabelEdgeRef[];
}): number => {
  const inputHandle = input.sourceHandle ?? null;
  const group = input.siblingEdges
    .filter((edge) => sharePair(edge, { id: input.edgeId, source: input.source, target: input.target }))
    .sort((a, b) => cableTypeRank(a) - cableTypeRank(b) || a.id.localeCompare(b.id));
  if (group.length <= 1) return 0;
  const sameHandleGroup = group.filter((edge) => (edge.sourceHandle ?? null) === inputHandle);
  if (sameHandleGroup.length <= 1) return 0;
  const idx = Math.max(
    0,
    sameHandleGroup.findIndex((edge) => edge.id === input.edgeId)
  );
  return (idx - (sameHandleGroup.length - 1) / 2) * PARALLEL_LABEL_SPREAD;
};

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

export const distance = (a: Point, b: Point): number => Math.abs(b.x - a.x) + Math.abs(b.y - a.y);

const euclid = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

const toward = (a: Point, b: Point, d: number): Point => {
  const len = euclid(a, b);
  if (len === 0) return { x: a.x, y: a.y };
  const t = Math.min(1, d / len);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

/** SVG-Pfad mit abgerundeten orthogonalen Ecken. */
export function waypointsToPath(waypoints: Point[], radius: number): string {
  if (waypoints.length < 2) return '';
  let d = `M ${fmt(waypoints[0].x)} ${fmt(waypoints[0].y)}`;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    const r = Math.min(radius, euclid(prev, curr) / 2, euclid(curr, next) / 2);
    const inPt = toward(curr, prev, r);
    const outPt = toward(curr, next, r);
    d += ` L ${fmt(inPt.x)} ${fmt(inPt.y)} Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(outPt.x)} ${fmt(outPt.y)}`;
  }
  const last = waypoints[waypoints.length - 1];
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

export function polylineMidpoint(waypoints: Point[]): Point {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (waypoints.length === 1) return { x: waypoints[0].x, y: waypoints[0].y };

  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const len = euclid(waypoints[i], waypoints[i + 1]);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return { x: waypoints[0].x, y: waypoints[0].y };
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (acc + lengths[i] >= total / 2) {
      return toward(waypoints[i], waypoints[i + 1], total / 2 - acc);
    }
    acc += lengths[i];
  }
  return { x: waypoints[waypoints.length - 1].x, y: waypoints[waypoints.length - 1].y };
}
