import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { getLayoutedElements } from '../components/planner/utils/layout';
import React from 'react';
import { Node, Edge, Connection } from 'reactflow';
import { initialNodes, initialEdges } from '../components/planner/constants';
import { CableEdgeData } from '../components/edges/CableEdge';
import {
  calculateWire as calculateWireVDE,
  VDE_INVERTER_EFFICIENCY,
  VDE_MIN_CROSS_SECTION,
  validateSchematic,
  VDEValidationResult,
} from '../lib/vde-standards';

interface PlannerState {
  viewMode: 'electric' | 'water';
  setViewMode: (mode: 'electric' | 'water') => void;

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

  /**
   * Live-VDE-Validierungsergebnisse für den aktuellen Schaltplan.
   * Wird automatisch bei jeder Änderung der nodes/edges neu berechnet.
   * So kann das UI jederzeit Warnungen anzeigen, ohne selbst rechnen zu müssen.
   */
  vdeValidationResults: VDEValidationResult[];
  /** Convenience: gibt es kritische Fehler? */
  hasVdeErrors: () => boolean;

  onNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onWaterNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onWaterEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onSelectionChange: (params: import('reactflow').OnSelectionChangeParams) => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, data: any) => void;
  handleChangeLength: (id: string, length: number) => void;
  handleChangeCrossSection: (id: string, crossSection: number) => void;

  isValidConnection: (connection: Connection) => boolean;
  onConnect: (connection: Connection) => void;
  autoWireSystem: (fitView?: (options?: any) => void) => void;
  onLayout: (fitView?: (options?: any) => void) => void;
  checkSchematic: () => void;
  exportBOM: () => void;
  onDrop: (event: React.DragEvent, screenToFlowPosition: (client: {x: number, y: number}) => {x: number, y: number}) => void;
  onCustomDrop: (event: Event, screenToFlowPosition: (client: {x: number, y: number}) => {x: number, y: number}) => void;
}

let cachedNodesRef: Node[] | null = null;
let cachedWaterNodesRef: Node[] | null = null;
let cachedNodeMap = new Map<string, Node>();

function getNodeMap(currentNodes: Node[], currentWaterNodes: Node[]): Map<string, Node> {
  if (currentNodes !== cachedNodesRef || currentWaterNodes !== cachedWaterNodesRef) {
    cachedNodeMap.clear();
    for (let i = 0, len = currentNodes.length; i < len; i++) {
      cachedNodeMap.set(currentNodes[i].id, currentNodes[i]);
    }
    for (let i = 0, len = currentWaterNodes.length; i < len; i++) {
      cachedNodeMap.set(currentWaterNodes[i].id, currentWaterNodes[i]);
    }
    cachedNodesRef = currentNodes;
    cachedWaterNodesRef = currentWaterNodes;
  }
  return cachedNodeMap;
}

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
  hasVdeErrors: () => get().vdeValidationResults.some((r) => r.severity === 'error'),

  onNodesChange: (changes) => set((state) => {
    const nodes = applyNodeChanges(changes, state.nodes);
    return {
      nodes,
      vdeValidationResults: validateSchematic(nodes, state.edges),
    };
  }),
  onEdgesChange: (changes) => set((state) => {
    const edges = applyEdgeChanges(changes, state.edges) as Edge<CableEdgeData>[];
    return {
      edges,
      vdeValidationResults: validateSchematic(state.nodes, edges),
    };
  }),
  onWaterNodesChange: (changes) => set((state) => ({ waterNodes: applyNodeChanges(changes, state.waterNodes) })),
  onWaterEdgesChange: (changes) => set((state) => ({ waterEdges: applyEdgeChanges(changes, state.waterEdges) })),

  onSelectionChange: (params) => set({ selectedNodes: params.nodes, selectedEdges: params.edges }),

  deleteSelected: () => set((state) => {
    const nodeIdsSet = new Set(state.selectedNodes.map((n) => n.id));
    const edgeIdsSet = new Set(state.selectedEdges.map((e) => e.id));

    const nodes = state.nodes.filter((n) => !nodeIdsSet.has(n.id));
    const edges = state.edges.filter(
      (e) => !nodeIdsSet.has(e.source) && !nodeIdsSet.has(e.target) && !edgeIdsSet.has(e.id)
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
    const nodes = state.nodes.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    });
    return {
      nodes,
      vdeValidationResults: validateSchematic(nodes, state.edges),
    };
  }),

  handleChangeLength: (id, length) => set((state) => {
    const edges = state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, length } };
      }
      return e;
    });
    return {
      edges,
      vdeValidationResults: validateSchematic(state.nodes, edges),
    };
  }),

  isValidConnection: (connection) => {
    const { nodes, waterNodes, viewMode, edges } = get();
    const allNodes = [...nodes, ...waterNodes];

    // Create a node map for O(1) lookups
    const nodesMap = new Map<string, import('reactflow').Node>();
    for (let i = 0; i < allNodes.length; i++) {
      nodesMap.set(allNodes[i].id, allNodes[i]);
    }

    const sourceNode = nodesMap.get(connection.source || '');
    const targetNode = nodesMap.get(connection.target || '');

    if (viewMode === 'water') {
      if (sourceNode?.type === 'grayWaterTank' && targetNode?.type === 'sink') {
        return false;
      }
      return true;
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

    if (!isSeriesException) {
      if ((sIsPlus && tIsMinus) || (sIsMinus && tIsPlus)) {
        return false; // Polarity mismatch
      }
    }

    // Check for cycles
    const target = targetNode;

    const outgoersMap = new Map<string, string[]>();

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      let targets = outgoersMap.get(edge.source);
      if (!targets) {
        targets = [];
        outgoersMap.set(edge.source, targets);
      }
      targets.push(edge.target);
    }

    const hasCycle = (nodeId: string, visited = new Set<string>()) => {
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);

      const outgoers = outgoersMap.get(nodeId) || [];
      for (let i = 0; i < outgoers.length; i++) {
        const outgoerId = outgoers[i];
        if (outgoerId === connection.source) return true;
        if (hasCycle(outgoerId, visited)) return true;
      }
      return false;
    };

    if (target?.id === connection.source) return false;
    if (target) return !hasCycle(target.id);

    return true;
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;

    const { viewMode, waterNodes, nodes } = get();

    if (viewMode === 'water') {
      const allNodes = [...waterNodes];
      const sourceNode = allNodes.find((n) => n.id === connection.source);
      const targetNode = allNodes.find((n) => n.id === connection.target);

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
      set((state) => ({ waterEdges: addEdge(newEdge, state.waterEdges) }));
      return;
    }

    // VDE-konforme Default-Werte für neue Kabel
    // Das Kabel wird mit dem absoluten Minimum (1.5 mm², 3m) angelegt;
    // VDE-Validierung läuft im Hintergrund und warnt, falls nötig.
    const newEdge: Edge<CableEdgeData> = {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      id: crypto.randomUUID(),
      type: 'cableEdge',
      data: {
        length: 3,
        crossSection: VDE_MIN_CROSS_SECTION,
      },
    };
    set((state) => {
      const edges = addEdge(newEdge, state.edges) as Edge<CableEdgeData>[];
      return {
        edges,
        vdeValidationResults: validateSchematic(state.nodes, edges),
      };
    });
  },

  autoWireSystem: (fitView) => {
    const { nodes, edges } = get();
    const batteryNode = nodes.find((n) => n.type === 'battery');
    if (!batteryNode) {
      alert('Bitte zuerst eine Batterie platzieren');
      return;
    }

    let currentNodes = [...nodes];
    let newEdges: Edge[] = [];
    let edgeIdCounter = 1;

    // Helper to generate missing nodes
    const ensureNode = (
      type: string,
      label: string,
      offsetX: number,
      offsetY: number,
      extraData: any = {}
    ) => {
      let node = currentNodes.find(
        (n) => n.type === type && n.data?.label === label
      );
      if (!node) {
        node = {
          id: crypto.randomUUID(),
          type,
          position: {
            x: batteryNode.position.x + offsetX,
            y: batteryNode.position.y + offsetY,
          },
          data: { label, ...extraData },
        };
        currentNodes.push(node);
      }
      return node;
    };

    // Helper: Berechnet Querschnitt und Sicherung nach VDE (über zentrale Quelle)
    const calculateWire = (I: number, length: number = 2) => {
      return calculateWireVDE(I, length);
    };

    // Helper to connect two nodes with plus and minus edges
    const connect = (
      sourceId: string,
      targetId: string,
      I: number = 0,
      length: number = 2
    ) => {
      const { crossSection, fuseSize } = calculateWire(I, length);
      newEdges.push({
        id: `e-auto-${edgeIdCounter++}`,
        source: sourceId,
        target: targetId,
        sourceHandle: 'plus',
        targetHandle: 'plus',
        type: 'cableEdge',
        data: { length, crossSection, fuseSize },
      });
      newEdges.push({
        id: `e-auto-${edgeIdCounter++}`,
        source: sourceId,
        target: targetId,
        sourceHandle: 'minus',
        targetHandle: 'minus',
        type: 'cableEdge',
        data: { length, crossSection },
      });
    };

    const busbarNode = ensureNode('busbar', 'Main Busbar', 300, 0);
    const fuseBoxNode = ensureNode('fuse', '12V Sicherungskasten', 300, 200, {
      rating: 100,
    });
    const shuntNode = ensureNode('shunt', 'Smart Shunt', 150, 0);

    const batteryCapacity = Number(batteryNode.data.capacity) || 100;
    const maxDischargeA = batteryCapacity;
    connect(batteryNode.id, shuntNode.id, maxDischargeA, 0.5);
    connect(shuntNode.id, busbarNode.id, maxDischargeA, 0.5);

    const inverters = currentNodes.filter((n) => n.type === 'inverter');
    inverters.forEach((inverter) => {
      const inverterWatts = Number(inverter.data.watts) || 1000;
      // VDE-konformer Wirkungsgrad aus vde-standards.ts
      const inverterAmps = inverterWatts / 12 / VDE_INVERTER_EFFICIENCY;
      connect(busbarNode.id, inverter.id, inverterAmps, 1);
    });

    connect(
      busbarNode.id,
      fuseBoxNode.id,
      Number(fuseBoxNode.data.rating) || 100,
      1
    );

    const solars = currentNodes.filter(
      (n) => n.type === 'solar' || n.type === 'roofsolar'
    );
    if (solars.length > 0) {
      const mpptNode = ensureNode('charger', 'MPPT Laderegler', 150, -200, {
        amps: 30,
      });
      solars.forEach((solar) => {
        const solarWatts = Number(solar.data.watts) || 100;
        const solarAmps = solarWatts / 12;
        connect(solar.id, mpptNode.id, solarAmps, 5);
      });
      connect(
        mpptNode.id,
        busbarNode.id,
        Number(mpptNode.data.amps) || 30,
        2
      );
    }

    const boosters = currentNodes.filter(
      (n) =>
        n.type === 'charger' &&
        (n.data.label as string)?.toLowerCase().includes('ladequelle')
    );
    boosters.forEach((booster) => {
      connect(
        booster.id,
        busbarNode.id,
        Number(booster.data.amps) || 30,
        3
      );
    });

    const plainChargers = currentNodes.filter(
      (n) =>
        n.type === 'charger' &&
        !(n.data.label as string)?.toLowerCase().includes('mppt') &&
        !(n.data.label as string)?.toLowerCase().includes('ladequelle')
    );
    plainChargers.forEach((charger) => {
      connect(
        charger.id,
        busbarNode.id,
        Number(charger.data.amps) || 30,
        3
      );
    });

    const consumers = currentNodes.filter((n) => n.type === 'consumer');
    consumers.forEach((consumer) => {
      const I = (Number(consumer.data.watts) || 0) / 12;
      connect(fuseBoxNode.id, consumer.id, I, 3);
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      currentNodes,
      newEdges,
      'LR'
    );

    const finalNodes = [...layoutedNodes];
    const finalEdges = [...layoutedEdges];
    set({
      nodes: finalNodes,
      edges: finalEdges,
      vdeValidationResults: validateSchematic(finalNodes, finalEdges),
    });

    if (fitView && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        fitView({ duration: 800 });
      });
    }
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
    const counts: Record<string, number> = {};
    nodes.forEach(n => {
      counts[n.type!] = (counts[n.type!] || 0) + 1;
    });

    const cableLengths: Record<string, number> = {};
    edges.forEach(e => {
      const cs = e.data?.crossSection || 2.5;
      cableLengths[cs] = (cableLengths[cs] || 0) + (e.data?.length || 3);
    });

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

    if (typeof type === 'undefined' || !type) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position,
      data: { label: label },
    };

    if (type === 'battery') {
      newNode.data = { ...newNode.data, capacity: 100, chemistry: 'LiFePO4' };
    } else if (type === 'consumer') {
      newNode.data = { ...newNode.data, watts: 50, hours: 2 };
    } else if (type === 'charger') {
      newNode.data = { ...newNode.data, amps: 10 };
    } else if (type === 'fuse') {
      newNode.data = { ...newNode.data, rating: 30 };
    } else if (type === 'shorePower') {
      newNode.data = { ...newNode.data, hasRcd: false };
    } else if (type === 'consumer230v') {
      newNode.data = { ...newNode.data, watts: 1000, hours: 0.5 };
    } else if (type === 'solar') {
      newNode.data = { ...newNode.data, voltage: 18, amps: 5 };
    }

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

    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position,
      data: { label: label },
    };

    if (type === 'battery') {
      newNode.data = { ...newNode.data, capacity: 100, chemistry: 'LiFePO4' };
    } else if (type === 'consumer') {
      newNode.data = { ...newNode.data, watts: 50, hours: 2 };
    } else if (type === 'charger') {
      newNode.data = { ...newNode.data, amps: 10 };
    } else if (type === 'fuse') {
      newNode.data = { ...newNode.data, rating: 30 };
    } else if (type === 'shorePower') {
      newNode.data = { ...newNode.data, hasRcd: false };
    } else if (type === 'consumer230v') {
      newNode.data = { ...newNode.data, watts: 1000, hours: 0.5 };
    } else if (type === 'solar') {
      newNode.data = { ...newNode.data, voltage: 18, amps: 5 };
    }

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
    const edges = state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, crossSection } };
      }
      return e;
    });
    return {
      edges,
      vdeValidationResults: validateSchematic(state.nodes, edges),
    };
  }),
}));
