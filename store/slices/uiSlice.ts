import type { PlannerSlice, PlannerState } from './types';

/**
 * UI-Slice: alles, was die Anordnung/Oberfläche des Planers beschreibt —
 * Modus, Panel-Offen-Zustände, Saison, Hinweismeldungen, Selektion und
 * Anzeigeschalter. Bewusst frei von Graphmutationen; die Selektions-Setter
 * schreiben nur Flagnamen des Graph-Slices fort.
 */
export type UiSlice = Pick<
  PlannerState,
  | 'viewMode'
  | 'setViewMode'
  | 'isSidebarOpen'
  | 'setSidebarOpen'
  | 'toggleSidebar'
  | 'isInspectorOpen'
  | 'setInspectorOpen'
  | 'toggleInspector'
  | 'systemMessage'
  | 'setSystemMessage'
  | 'season'
  | 'setSeason'
  | 'waterWarning'
  | 'setWaterWarning'
  | 'firstTappedHandle'
  | 'setFirstTappedHandle'
  | 'isLayoutPending'
  | 'setIsLayoutPending'
  | 'selectedNodes'
  | 'selectedEdges'
  | 'setSelectedNodes'
  | 'setSelectedEdges'
  | 'highlightedNodeId'
  | 'highlightedEdgeId'
  | 'setHighlightedNodeId'
  | 'setHighlightedEdgeId'
  | 'trunkMode'
  | 'setTrunkMode'
  | 'backboneGrouping'
  | 'setBackboneGrouping'
>;

export const createUiSlice: PlannerSlice<UiSlice> = (set, get) => ({
  viewMode: 'electric',
  setViewMode: (mode) =>
    set((state) => ({
      viewMode: mode,
      selectedNodes: [],
      selectedEdges: [],
      firstTappedHandle: null,
      nodes: state.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
      edges: state.edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
      waterNodes: state.waterNodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
      waterEdges: state.waterEdges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
    })),
  isSidebarOpen: true,
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  // Standardmäßig sichtbar: ab 1280 px ist der Inspector die dritte Spalte des
  // festen Desktop-Layouts. Auf Tablet/Handy steuert das Layout selbst, ob
  // daraus ein Slide-over oder ein Tab wird.
  isInspectorOpen: true,
  setInspectorOpen: (isOpen) => set({ isInspectorOpen: isOpen }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  systemMessage: null,
  setSystemMessage: (msg) => set({ systemMessage: msg }),
  season: 'summer',
  setSeason: (season) => set({ season }),
  waterWarning: null,
  setWaterWarning: (warning) => set({ waterWarning: warning }),
  firstTappedHandle: null,
  setFirstTappedHandle: (update) =>
    set({ firstTappedHandle: typeof update === 'function' ? update(get().firstTappedHandle) : update }),
  isLayoutPending: false,
  setIsLayoutPending: (pending) => set({ isLayoutPending: pending }),
  selectedNodes: [],
  selectedEdges: [],
  setSelectedNodes: (nodes) => set({ selectedNodes: nodes }),
  setSelectedEdges: (edges) => set({ selectedEdges: edges }),
  highlightedNodeId: null,
  highlightedEdgeId: null,
  setHighlightedNodeId: (id) => set({ highlightedNodeId: id }),
  setHighlightedEdgeId: (id) => set({ highlightedEdgeId: id }),
  trunkMode: false,
  setTrunkMode: (enabled) => set({ trunkMode: enabled }),
  backboneGrouping: true,
  setBackboneGrouping: (enabled) => set({ backboneGrouping: enabled }),
});
