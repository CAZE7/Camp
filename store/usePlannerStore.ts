import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { getLayoutedElements } from '../components/planner/utils/layout';
import React from 'react';
import { Node, Edge, Connection } from 'reactflow';
import { CableEdgeData } from '../components/edges/CableEdge';
import { PlannerNodeData } from '../components/nodes/types';

type GraphSnapshot = {
  nodes: Node[];
  edges: Edge<CableEdgeData>[];
  waterNodes: Node[];
  waterEdges: Edge[];
};

interface PlannerState {
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

  firstTappedHandle: { nodeId: string, handleId: string, handleType: string } | null;
  setFirstTappedHandle: (handle: { nodeId: string, handleId: string, handleType: string } | null | ((prev: { nodeId: string, handleId: string, handleType: string } | null) => { nodeId: string, handleId: string, handleType: string } | null)) => void;

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

  onNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onWaterNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onWaterEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onSelectionChange: (params: import('reactflow').OnSelectionChangeParams) => void;
  focusElement: (id: string, elementType: 'node' | 'edge') => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, data: Partial<PlannerNodeData>) => void;
  handleChangeLength: (id: string, length: number) => void;
  handleChangeCrossSection: (id: string, crossSection: number) => void;
  handleChangeFuseSize: (id: string, fuseSize: number) => void;

  isValidConnection: (connection: Connection) => boolean;
  onConnect: (connection: Connection) => void;
  autoWireSystem: () => void;
  onLayout: () => void;
  checkSchematic: () => void;
  exportBOM: () => void;
  onDrop: (event: React.DragEvent, screenToFlowPosition: (client: {x: number, y: number}) => {x: number, y: number}) => void;
  onCustomDrop: (event: Event, screenToFlowPosition: (client: {x: number, y: number}) => {x: number, y: number}) => void;
  addNode: (type: string, label: string, position: {x: number, y: number}, watts?: number) => void;
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

import { TEMPLATES_DICT } from '../components/planner/templates';
import { getEdgeDomain, getHandleDomain } from '../lib/electrical';
import { getSystemVoltage } from '../lib/vde-standards';
import type { Volts } from '../lib/units';
import { performAutoWiring, relevantCumulativeDrop } from '../lib/autoWire';

const nodesMapCache = new WeakMap<Node[], Map<string, Node>>();
const waterNodesMapCache = new WeakMap<Node[], Map<string, Node>>();
const totalWattsCache = new WeakMap<Node[], number>();

export function getDerivedSystemState(nodes: Node[], waterNodes: Node[]) {
  let nodesMap = nodesMapCache.get(nodes);
  let totalWatts = totalWattsCache.get(nodes);

  if (!nodesMap || totalWatts === undefined) {
    nodesMap = new Map();
    totalWatts = 0;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      nodesMap.set(n.id, n);
      if (n.type === 'consumer' || n.type === 'consumer230v' || n.type === 'inverter') {
        totalWatts += (Number(n.data.watts) || 0);
      }
    }
    nodesMapCache.set(nodes, nodesMap);
    totalWattsCache.set(nodes, totalWatts);
  }

  let waterNodesMap = waterNodesMapCache.get(waterNodes);
  if (!waterNodesMap) {
    waterNodesMap = new Map();
    for (let i = 0; i < waterNodes.length; i++) {
      const n = waterNodes[i];
      waterNodesMap.set(n.id, n);
    }
    waterNodesMapCache.set(waterNodes, waterNodesMap);
  }

  return { nodesMap, waterNodesMap, totalWatts };
}

function getNodeMap(currentNodes: Node[], currentWaterNodes: Node[]): Map<string, Node> {
  const { nodesMap, waterNodesMap } = getDerivedSystemState(currentNodes, currentWaterNodes);
  const combined = new Map(nodesMap);
  waterNodesMap.forEach((node, id) => combined.set(id, node));
  return combined;
}

const PLANNER_STORAGE_VERSION = 1;

/**
 * Defensive Migration für den Planner-Store. Alte localStorage-Stände können
 * Felder in anderem Shape oder teilkorrupte Knoten/Kanten enthalten. Diese
 * Funktion normalisiert, bevor Zustand den Stand merged — so lösen veraltete
 * Stände keine Laufzeitfehler in Berechnungen aus.
 */
function isNodeArray(value: unknown): value is Node[] {
  return Array.isArray(value) && value.every((n) => n && typeof n === 'object' && 'id' in n && 'position' in n);
}

function isEdgeArray(value: unknown): value is Edge[] {
  return Array.isArray(value) && value.every((e) => e && typeof e === 'object' && 'id' in e && 'source' in e && 'target' in e);
}

function migratePlannerPersisted(persisted: unknown, version: number): Partial<PlannerState> {
  const p = (persisted ?? {}) as Partial<PlannerState>;
  const safe: Partial<PlannerState> = {};

  if (p.viewMode === 'electric' || p.viewMode === 'water') safe.viewMode = p.viewMode;
  if (p.season === 'summer' || p.season === 'winter') safe.season = p.season;
  if (typeof p.isSidebarOpen === 'boolean') safe.isSidebarOpen = p.isSidebarOpen;
  if (typeof p.isInspectorOpen === 'boolean') safe.isInspectorOpen = p.isInspectorOpen;
  if (isNodeArray(p.nodes)) safe.nodes = p.nodes;
  if (isEdgeArray(p.edges)) safe.edges = p.edges as Edge<CableEdgeData>[];
  if (isNodeArray(p.waterNodes)) safe.waterNodes = p.waterNodes;
  if (isEdgeArray(p.waterEdges)) safe.waterEdges = p.waterEdges;

  // Version 0 → 1: keine Feldumbenennungen, nur Validierung.
  void version;
  return safe;
}

const HISTORY_LIMIT = 50;

function graphSnapshot(state: Pick<PlannerState, 'nodes' | 'edges' | 'waterNodes' | 'waterEdges'>): GraphSnapshot {
  return {
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
  };
}

function withHistory<T extends Partial<PlannerState>>(state: PlannerState, update: T): T & Pick<PlannerState, 'historyPast' | 'historyFuture' | 'canUndo' | 'canRedo'> {
  return {
    ...update,
    historyPast: [...state.historyPast.slice(-(HISTORY_LIMIT - 1)), graphSnapshot(state)],
    historyFuture: [],
    canUndo: true,
    canRedo: false,
  };
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
  viewMode: 'electric',
  setViewMode: (mode) => set((state) => ({
    viewMode: mode,
    selectedNodes: [],
    selectedEdges: [],
    firstTappedHandle: null,
    nodes: state.nodes.map((node) => node.selected ? { ...node, selected: false } : node),
    edges: state.edges.map((edge) => edge.selected ? { ...edge, selected: false } : edge),
    waterNodes: state.waterNodes.map((node) => node.selected ? { ...node, selected: false } : node),
    waterEdges: state.waterEdges.map((edge) => edge.selected ? { ...edge, selected: false } : edge),
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

  nodes: [],
  edges: [],
  setNodes: (update) => set((state) => withHistory(state, { nodes: typeof update === 'function' ? update(state.nodes) : update })),
  setEdges: (update) => set((state) => withHistory(state, { edges: typeof update === 'function' ? update(state.edges) : update })),

  waterNodes: [],
  waterEdges: [],
  setWaterNodes: (update) => set((state) => withHistory(state, { waterNodes: typeof update === 'function' ? update(state.waterNodes) : update })),
  setWaterEdges: (update) => set((state) => withHistory(state, { waterEdges: typeof update === 'function' ? update(state.waterEdges) : update })),

  season: 'summer',
  setSeason: (season) => set({ season }),

  waterWarning: null,
  setWaterWarning: (warning) => set({ waterWarning: warning }),

  firstTappedHandle: null,
  setFirstTappedHandle: (update) => set({ firstTappedHandle: typeof update === 'function' ? update(get().firstTappedHandle) : update }),

  isLayoutPending: false,
  setIsLayoutPending: (pending) => set({ isLayoutPending: pending }),

  historyPast: [],
  historyFuture: [],
  canUndo: false,
  canRedo: false,

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

  onNodesChange: (changes) => set((state) => {
    const newNodes = applyNodeChanges(changes, state.nodes);
    const deletedNodeIds = new Set<string>();
    for (const change of changes) {
      if (change.type === 'remove') deletedNodeIds.add(change.id);
    }
    if (deletedNodeIds.size > 0) {
      return withHistory(state, {
        nodes: newNodes,
        edges: state.edges.filter(e => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target))
      });
    }
    // Während des Ziehens nicht jeden Pixel als eigenen Undo-Schritt speichern.
    const shouldCheckpoint = changes.some((change) => change.type === 'remove' || (change.type === 'position' && !change.dragging));
    return shouldCheckpoint ? withHistory(state, { nodes: newNodes }) : { nodes: newNodes };
  }),
  onEdgesChange: (changes) => set((state) => {
    const nextEdges = applyEdgeChanges(changes, state.edges) as Edge<CableEdgeData>[];
    return changes.some((change) => change.type === 'remove') ? withHistory(state, { edges: nextEdges }) : { edges: nextEdges };
  }),
  onWaterNodesChange: (changes) => set((state) => {
    const newWaterNodes = applyNodeChanges(changes, state.waterNodes);
    const deletedNodeIds = new Set<string>();
    for (const change of changes) {
      if (change.type === 'remove') deletedNodeIds.add(change.id);
    }
    if (deletedNodeIds.size > 0) {
      return withHistory(state, {
        waterNodes: newWaterNodes,
        waterEdges: state.waterEdges.filter(e => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target))
      });
    }
    const shouldCheckpoint = changes.some((change) => change.type === 'remove' || (change.type === 'position' && !change.dragging));
    return shouldCheckpoint ? withHistory(state, { waterNodes: newWaterNodes }) : { waterNodes: newWaterNodes };
  }),
  onWaterEdgesChange: (changes) => set((state) => {
    const nextEdges = applyEdgeChanges(changes, state.waterEdges);
    return changes.some((change) => change.type === 'remove') ? withHistory(state, { waterEdges: nextEdges }) : { waterEdges: nextEdges };
  }),

  onSelectionChange: (params) => set({ selectedNodes: params.nodes, selectedEdges: params.edges }),

  // Fokussiert eine betroffene Komponente/Leitung ("Beheben" aus der Warn-Zentrale):
  // markiert sie als ausgewählt (ReactFlow-Highlight + Inspector) und passt die Ansicht ein.
  focusElement: (id, elementType) => {
    set((state) => {
      if (elementType === 'edge') {
        const edges = state.edges.map((e) => ({ ...e, selected: e.id === id }));
        const waterEdges = state.waterEdges.map((e) => ({ ...e, selected: e.id === id }));
        const nodes = state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
        const target = edges.find((e) => e.id === id) || waterEdges.find((e) => e.id === id) || null;
        return {
          edges,
          waterEdges,
          nodes,
          selectedEdges: target ? [target] : [],
          selectedNodes: [],
        };
      }
      const nodes = state.nodes.map((n) => ({ ...n, selected: n.id === id }));
      const waterNodes = state.waterNodes.map((n) => ({ ...n, selected: n.id === id }));
      const edges = state.edges.map((e) => (e.selected ? { ...e, selected: false } : e));
      const target = nodes.find((n) => n.id === id) || waterNodes.find((n) => n.id === id) || null;
      return {
        nodes,
        waterNodes,
        edges,
        selectedNodes: target ? [target] : [],
        selectedEdges: [],
      };
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('planner-focus-element', { detail: { id, elementType } }));
    }
  },

  deleteSelected: () => set((state) => {
    const nodeIdsSet = new Set<string>();
    const selectedNodesLen = state.selectedNodes.length;
    for (let i = 0; i < selectedNodesLen; i++) {
      nodeIdsSet.add(state.selectedNodes[i].id);
    }

    const edgeIdsSet = new Set<string>();
    const selectedEdgesLen = state.selectedEdges.length;
    for (let i = 0; i < selectedEdgesLen; i++) {
      edgeIdsSet.add(state.selectedEdges[i].id);
    }

    const filterNode = (n: Node) => !nodeIdsSet.has(n.id);
    const filterEdge = (e: Edge) => !nodeIdsSet.has(e.source) && !nodeIdsSet.has(e.target) && !edgeIdsSet.has(e.id);

    return withHistory(state, {
      nodes: state.nodes.filter(filterNode),
      edges: state.edges.filter(filterEdge),
      waterNodes: state.waterNodes.filter(filterNode),
      waterEdges: state.waterEdges.filter(filterEdge),
      selectedNodes: [],
      selectedEdges: [],
    });
  }),

  updateNodeData: (id, data) => set((state) => withHistory(state, {
    nodes: state.nodes.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    }),
    waterNodes: state.waterNodes.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    })
  })),

  handleChangeLength: (id, length) => set((state) => withHistory(state, {
    edges: state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, length } };
      }
      return e;
    }),
    waterEdges: state.waterEdges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, length } };
      }
      return e;
    })
  })),

  isValidConnection: (connection) => {
    const { nodes, waterNodes, viewMode, edges } = get();
    const allNodes = [...nodes, ...waterNodes];

    // Create a node map for O(1) lookups
    const { nodesMap } = getDerivedSystemState(allNodes, []);

    const sourceNode = nodesMap.get(connection.source || '');
    const targetNode = nodesMap.get(connection.target || '');

    if (viewMode === 'water') {
      if (sourceNode?.type === 'grayWaterTank' && targetNode?.type === 'sink') {
        return false;
      }
    } else {
      // Strict AC vs. DC domain separation
      const sourceDomain = getHandleDomain(sourceNode?.type, connection.sourceHandle, 'source');
      const targetDomain = getHandleDomain(targetNode?.type, connection.targetHandle, 'target');
      if (sourceDomain !== targetDomain) {
        return false; // Blocker!
      }

      // Pre-check for polarity matching
      const sHandle = connection.sourceHandle || '';
      const tHandle = connection.targetHandle || '';

      const sIsPlus = sHandle.includes('plus');
      const tIsPlus = tHandle.includes('plus');
      const sIsMinus = sHandle.includes('minus');
      const tIsMinus = tHandle.includes('minus');

      // Exception for series connection between batteries or solars
      const isSeriesException =
        (sourceNode?.type === 'battery' && targetNode?.type === 'battery') ||
        (sourceNode?.type === 'solar' && targetNode?.type === 'solar');

      // AC uses L/N/PE, not plus/minus — skip DC polarity on AC-AC links
      if (sourceDomain !== 'AC_230V' && !isSeriesException) {
        if ((sIsPlus && !tIsPlus) || (sIsMinus && !tIsMinus)) {
          return false; // Polarity mismatch strict block
        }
      }
    }

    // Bereits vorhandene identische Verbindung nicht stillschweigend ignorieren.
    const activeEdges = viewMode === 'water' ? get().waterEdges : edges;
    const duplicate = activeEdges.some((edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
    );
    if (duplicate) return false;

    // Check for cycles
    // If there is already a path from the connection's target back to the connection's source,
    // adding this new edge will create a cycle.
    const outgoersMap = new Map<string, string[]>();

    const currentEdges = viewMode === 'water' ? get().waterEdges : edges;
    for (let i = 0; i < currentEdges.length; i++) {
      const edge = currentEdges[i];
      let targets = outgoersMap.get(edge.source);
      if (!targets) {
        targets = [];
        outgoersMap.set(edge.source, targets);
      }
      targets.push(edge.target);
    }

    const hasPath = (fromNode: string, toNode: string, visited = new Set<string>()): boolean => {
      if (fromNode === toNode) return true;
      if (visited.has(fromNode)) return false;
      visited.add(fromNode);
      const outgoers = outgoersMap.get(fromNode) || [];
      for (let i = 0; i < outgoers.length; i++) {
        if (hasPath(outgoers[i], toNode, visited)) return true;
      }
      return false;
    };

    if (connection.source && connection.target && hasPath(connection.target, connection.source)) {
      return false;
    }

    return true;
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;

    const { viewMode, waterNodes, nodes } = get();

    if (viewMode === 'water') {
      const { nodesMap, waterNodesMap } = getDerivedSystemState(nodes, waterNodes);
      const sourceNode = nodesMap.get(connection.source || '') || waterNodesMap.get(connection.source || '');
      const targetNode = nodesMap.get(connection.target || '') || waterNodesMap.get(connection.target || '');

      if (sourceNode?.type === 'pump' && targetNode?.type === 'sink') {
        get().setWaterWarning("Ein Accumulator schont die Pumpe und verhindert stotternden Wasserfluss.");
        setTimeout(() => get().setWaterWarning(null), 5000);
      }

      const newEdge: Edge = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        id: crypto.randomUUID(),
        type: 'waterPipe',
        data: {}
      };
      set((state) => withHistory(state, { waterEdges: addEdge(newEdge, state.waterEdges) }));

      return;
    }

    const { nodesMap } = getDerivedSystemState(nodes, []);
    const sourceNode = nodesMap.get(connection.source || '');
    const targetNode = nodesMap.get(connection.target || '');
    const edgeDomain = getEdgeDomain(sourceNode?.type, targetNode?.type, connection.sourceHandle);

    const newEdge: Edge<CableEdgeData> = {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      id: crypto.randomUUID(),
      type: 'cableEdge',
      data: {
        length: 3,
        crossSection: edgeDomain === 'AC_230V' ? 1.5 : 2.5,
        edgeDomain,
      },
    };
    set((state) => withHistory(state, { edges: addEdge(newEdge, state.edges) as Edge<CableEdgeData>[] }));

  },

  autoWireSystem: () => {
    const { nodes, edges } = get();

    const result = performAutoWiring(nodes, edges);
    if (!result) {
      get().setSystemMessage('Bitte zuerst eine Batterie platzieren, bevor Komponenten verbunden werden.');
      return;
    }

    // Nutzer-Kanten bleiben erhalten; nur Auto-Kanten früherer Läufe
    // werden durch die frisch berechneten ersetzt (Idempotenz).
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      result.nodes,
      result.edges,
      'LR'
    );

    set((state) => withHistory(state, { nodes: [...layoutedNodes], edges: [...layoutedEdges] }));

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
        window.dispatchEvent(new CustomEvent('planner-auto-wired', { detail: { edgeCount: result.edges.length } }));
      });
    }
  },

  onLayout: () => {
    const { viewMode, nodes, edges, waterNodes, waterEdges } = get();
    if (viewMode === 'water') {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        waterNodes,
        waterEdges,
        'LR'
      );
      set((state) => withHistory(state, { waterNodes: [...layoutedNodes], waterEdges: [...layoutedEdges] }));
    } else {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        'LR'
      );
      set((state) => withHistory(state, { nodes: [...layoutedNodes], edges: [...layoutedEdges] }));
    }
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
      });
    }
  },

  checkSchematic: () => {
    const { nodes, edges } = get();
    const schematic = { nodes, edges };
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('check-schematic', { detail: schematic });
      window.dispatchEvent(event);
    }
  },

  applyTemplate: (templateId: string) => {
    const template = TEMPLATES_DICT[templateId];
    if (template) {
      set((state) => withHistory(state, {
        nodes: [...template.nodes],
        edges: [...template.edges],
        waterNodes: [],
        waterEdges: [],
        selectedNodes: [],
        selectedEdges: [],
      }));
    }
  },

  exportBOM: () => {
    const { nodes, waterNodes, edges, waterEdges } = get();
    const counts: Record<string, number> = {};

    for (let i = 0; i < nodes.length; i++) {
      const type = nodes[i].type!;
      counts[type] = (counts[type] || 0) + 1;
    }
    for (let i = 0; i < waterNodes.length; i++) {
      const type = waterNodes[i].type!;
      counts[type] = (counts[type] || 0) + 1;
    }

    const cableLengths: Record<string, number> = {};

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const cs = e.data?.crossSection || 2.5;
      cableLengths[cs] = (cableLengths[cs] || 0) + (e.data?.length || 3);
    }
    for (let i = 0; i < waterEdges.length; i++) {
      const e = waterEdges[i];
      const pipeType = e.data?.pipeType || 'water';
      cableLengths[pipeType] = (cableLengths[pipeType] || 0) + (e.data?.length || 2);
    }

    const bom = { counts, cableLengths };

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('export-bom', { detail: bom });
      window.dispatchEvent(event);
    }
  },

  onDrop: (event, screenToFlowPosition) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    const label = event.dataTransfer.getData('application/reactflow-label');
    const wattsStr = event.dataTransfer.getData('application/reactflow-watts');

    if (typeof type === 'undefined' || !type) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    get().addNode(type, label, position, wattsStr ? Number(wattsStr) : undefined);
  },

  onCustomDrop: (event, screenToFlowPosition) => {
    const customEvent = event as CustomEvent;
    const { clientX, clientY, type, label, watts } = customEvent.detail;

    const position = screenToFlowPosition({
      x: clientX,
      y: clientY,
    });

    get().addNode(type, label, position, watts);
  },

  addNode: (type, label, position, watts?: number) => {
    const newNode: Node = {
      id: `${type}-${crypto.randomUUID()}`,
      type,
      position,
      data: { label, ...(watts !== undefined ? { watts } : {}) },
    };

    if (type === 'battery') {
      newNode.data = { capacity: 100, chemistry: 'LiFePO4', ...newNode.data };
    } else if (type === 'consumer') {
      newNode.data = { watts: 50, hours: 2, ...newNode.data };
    } else if (type === 'charger' || type === 'mpptController' || type === 'dcdcCharger' || type === 'acBatteryCharger') {
      newNode.data = { amps: 10, ...newNode.data };
    } else if (type === 'fuse') {
      newNode.data = { rating: 30, ...newNode.data };
    } else if (type === 'shorePower') {
      newNode.data = { hasRcd: false, ...newNode.data };
    } else if (type === 'consumer230v') {
      newNode.data = { watts: 1000, hours: 0.5, ...newNode.data };
    } else if (type === 'solar') {
      newNode.data = { voltage: 18, amps: 5, watts: 90, ...newNode.data };
    } else if (type === 'inverter') {
      newNode.data = { watts: 1000, continuousPower: 1000, ...newNode.data };
    }

    const { viewMode } = get();
    if (viewMode === 'water') {
      set((state) => withHistory(state, { waterNodes: state.waterNodes.concat(newNode) }));
    } else {
      set((state) => withHistory(state, { nodes: state.nodes.concat(newNode) }));
    }
  },

  handleChangeCrossSection: (id, crossSection) => set((state) => withHistory(state, {
    edges: state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, crossSection } };
      }
      return e;
    })
  })),

  handleChangeFuseSize: (id, fuseSize) => set((state) => withHistory(state, {
    edges: state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, fuseSize } };
      }
      return e;
    })
  })),

  undo: () => set((state) => {
    const previous = state.historyPast[state.historyPast.length - 1];
    if (!previous) return state;
    const nextPast = state.historyPast.slice(0, -1);
    const nextFuture = [graphSnapshot(state), ...state.historyFuture].slice(0, HISTORY_LIMIT);
    return {
      ...previous,
      selectedNodes: [],
      selectedEdges: [],
      firstTappedHandle: null,
      historyPast: nextPast,
      historyFuture: nextFuture,
      canUndo: nextPast.length > 0,
      canRedo: true,
    };
  }),

  redo: () => set((state) => {
    const next = state.historyFuture[0];
    if (!next) return state;
    const nextPast = [...state.historyPast, graphSnapshot(state)].slice(-HISTORY_LIMIT);
    const nextFuture = state.historyFuture.slice(1);
    return {
      ...next,
      selectedNodes: [],
      selectedEdges: [],
      firstTappedHandle: null,
      historyPast: nextPast,
      historyFuture: nextFuture,
      canUndo: true,
      canRedo: nextFuture.length > 0,
    };
  }),

  clearPlan: () => set((state) => withHistory(state, {
    nodes: [],
    edges: [],
    waterNodes: [],
    waterEdges: [],
    selectedNodes: [],
    selectedEdges: [],
    firstTappedHandle: null,
  })),

  calculatePathVoltageDrop: (targetNodeId, customNodes, customEdges) => {
    const edges = customEdges || get().edges;
    const nodes = customNodes || get().nodes;
    const sysVoltage = getSystemVoltage(nodes);

    // Identische Logik wie die Auto-Wire-Dimensionierung (cumulativeDropAt):
    // Versorgungspfad (Batterie/Landstrom) bevorzugt, sonst bester Ladezweig.
    const nodesMap = getNodeMap(nodes, []);
    return relevantCumulativeDrop(targetNodeId, nodesMap, edges, nodes, sysVoltage);
  },
}),
    {
      name: 'werft-planner-v1',
      version: PLANNER_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => migratePlannerPersisted(persisted, version) as PlannerState,
      partialize: (state) => ({
        viewMode: state.viewMode,
        season: state.season,
        nodes: state.nodes,
        edges: state.edges,
        waterNodes: state.waterNodes,
        waterEdges: state.waterEdges,
        isSidebarOpen: state.isSidebarOpen,
        isInspectorOpen: state.isInspectorOpen,
      }),
    }
  )
);
