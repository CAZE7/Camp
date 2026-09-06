export type ViewMode = 'electric' | 'water';

export type PlannerPosition = {
  x: number;
  y: number;
};

export type PlannerNodeData = {
  label?: string;
  watts?: number;
  hours?: number;
  amps?: number;
  efficiency?: number;
  capacity?: number;
  chemistry?: string;
  rating?: number;
  hasRcd?: boolean;
  continuousPower?: number;
  concurrentDevices?: string[];
  assignedEdges?: string[];
  voltage?: number;
  isInvalid?: boolean;
  [key: string]: any;
};

/**
 * Domain representation of a planner node.
 *
 * Keep this shape independent from React Flow. UI adapters may pass it to
 * React Flow because the fields are structurally compatible, but pure planner
 * logic should only depend on this type.
 */
export type PlannerNode<Data extends PlannerNodeData = PlannerNodeData> = {
  id: string;
  type?: string;
  position: PlannerPosition;
  data: Data;
  width?: number | null;
  height?: number | null;
  style?: any;
  draggable?: boolean;
  selectable?: boolean;
  selected?: boolean;
};

export type CableFunction =
  | 'positive'
  | 'negative'
  | 'ground'
  | 'solar'
  | 'main'
  | 'secondary'
  | 'shore'
  | 'inverter'
  | 'charging'
  | 'consumer'
  | 'busbar';

export type CableEdgeData = {
  length: number;
  crossSection?: number;
  fuseSize?: number;
  cableFunction?: CableFunction;
};

export type WaterPipeEdgeData = {
  pipeType?: string;
  diameter?: number;
  [key: string]: any;
};

export type PlannerEdge<Data = Record<string, any>> = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  data?: Data;
  selected?: boolean;
  animated?: boolean;
  style?: any;
  markerEnd?: any;
};

export type CablePlannerEdge = PlannerEdge<CableEdgeData>;
export type WaterPlannerEdge = PlannerEdge<WaterPipeEdgeData>;

export type PlannerConnection = {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type TapHandleType = 'source' | 'target';

export type TapHandle = {
  nodeId: string;
  handleId: string;
  handleType: TapHandleType;
};

export type BomData = {
  counts: Record<string, number>;
  cableLengths: Record<string, number>;
};

export type FitViewCallback = (options?: any) => void;
