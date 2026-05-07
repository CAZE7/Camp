import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { getLayoutedElements } from '../components/planner/utils/layout';
import React from 'react';
import { Node, Edge, Connection } from 'reactflow';
import { initialNodes, initialEdges } from '../components/planner/constants';
import { CableEdgeData } from '../components/edges/CableEdge';

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
  setNodes: (update) => set({ nodes: typeof update === 'function' ? update(get().nodes) : update }),
  setEdges: (update) => set({ edges: typeof update === 'function' ? update(get().edges) : update }),

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

  onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) as Edge<CableEdgeData>[] })),
  onWaterNodesChange: (changes) => set((state) => ({ waterNodes: applyNodeChanges(changes, state.waterNodes) })),
  onWaterEdgesChange: (changes) => set((state) => ({ waterEdges: applyEdgeChanges(changes, state.waterEdges) })),

  onSelectionChange: (params) => set({ selectedNodes: params.nodes, selectedEdges: params.edges }),

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

    return {
      nodes: state.nodes.filter((n) => !nodeIdsSet.has(n.id)),
      edges: state.edges.filter(
        (e) => !nodeIdsSet.has(e.source) && !nodeIdsSet.has(e.target) && !edgeIdsSet.has(e.id)
      ),
      selectedNodes: [],
      selectedEdges: [],
    };
  }),

  updateNodeData: (id, data) => set((state) => ({
    nodes: state.nodes.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    })
  })),

  handleChangeLength: (id, length) => set((state) => ({
    edges: state.edges.map((e) => {
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
      const nodesMap = getNodeMap(nodes, waterNodes);
      const sourceNode = nodesMap.get(connection.source || '');
      const targetNode = nodesMap.get(connection.target || '');

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

    const newEdge: Edge<CableEdgeData> = {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      id: crypto.randomUUID(),
      type: 'cableEdge',
      data: {
        length: 3,
        crossSection: 2.5,
      },
    };
    set((state) => ({ edges: addEdge(newEdge, state.edges) as Edge<CableEdgeData>[] }));
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

    // Build dictionary for fast lookups
    const nodesByType: Record<string, Node[]> = {};
    const len = currentNodes.length;
    for (let i = 0; i < len; i++) {
      const node = currentNodes[i];
      const type = node.type || 'default';
      let arr = nodesByType[type];
      if (!arr) {
        arr = [];
        nodesByType[type] = arr;
      }
      arr.push(node);
    }

    // Helper to generate missing nodes
    const ensureNode = (
      type: string,
      label: string,
      offsetX: number,
      offsetY: number,
      extraData: any = {}
    ) => {
      let typeNodes = nodesByType[type];
      if (!typeNodes) {
        typeNodes = [];
        nodesByType[type] = typeNodes;
      }
      let node = typeNodes.find((n) => n.data?.label === label);
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
        typeNodes.push(node);
      }
      return node;
    };

    // Helper to calculate wire cross section according to VDE
    const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];
    const FUSE_MAP: Record<number, number> = {
      1.5: 15,
      2.5: 20,
      4.0: 30,
      6.0: 40,
      10.0: 60,
      16.0: 80,
      25.0: 100,
      35.0: 150,
      50.0: 200,
      70.0: 250,
    };

    const calculateWire = (I: number, length: number = 2) => {
      const calculatedA = (I * (length * 2)) / (58 * 0.24);
      const minRequiredA = Math.max(1.5, calculatedA);

      let crossSection = 70.0;
      for (let i = 0; i < 10; i++) {
        if (VDE_SIZES[i] >= minRequiredA) {
          crossSection = VDE_SIZES[i];
          break;
        }
      }

      const fuseSize = FUSE_MAP[crossSection] || 250;

      return { crossSection, fuseSize, length };
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

    const inverters = nodesByType['inverter'] || [];
    const invertersLen = inverters.length;
    for (let i = 0; i < invertersLen; i++) {
      const inverter = inverters[i];
      const inverterWatts = Number(inverter.data.watts) || 1000;
      const inverterAmps = inverterWatts / 12 / 0.85;
      connect(busbarNode.id, inverter.id, inverterAmps, 1);
    }

    connect(
      busbarNode.id,
      fuseBoxNode.id,
      Number(fuseBoxNode.data.rating) || 100,
      1
    );

    const solars = [
      ...(nodesByType['solar'] || []),
      ...(nodesByType['roofsolar'] || [])
    ];
    const solarsLen = solars.length;
    if (solarsLen > 0) {
      const mpptNode = ensureNode('charger', 'MPPT Laderegler', 150, -200, {
        amps: 30,
      });
      for (let i = 0; i < solarsLen; i++) {
        const solar = solars[i];
        const solarWatts = Number(solar.data.watts) || 100;
        const solarAmps = solarWatts / 12;
        connect(solar.id, mpptNode.id, solarAmps, 5);
      }
      connect(
        mpptNode.id,
        busbarNode.id,
        Number(mpptNode.data.amps) || 30,
        2
      );
    }

    const chargers = nodesByType['charger'] || [];
    const chargersLen = chargers.length;
    const boosters: Node[] = [];
    const plainChargers: Node[] = [];
    for (let i = 0; i < chargersLen; i++) {
      const c = chargers[i];
      const lbl = (c.data?.label as string)?.toLowerCase() || '';
      if (lbl.includes('ladequelle')) {
        boosters.push(c);
      } else if (!lbl.includes('mppt')) {
        plainChargers.push(c);
      }
    }

    const boostersLen = boosters.length;
    for (let i = 0; i < boostersLen; i++) {
      connect(
        boosters[i].id,
        busbarNode.id,
        Number(boosters[i].data.amps) || 30,
        3
      );
    }

    const plainChargersLen = plainChargers.length;
    for (let i = 0; i < plainChargersLen; i++) {
      connect(
        plainChargers[i].id,
        busbarNode.id,
        Number(plainChargers[i].data.amps) || 30,
        3
      );
    }

    const consumers = nodesByType['consumer'] || [];
    const consumersLen = consumers.length;
    for (let i = 0; i < consumersLen; i++) {
      const consumer = consumers[i];
      const I = (Number(consumer.data.watts) || 0) / 12;
      connect(fuseBoxNode.id, consumer.id, I, 3);
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      currentNodes,
      newEdges,
      'LR'
    );

    set({ nodes: [...layoutedNodes], edges: [...layoutedEdges] });

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
    set({ nodes: [...layoutedNodes], edges: [...layoutedEdges] });
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
      set((state) => ({ nodes: state.nodes.concat(newNode) }));
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
      set((state) => ({ nodes: state.nodes.concat(newNode) }));
    }
  },

  handleChangeCrossSection: (id, crossSection) => set((state) => ({
    edges: state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, crossSection } };
      }
      return e;
    })
  })),
}));
