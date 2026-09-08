import { type Edge, type Connection } from '@xyflow/react';
import type { Volts } from '../../lib/units';
import { type CableEdgeData } from '../../components/edges/CableEdge';
import { type NodeDataPatch, type PlannerFlowNode } from '../../components/nodes/types';
import { type WaterPipeEdgeData } from '../../components/edges/WaterPipeEdge';

export type { PlannerFlowNode };

/** Wasserleitung mit ihrer Datenform (Rohrtyp, Länge). */
export type PlannerWaterEdge = Edge<WaterPipeEdgeData>;

export type GraphSnapshot = {
  nodes: PlannerFlowNode[];
  edges: Edge<CableEdgeData>[];
  waterNodes: PlannerFlowNode[];
  waterEdges: PlannerWaterEdge[];
};

/**
 * Ergebnis der ELK-Layout-Action (ADR 0018). `elk`/`dagre` melden die
 * tatsächlich gelaufene Engine; `empty` (kein Bauteil), `stale` (neuere
 * Anfrage hat gewonnen) und `error` (beide Engines gescheitert) sind die
 * ehrlichen Verweigerungen — das UI sagt aus, was passiert ist.
 */
export type LayoutV2Outcome =
  { applied: true; engine: 'elk' | 'dagre' } | { applied: false; reason: 'empty' | 'stale' | 'error' };

export interface PlannerState {
  viewMode: 'electric' | 'water';
  setViewMode: (mode: 'electric' | 'water') => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;

  isInspectorOpen: boolean;
  setInspectorOpen: (isOpen: boolean) => void;
  toggleInspector: () => void;

  systemMessage: string | null;
  setSystemMessage: (msg: string | null) => void;

  nodes: PlannerFlowNode[];
  edges: Edge<CableEdgeData>[];
  setNodes: (nodes: PlannerFlowNode[] | ((nds: PlannerFlowNode[]) => PlannerFlowNode[])) => void;
  setEdges: (edges: Edge<CableEdgeData>[] | ((eds: Edge<CableEdgeData>[]) => Edge<CableEdgeData>[])) => void;

  waterNodes: PlannerFlowNode[];
  waterEdges: PlannerWaterEdge[];
  setWaterNodes: (nodes: PlannerFlowNode[] | ((nds: PlannerFlowNode[]) => PlannerFlowNode[])) => void;
  setWaterEdges: (edges: PlannerWaterEdge[] | ((eds: PlannerWaterEdge[]) => PlannerWaterEdge[])) => void;

  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;

  waterWarning: string | null;
  setWaterWarning: (warning: string | null) => void;

  firstTappedHandle: { nodeId: string; handleId: string; handleType: string } | null;
  setFirstTappedHandle: (
    handle:
      | { nodeId: string; handleId: string; handleType: string }
      | null
      | ((
          prev: { nodeId: string; handleId: string; handleType: string } | null
        ) => { nodeId: string; handleId: string; handleType: string } | null)
  ) => void;

  selectedNodes: PlannerFlowNode[];
  selectedEdges: Edge[];
  setSelectedNodes: (nodes: PlannerFlowNode[]) => void;
  setSelectedEdges: (edges: Edge[]) => void;

  highlightedNodeId: string | null;
  highlightedEdgeId: string | null;
  setHighlightedNodeId: (id: string | null) => void;
  setHighlightedEdgeId: (id: string | null) => void;

  trunkMode: boolean;
  setTrunkMode: (enabled: boolean) => void;
  backboneGrouping: boolean;
  setBackboneGrouping: (enabled: boolean) => void;

  onNodesChange: (changes: import('@xyflow/react').NodeChange[]) => void;
  onEdgesChange: (changes: import('@xyflow/react').EdgeChange[]) => void;
  onWaterNodesChange: (changes: import('@xyflow/react').NodeChange[]) => void;
  onWaterEdgesChange: (changes: import('@xyflow/react').EdgeChange[]) => void;
  onSelectionChange: (params: import('@xyflow/react').OnSelectionChangeParams) => void;
  focusElement: (id: string, elementType: 'node' | 'edge') => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, data: NodeDataPatch) => void;
  handleChangeLength: (id: string, length: number) => void;
  handleChangeFuseSize: (id: string, fuseSize: number) => void;
  handleChangeFuseType: (id: string, fuseType: string | undefined) => void;
  /**
   * AUDIT DOM-001: AC-Schutzorgan an einer AC-Kante ändern
   * (Bauform/Charakteristik/Abschaltvermögen nach IEC 60898-1).
   * `undefined` setzt das Feld zurück (kein Stempel mehr).
   */
  handleChangeAcProtection: (id: string, acProtection: CableEdgeData['acProtection']) => void;
  /**
   * AUDIT ELE-004: Position der Sicherung entlang der Kante in Metern ab
   * Batteriepol — Grundlage der 20-cm-Regel in collectEdgeErrors.
   */
  handleChangeFuseOffset: (id: string, fuseOffset: number) => void;

  /**
   * v12: React Flow prüft mit `IsValidConnection<EdgeType>` — der Callback
   * bekommt beim Verschieben eines Kantenendes die bestehende Kante statt
   * einer reinen `Connection`. Beide Formen tragen source/target/Handles.
   */
  isValidConnection: (connection: Connection | Edge<CableEdgeData>) => boolean;
  onConnect: (connection: Connection) => void;
  autoWireSystem: () => void;
  onLayout: () => void;
  /**
   * ELK-Layout (ADR 0018): globaler Layout-Pass für Knotenpositionen.
   * Ergebnis ist transparent — `engine` sagt, ob ELK gelaufen ist oder der
   * Dagre-Fallback; `applied: false` bei leerem Plan, veralteter Anfrage
   * (letzte Anfrage gewinnt) oder bei Versagen beider Engines.
   */
  onLayoutV2: () => Promise<LayoutV2Outcome>;
  onDrop: (
    event: React.DragEvent,
    screenToFlowPosition: (client: { x: number; y: number }) => { x: number; y: number }
  ) => void;
  onCustomDrop: (
    event: Event,
    screenToFlowPosition: (client: { x: number; y: number }) => { x: number; y: number }
  ) => void;
  addNode: (type: string, label: string, position: { x: number; y: number }, watts?: number) => void;
  applyTemplate: (templateId: string) => void;
  /**
   * Kumulierter Spannungsfall bis zu einem Knoten — in Volt (typsicher).
   * Aufrufer, die weiterhin mit `number` rechnen, funktionieren unverändert,
   * weil `Volts` zur Laufzeit eine Zahl ist.
   */
  calculatePathVoltageDrop: (
    targetNodeId: string,
    customNodes?: PlannerFlowNode[],
    customEdges?: Edge<CableEdgeData>[]
  ) => Volts;
  isLayoutPending: boolean;
  setIsLayoutPending: (pending: boolean) => void;

  historyPast: GraphSnapshot[];
  historyFuture: GraphSnapshot[];
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearPlan: () => void;
}

/**
 * State-Creator mit persist-Middleware, der einen Slice beiträgt.
 */
export type PlannerSlice<T> = import('zustand').StateCreator<
  PlannerState,
  [['zustand/persist', unknown]],
  [],
  T
>;
