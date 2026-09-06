import { create } from 'zustand';
import { getLayoutedElements } from '../lib/planner/layout';
import { initialNodes, initialEdges } from '../lib/planner/initialGraph';
import {
  validateSchematic,
  type VDEValidationResult,
} from '../lib/vde-standards';
import { planAutoWiring } from '../lib/planner/autoWire';
import { calculateBom } from '../lib/planner/bom';
import { createPlannerNode } from '../lib/planner/nodeFactory';
import {
  addPlannerEdge,
  applyPlannerEdgeChanges,
  applyPlannerNodeChanges,
  type FlowEdgeChange,
  type FlowNodeChange,
  type FlowSelectionChangeParams,
} from '../lib/planner/reactFlowAdapter';
import {
  createCableEdgeFromConnection,
  createWaterPipeEdgeFromConnection,
  isValidPlannerConnection,
  shouldWarnPumpToSink,
} from '../lib/planner/routing';
import type {
  CablePlannerEdge,
  FitViewCallback,
  PlannerConnection,
  PlannerEdge,
  PlannerNode,
  TapHandle,
  ViewMode,
  WaterPlannerEdge,
} from '../lib/planner/domain';

type ScreenToFlowPosition = (client: { x: number; y: number }) => { x: number; y: number };

type PlannerDropEvent = {
  preventDefault: () => void;
  dataTransfer: { getData: (format: string) => string };
  clientX: number;
  clientY: number;
};

interface PlannerState {
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
   * Live-VDE-Validierungsergebnisse für den aktuellen Schaltplan.
   * Wird automatisch bei jeder Änderung der nodes/edges neu berechnet.
   * So kann das UI jederzeit Warnungen anzeigen, ohne selbst rechnen zu müssen.
   */
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

function nextPlannerId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  return typeof randomUUID === 'function'
    ? randomUUID.call(globalThis.crypto)
    : `planner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notifyWaterWarning(get: () => PlannerState): void {
  get().setWaterWarning('Ein Accumulator schont die Pumpe und verhindert stotternden Wasserfluss.');
  setTimeout(() => get().setWaterWarning(null), 5000);
}

function fitViewOnNextFrame(fitView?: FitViewCallback): void {
  if (!fitView || typeof window === 'undefined') return;

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      fitView({ duration: 800 });
    });
    return;
  }

  fitView({ duration: 800 });
}

export type { PlannerState };

export const usePlannerStore = create<PlannerState>((set, get) => ({
  viewMode: 'electric',
  setViewMode: (mode) => set({ viewMode: mode }),

  nodes: initialNodes,
  edges: initialEdges,
  setNodes: (update) => {
    const newNodes = typeof update === 'function' ? update(get().nodes) : update;
    set({
      nodes: newNodes,
      vdeValidationResults: validateSchematic(newNodes, get().edges),
    });
  },
  setEdges: (update) => {
    const newEdges = typeof update === 'function' ? update(get().edges) : update;
    set({
      edges: newEdges,
      vdeValidationResults: validateSchematic(get().nodes, newEdges),
    });
  },

  waterNodes: [],
  waterEdges: [],
  setWaterNodes: (update) => set({ waterNodes: typeof update === 'function' ? update(get().waterNodes) : update }),
  setWaterEdges: (update) => set({ waterEdges: typeof update === 'function' ? update(get().waterEdges) : update }),

  season: 'summer',
  setSeason: (season) => set({ season }),

  waterWarning: null,
  setWaterWarning: (warning) => set({ waterWarning: warning }),

  firstTappedHandle: null,
  setFirstTappedHandle: (update) => set({ firstTappedHandle: typeof update === 'function' ? update(get().firstTappedHandle) : update }),

  selectedNodes: [],
  selectedEdges: [],
  setSelectedNodes: (nodes) => set({ selectedNodes: nodes }),
  setSelectedEdges: (edges) => set({ selectedEdges: edges }),

  // VDE-Validierung wird bei jeder State-Änderung automatisch neu berechnet
  vdeValidationResults: validateSchematic(initialNodes, initialEdges),
  hasVdeErrors: () => get().vdeValidationResults.some((result) => result.severity === 'error'),

  onNodesChange: (changes) => set((state) => {
    const nodes = applyPlannerNodeChanges(changes, state.nodes);
    return {
      nodes,
      vdeValidationResults: validateSchematic(nodes, state.edges),
    };
  }),
  onEdgesChange: (changes) => set((state) => {
    const edges = applyPlannerEdgeChanges(changes, state.edges);
    return {
      edges,
      vdeValidationResults: validateSchematic(state.nodes, edges),
    };
  }),
  onWaterNodesChange: (changes) => set((state) => ({
    waterNodes: applyPlannerNodeChanges(changes, state.waterNodes),
  })),
  onWaterEdgesChange: (changes) => set((state) => ({
    waterEdges: applyPlannerEdgeChanges(changes, state.waterEdges),
  })),

  onSelectionChange: (params) => set({
    selectedNodes: params.nodes as PlannerNode[],
    selectedEdges: params.edges as PlannerEdge[],
  }),

  deleteSelected: () => set((state) => {
    const nodeIdsSet = new Set(state.selectedNodes.map((node) => node.id));
    const edgeIdsSet = new Set(state.selectedEdges.map((edge) => edge.id));

    const nodes = state.nodes.filter((node) => !nodeIdsSet.has(node.id));
    const edges = state.edges.filter(
      (edge) => !nodeIdsSet.has(edge.source) && !nodeIdsSet.has(edge.target) && !edgeIdsSet.has(edge.id)
    );

    return {
      nodes,
      edges,
      selectedNodes: [],
      selectedEdges: [],
      vdeValidationResults: validateSchematic(nodes, edges),
    };
  }),

  updateNodeData: (id, data) => set((state) => {
    const nodes = state.nodes.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    });
    return {
      nodes,
      vdeValidationResults: validateSchematic(nodes, state.edges),
    };
  }),

  handleChangeLength: (id, length) => set((state) => {
    const edges = state.edges.map((edge) => {
      if (edge.id === id) {
        return { ...edge, data: { ...edge.data!, length } };
      }
      return edge;
    });
    return {
      edges,
      vdeValidationResults: validateSchematic(state.nodes, edges),
    };
  }),

  isValidConnection: (connection) => {
    const { nodes, waterNodes, viewMode, edges } = get();
    return isValidPlannerConnection({
      connection,
      viewMode,
      nodes,
      waterNodes,
      edges,
    });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;

    const { viewMode, waterNodes } = get();

    if (viewMode === 'water') {
      const sourceNode = waterNodes.find((node) => node.id === connection.source);
      const targetNode = waterNodes.find((node) => node.id === connection.target);

      if (shouldWarnPumpToSink(sourceNode, targetNode)) {
        notifyWaterWarning(get);
      }

      const newEdge = createWaterPipeEdgeFromConnection(connection, nextPlannerId());
      if (!newEdge) return;

      set((state) => ({ waterEdges: addPlannerEdge(newEdge, state.waterEdges) }));
      return;
    }

    const newEdge = createCableEdgeFromConnection(connection, nextPlannerId());
    if (!newEdge) return;

    set((state) => {
      const edges = addPlannerEdge(newEdge, state.edges);
      return {
        edges,
        vdeValidationResults: validateSchematic(state.nodes, edges),
      };
    });
  },

  autoWireSystem: (fitView) => {
    const { nodes } = get();
    const result = planAutoWiring(nodes, { idFactory: nextPlannerId });

    if (!result.ok) {
      if (typeof window !== 'undefined') {
        window.alert(result.message);
      }
      return;
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      result.nodes,
      result.edges,
      'LR'
    );

    const finalNodes = [...layoutedNodes];
    const finalEdges = [...layoutedEdges];
    set({
      nodes: finalNodes,
      edges: finalEdges,
      vdeValidationResults: validateSchematic(finalNodes, finalEdges),
    });

    fitViewOnNextFrame(fitView);
  },

  onLayout: (fitView) => {
    const { nodes, edges } = get();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      'LR'
    );
    const finalNodes = [...layoutedNodes];
    const finalEdges = [...layoutedEdges];
    set({
      nodes: finalNodes,
      edges: finalEdges,
      vdeValidationResults: validateSchematic(finalNodes, finalEdges),
    });

    fitViewOnNextFrame(fitView);
  },

  checkSchematic: () => {
    const { nodes, edges } = get();
    const schematic = { nodes, edges };
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('check-schematic', { detail: schematic });
      window.dispatchEvent(event);
    }
  },

  exportBOM: () => {
    const { nodes, edges } = get();
    const bom = calculateBom(nodes, edges);

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('export-bom', { detail: bom });
      window.dispatchEvent(event);
    }
  },

  onDrop: (event, screenToFlowPosition) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    const label = event.dataTransfer.getData('application/reactflow-label');

    if (typeof type === 'undefined' || !type) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = createPlannerNode({
      id: nextPlannerId(),
      type,
      label,
      position,
    });

    const { viewMode } = get();
    if (viewMode === 'water') {
      set((state) => ({ waterNodes: state.waterNodes.concat(newNode) }));
    } else {
      set((state) => {
        const nodes = state.nodes.concat(newNode);
        return {
          nodes,
          vdeValidationResults: validateSchematic(nodes, state.edges),
        };
      });
    }
  },

  onCustomDrop: (event, screenToFlowPosition) => {
    const customEvent = event as CustomEvent;
    const { clientX, clientY, type, label } = customEvent.detail;

    const position = screenToFlowPosition({
      x: clientX,
      y: clientY,
    });

    const newNode = createPlannerNode({
      id: nextPlannerId(),
      type,
      label,
      position,
    });

    const { viewMode } = get();
    if (viewMode === 'water') {
      set((state) => ({ waterNodes: state.waterNodes.concat(newNode) }));
    } else {
      set((state) => {
        const nodes = state.nodes.concat(newNode);
        return {
          nodes,
          vdeValidationResults: validateSchematic(nodes, state.edges),
        };
      });
    }
  },

  handleChangeCrossSection: (id, crossSection) => set((state) => {
    const edges = state.edges.map((edge) => {
      if (edge.id === id) {
        return { ...edge, data: { ...edge.data!, crossSection } };
      }
      return edge;
    });
    return {
      edges,
      vdeValidationResults: validateSchematic(state.nodes, edges),
    };
  }),
}));
