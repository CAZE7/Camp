/**
 * store/planner/types.ts
 *
 * Gemeinsame Typen für die getrennten Planner-Store-Slices.
 *
 * Die große `usePlannerStore.ts` (429 Zeilen) bündelte State, Actions,
 * AutoWire, Layout, BOM, Node-Erstellung und Persistenz/History. Diese Typen
 * definieren den öffentlichen Store-Vertrag, den die Slices gemeinsam
 * erfüllen — unverändert gegenüber dem bisherigen Store.
 */

import type {
  CablePlannerEdge,
  FitViewCallback,
  PlannerConnection,
  PlannerEdge,
  PlannerNode,
  TapHandle,
  ViewMode,
  WaterPlannerEdge,
} from '../../lib/planner/domain';
import type {
  FlowEdgeChange,
  FlowNodeChange,
  FlowSelectionChangeParams,
} from '../../lib/planner/reactFlowAdapter';
import type { VDEValidationResult } from '../../lib/planner/electrical';

export type ScreenToFlowPosition = (client: { x: number; y: number }) => { x: number; y: number };

export type PlannerDropEvent = {
  preventDefault: () => void;
  dataTransfer: { getData: (format: string) => string };
  clientX: number;
  clientY: number;
};

/** Der vollständige öffentliche Zustand des Planner-Stores. */
export interface PlannerState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  nodes: PlannerNode[];
  edges: CablePlannerEdge[];
  setNodes: (nodes: PlannerNode[] | ((nds: PlannerNode[]) => PlannerNode[])) => void;
  setEdges: (edges: CablePlannerEdge[] | ((eds: CablePlannerEdge[]) => CablePlannerEdge[])) => void;

  waterNodes: PlannerNode[];
  waterEdges: WaterPlannerEdge[];
  setWaterNodes: (nodes: PlannerNode[] | ((nds: PlannerNode[]) => PlannerNode[])) => void;
  setWaterEdges: (edges: WaterPlannerEdge[] | ((eds: WaterPlannerEdge[]) => WaterPlannerEdge[])) => void;

  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;

  waterWarning: string | null;
  setWaterWarning: (warning: string | null) => void;

  firstTappedHandle: TapHandle | null;
  setFirstTappedHandle: (handle: TapHandle | null | ((prev: TapHandle | null) => TapHandle | null)) => void;

  selectedNodes: PlannerNode[];
  selectedEdges: PlannerEdge[];
  setSelectedNodes: (nodes: PlannerNode[]) => void;
  setSelectedEdges: (edges: PlannerEdge[]) => void;

  /**
   * Auto-Wire-verwaltete Komponenten (Sammelschiene/Sicherungskasten/Shunt),
   * die der Nutzer manuell entfernt hat. Auto-Wire legt diese dann nicht
   * erneut an. Wird automatisch gepflegt, sobald eine solche Komponente über
   * deleteSelected oder onNodesChange gelöscht wird.
   */
  removedAutoComponents: string[];
  markAutoComponentsRemoved: (types: string[]) => void;

  /** Live-VDE-Validierungsergebnisse für den aktuellen Schaltplan. */
  vdeValidationResults: VDEValidationResult[];
  /** Convenience: gibt es kritische Fehler? */
  hasVdeErrors: () => boolean;

  onNodesChange: (changes: FlowNodeChange[]) => void;
  onEdgesChange: (changes: FlowEdgeChange[]) => void;
  onWaterNodesChange: (changes: FlowNodeChange[]) => void;
  onWaterEdgesChange: (changes: FlowEdgeChange[]) => void;
  onSelectionChange: (params: FlowSelectionChangeParams) => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, data: any) => void;
  handleChangeLength: (id: string, length: number) => void;
  handleChangeCrossSection: (id: string, crossSection: number) => void;

  isValidConnection: (connection: PlannerConnection) => boolean;
  onConnect: (connection: PlannerConnection) => void;

  autoWireSystem: (fitView?: FitViewCallback) => void;
  onLayout: (fitView?: FitViewCallback) => void;
  checkSchematic: () => void;
  exportBOM: () => void;

  onDrop: (event: PlannerDropEvent, screenToFlowPosition: ScreenToFlowPosition) => void;
  onCustomDrop: (event: Event, screenToFlowPosition: ScreenToFlowPosition) => void;
}

/** Setzt Zustand — unterstützt Objekt- und Updater-Form (wie zustand). */
export type SetState = (
  partial: Partial<PlannerState> | ((state: PlannerState) => Partial<PlannerState>)
) => void;

/** Ein Store-Slice: Teilt der Zustand+Actions bei, die er beisteuert. */
export type PlannerSlice<T = Partial<PlannerState>> = (
  set: SetState,
  get: () => PlannerState
) => T;

// ============================================================================
// Präzise, nicht-optionale Slice-Rückgabetypen.
//
// Statt `Partial<PlannerState>` (bei dem jedes Feld optional ist und ein
// `as PlannerState`-Cast die Unvollständigkeit verschleiern würde), liefert
// jeder Slice exakt die Felder, für die er zuständig ist — als `Pick`, also
// NICHT optional. Die Komposition im Store ist damit typischerweise vollständig.
// ============================================================================

/** State + direkte Mutations-Helfer (Basis). */
export type BaseSliceState = Pick<
  PlannerState,
  | 'viewMode'
  | 'setViewMode'
  | 'nodes'
  | 'edges'
  | 'setNodes'
  | 'setEdges'
  | 'waterNodes'
  | 'waterEdges'
  | 'setWaterNodes'
  | 'setWaterEdges'
  | 'season'
  | 'setSeason'
  | 'waterWarning'
  | 'setWaterWarning'
  | 'firstTappedHandle'
  | 'setFirstTappedHandle'
  | 'selectedNodes'
  | 'selectedEdges'
  | 'setSelectedNodes'
  | 'setSelectedEdges'
  | 'removedAutoComponents'
  | 'markAutoComponentsRemoved'
  | 'vdeValidationResults'
  | 'hasVdeErrors'
  | 'onNodesChange'
  | 'onEdgesChange'
  | 'onWaterNodesChange'
  | 'onWaterEdgesChange'
  | 'onSelectionChange'
  | 'deleteSelected'
  | 'updateNodeData'
  | 'handleChangeLength'
  | 'handleChangeCrossSection'
>;

/** Verbindungen, Drag&Drop und Knoten-Erstellung. */
export type ConnectionSliceState = Pick<
  PlannerState,
  'isValidConnection' | 'onConnect' | 'onDrop' | 'onCustomDrop'
>;

/** AutoWire. */
export type AutoWireSliceState = Pick<PlannerState, 'autoWireSystem'>;

/** Layout. */
export type LayoutSliceState = Pick<PlannerState, 'onLayout'>;

/** BOM / Berichte. */
export type BomSliceState = Pick<PlannerState, 'checkSchematic' | 'exportBOM'>;
