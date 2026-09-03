import { type Node, type Edge, type Connection } from 'reactflow';
import type { Volts } from '../../lib/units';
import { type CableEdgeData } from '../../components/edges/CableEdge';
import { type NodeDataPatch } from '../../components/nodes/types';

export type GraphSnapshot = {
  nodes: Node[];
  edges: Edge<CableEdgeData>[];
  waterNodes: Node[];
  waterEdges: Edge[];
};

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

  nodes: Node[];
  edges: Edge<CableEdgeData>[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge<CableEdgeData>[] | ((eds: Edge<CableEdgeData>[]) => Edge<CableEdgeData>[])) => void;

  waterNodes: Node[];
  waterEdges: Edge[];
  setWaterNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setWaterEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;

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

  selectedNodes: Node[];
  selectedEdges: Edge[];
  setSelectedNodes: (nodes: Node[]) => void;
  setSelectedEdges: (edges: Edge[]) => void;

  highlightedNodeId: string | null;
  highlightedEdgeId: string | null;
  setHighlightedNodeId: (id: string | null) => void;
  setHighlightedEdgeId: (id: string | null) => void;

  trunkMode: boolean;
  setTrunkMode: (enabled: boolean) => void;
  backboneGrouping: boolean;
  setBackboneGrouping: (enabled: boolean) => void;

  onNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onWaterNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onWaterEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onSelectionChange: (params: import('reactflow').OnSelectionChangeParams) => void;
  focusElement: (id: string, elementType: 'node' | 'edge') => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, data: NodeDataPatch) => void;
  handleChangeLength: (id: string, length: number) => void;
  handleChangeFuseSize: (id: string, fuseSize: number) => void;

  isValidConnection: (connection: Connection) => boolean;
  onConnect: (connection: Connection) => void;
  autoWireSystem: () => void;
  onLayout: () => void;
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
  calculatePathVoltageDrop: (targetNodeId: string, customNodes?: Node[], customEdges?: Edge[]) => Volts;
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
