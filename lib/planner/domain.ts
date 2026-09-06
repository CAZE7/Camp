export type ViewMode = 'electric' | 'water';

export type PlannerPosition = {
  x: number;
  y: number;
};

/**
 * Fachlich typisiertes Datenprofil eines Planner-Knotens.
 *
 * WICHTIG: Dies ist KEIN generisches React-Flow-Node-Modell mehr. Alle hier
 * deklarierten Felder sind bekannte, fachlich bedeutsame Eigenschaften der
 * jeweiligen Komponente (Batterie, Verbraucher, Sicherung, Sammelschiene, …).
 * Es gibt bewusst KEINEN index-signature-Fallback `[key: string]: any` mehr.
 *
 * Für eine strikt typisierte, diskriminierte Sicht pro Komponententyp siehe
 * `lib/planner/domainModel.ts` (`PlannerDomainNode`, `defaultDataForKind`).
 */
export type PlannerNodeData = {
  // Gemeinsame UI-/Zustands-Felder
  label?: string;
  isInvalid?: boolean;
  assignedEdges?: string[];
  concurrentDevices?: string[];

  // Batterie
  capacity?: number;
  chemistry?: string;
  doD?: number;

  // Verbraucher (12V / 230V) & Wechselrichter
  watts?: number;
  hours?: number;
  amps?: number;
  efficiency?: number;
  continuousPower?: number;
  voltage?: number;

  // Sicherung / Sammelschiene / Shunt
  rating?: number;
  maxAmps?: number;
  poles?: number;
  rcd?: boolean;
  hasRcd?: boolean;

  // Solar
  orientation?: string;

  // Dach-Fenster / Dach-Panel (Abmessungen in cm)
  width?: number;
  height?: number;

  // Leerrohr / Kabelkanal
  conduitType?: string;
  fillPercent?: number;

  // Wasser
  volumeLiters?: number;
  status?: 'normal' | 'warning';
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
  // Routing V2: geführte orthogonale Punktfolge (flaches x,y-Paar-Array) + Lane
  routedPath?: number[];
  lane?: number;
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
