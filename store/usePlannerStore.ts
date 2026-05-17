import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { getLayoutedElements } from '../components/planner/utils/layout';
import React from 'react';
import { Node, Edge, Connection } from 'reactflow';
import { initialNodes, initialEdges } from '../components/planner/constants';
import { CableEdgeData } from '../components/edges/CableEdge';
import { PlannerNodeData } from '../components/nodes/types';

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
  updateNodeData: (id: string, data: Partial<PlannerNodeData>) => void;
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
  addNode: (type: string, label: string, position: {x: number, y: number}, watts?: number) => void;
  applyTemplate: (templateId: string) => void;
  calculatePathVoltageDrop: (targetNodeId: string) => number;
}

import { TEMPLATES_DICT } from '../components/planner/templates';

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

function calculateWire(I: number, length: number = 2) {
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
}

function buildDictionaries(currentNodes: Node[]) {
  const nodesByType: Record<string, Node[]> = {};
  // Optimized O(1) Map lookup replacing typeNodes.find()
  const nodesByLabel = new Map<string, Node>();
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
    if (node.data?.label) {
      nodesByLabel.set(`${type}-${node.data.label}`, node);
    }
  }
  return { nodesByType, nodesByLabel };
}

function ensureNode(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  type: string,
  label: string,
  offsetX: number,
  offsetY: number,
  extraData: Record<string, unknown> = {}
) {
  let typeNodes = nodesByType[type];
  if (!typeNodes) {
    typeNodes = [];
    nodesByType[type] = typeNodes;
  }

  const key = `${type}-${label}`;
  // Map lookup is O(1) compared to array .find()
  let node = nodesByLabel.get(key);
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
    nodesByLabel.set(key, node);
  }
  return node;
}

function connectEdges(
  newEdges: Edge[],
  edgeIdRef: { counter: number },
  sourceId: string,
  targetId: string,
  I: number = 0,
  length: number = 2
) {
  const { crossSection, fuseSize } = calculateWire(I, length);
  newEdges.push({
    id: `e-auto-${edgeIdRef.counter++}`,
    source: sourceId,
    target: targetId,
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: { length, crossSection, fuseSize },
  });
  newEdges.push({
    id: `e-auto-${edgeIdRef.counter++}`,
    source: sourceId,
    target: targetId,
    sourceHandle: 'minus',
    targetHandle: 'minus',
    type: 'cableEdge',
    data: { length, crossSection },
  });
}

function wireSolars(
  solars: Node[],
  busbarNode: Node,
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  newEdges: Edge[],
  edgeIdRef: { counter: number }
) {
  const solarsLen = solars.length;
  if (solarsLen > 0) {
    const mpptNode = ensureNode(currentNodes, nodesByType, nodesByLabel, batteryNode, 'charger', 'MPPT Laderegler', 150, -200, {
      amps: 30,
    });
    for (let i = 0; i < solarsLen; i++) {
      const solar = solars[i];
      const solarWatts = Number(solar.data.watts) || 100;
      const solarAmps = solarWatts / 12;
      connectEdges(newEdges, edgeIdRef, solar.id, mpptNode.id, solarAmps, 5);
    }
    connectEdges(newEdges, edgeIdRef, mpptNode.id, busbarNode.id, Number(mpptNode.data.amps) || 30, 2);
  }
}

function wireChargers(
  chargers: Node[],
  busbarNode: Node,
  newEdges: Edge[],
  edgeIdRef: { counter: number }
) {
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
    connectEdges(newEdges, edgeIdRef, boosters[i].id, busbarNode.id, Number(boosters[i].data.amps) || 30, 3);
  }

  const plainChargersLen = plainChargers.length;
  for (let i = 0; i < plainChargersLen; i++) {
    connectEdges(newEdges, edgeIdRef, plainChargers[i].id, busbarNode.id, Number(plainChargers[i].data.amps) || 30, 3);
  }
}

function wireInverters(
  inverters: Node[],
  busbarNode: Node,
  newEdges: Edge[],
  edgeIdRef: { counter: number }
) {
  const invertersLen = inverters.length;
  for (let i = 0; i < invertersLen; i++) {
    const inverter = inverters[i];
    const inverterWatts = Number(inverter.data.watts) || 1000;
    const inverterAmps = inverterWatts / 12 / 0.85;
    connectEdges(newEdges, edgeIdRef, busbarNode.id, inverter.id, inverterAmps, 1);
  }
}

function wireConsumers(
  consumers: Node[],
  fuseBoxNode: Node,
  newEdges: Edge[],
  edgeIdRef: { counter: number }
) {
  const consumersLen = consumers.length;
  for (let i = 0; i < consumersLen; i++) {
    const consumer = consumers[i];
    const I = (Number(consumer.data.watts) || 0) / 12;
    connectEdges(newEdges, edgeIdRef, fuseBoxNode.id, consumer.id, I, 3);
  }
}

function performAutoWiring(initialNodes: Node[]): { nodes: Node[], edges: Edge[] } | null {
  let currentNodes = [...initialNodes];
  let newEdges: Edge[] = [];
  let edgeIdRef = { counter: 1 };

  const { nodesByType, nodesByLabel } = buildDictionaries(currentNodes);

  const batteryNode = nodesByType['battery']?.[0];
  if (!batteryNode) {
    return null;
  }

  const busbarNode = ensureNode(currentNodes, nodesByType, nodesByLabel, batteryNode, 'busbar', 'Main Busbar', 300, 0);
  const fuseBoxNode = ensureNode(currentNodes, nodesByType, nodesByLabel, batteryNode, 'fuse', '12V Sicherungskasten', 300, 200, {
    rating: 100,
  });
  const shuntNode = ensureNode(currentNodes, nodesByType, nodesByLabel, batteryNode, 'shunt', 'Smart Shunt', 150, 0);

  const batteryCapacity = Number(batteryNode.data.capacity) || 100;
  const maxDischargeA = batteryCapacity;
  connectEdges(newEdges, edgeIdRef, batteryNode.id, shuntNode.id, maxDischargeA, 0.5);
  connectEdges(newEdges, edgeIdRef, shuntNode.id, busbarNode.id, maxDischargeA, 0.5);

  wireInverters(nodesByType['inverter'] || [], busbarNode, newEdges, edgeIdRef);
  connectEdges(newEdges, edgeIdRef, busbarNode.id, fuseBoxNode.id, Number(fuseBoxNode.data.rating) || 100, 1);

  const solars = [
    ...(nodesByType['solar'] || []),
    ...(nodesByType['roofsolar'] || [])
  ];
  wireSolars(solars, busbarNode, currentNodes, nodesByType, nodesByLabel, batteryNode, newEdges, edgeIdRef);
  wireChargers(nodesByType['charger'] || [], busbarNode, newEdges, edgeIdRef);
  wireConsumers(nodesByType['consumer'] || [], fuseBoxNode, newEdges, edgeIdRef);

  function wire230VAndGround(
    inverters: Node[],
    consumers230v: Node[],
    shorePowers: Node[],
    grounds: Node[],
    busbarNode: Node,
    newEdges: Edge[],
    edgeIdRef: { counter: number }
  ) {
    if (inverters.length > 0) {
      const mainInverter = inverters[0];
      for (let i = 0; i < consumers230v.length; i++) {
        newEdges.push({
          id: `e-auto-ac-${edgeIdRef.counter++}`,
          source: mainInverter.id,
          target: consumers230v[i].id,
          sourceHandle: 'plus',
          targetHandle: 'plus',
          type: 'cableEdge',
          data: { length: 2, crossSection: 1.5, fuseSize: 16 },
        });
      }
      for (let i = 0; i < shorePowers.length; i++) {
        newEdges.push({
          id: `e-auto-ac-in-${edgeIdRef.counter++}`,
          source: shorePowers[i].id,
          target: mainInverter.id,
          sourceHandle: 'plus',
          targetHandle: 'plus',
          type: 'cableEdge',
          data: { length: 2, crossSection: 2.5, fuseSize: 16 },
        });
      }
    }
    if (grounds.length > 0 && busbarNode) {
      const mainGround = grounds[0];
      newEdges.push({
        id: `e-auto-gnd-${edgeIdRef.counter++}`,
        source: busbarNode.id,
        target: mainGround.id,
        sourceHandle: 'minus',
        targetHandle: 'plus',
        type: 'cableEdge',
        data: { length: 1, crossSection: 16 },
      });
    }
  }

  wire230VAndGround(
    nodesByType['inverter'] || [],
    nodesByType['consumer230v'] || [],
    nodesByType['shorePower'] || [],
    nodesByType['ground'] || [],
    busbarNode,
    newEdges,
    edgeIdRef
  );

  return { nodes: currentNodes, edges: newEdges };
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

  onNodesChange: (changes) => set((state) => {
    const newNodes = applyNodeChanges(changes, state.nodes);
    const deletedNodeIds = new Set<string>();
    for (const change of changes) {
      if (change.type === 'remove') deletedNodeIds.add(change.id);
    }
    if (deletedNodeIds.size > 0) {
      return {
        nodes: newNodes,
        edges: state.edges.filter(e => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target))
      };
    }
    return { nodes: newNodes };
  }),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) as Edge<CableEdgeData>[] })),
  onWaterNodesChange: (changes) => set((state) => {
    const newWaterNodes = applyNodeChanges(changes, state.waterNodes);
    const deletedNodeIds = new Set<string>();
    for (const change of changes) {
      if (change.type === 'remove') deletedNodeIds.add(change.id);
    }
    if (deletedNodeIds.size > 0) {
      return {
        waterNodes: newWaterNodes,
        waterEdges: state.waterEdges.filter(e => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target))
      };
    }
    return { waterNodes: newWaterNodes };
  }),
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
    // If there is already a path from the connection's target back to the connection's source,
    // adding this new edge will create a cycle.
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
      setTimeout(() => get().onLayout(), 50);
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
    setTimeout(() => get().onLayout(), 50);
  },

  autoWireSystem: (fitView) => {
    const { nodes } = get();

    const result = performAutoWiring(nodes);
    if (!result) {
      alert('Bitte zuerst eine Batterie platzieren');
      return;
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      result.nodes,
      result.edges,
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

  applyTemplate: (templateId: string) => {
    const template = TEMPLATES_DICT[templateId];
    if (template) {
      set({
        nodes: [...template.nodes],
        edges: [...template.edges],
        waterNodes: [],
        waterEdges: [],
      });
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

  calculatePathVoltageDrop: (targetNodeId) => {
    const { edges, nodes } = get();

    const getI = (sourceNode: Node | undefined, targetNode: Node | undefined) => {
      const sData = sourceNode?.data;
      const tData = targetNode?.data;
      if (sData?.totalAmps !== undefined) return Number(sData.totalAmps);
      if (tData?.totalAmps !== undefined) return Number(tData.totalAmps);
      if (sData?.amps !== undefined && sourceNode?.type !== 'battery') return Number(sData.amps);
      if (tData?.amps !== undefined && targetNode?.type !== 'battery') return Number(tData.amps);
      if (sourceNode?.type === 'consumer') return (Number(sData?.watts) || 0) / 12;
      if (targetNode?.type === 'consumer') return (Number(tData?.watts) || 0) / 12;
      if (sourceNode?.type === 'inverter') return (Number(sData?.watts) || 0) / 12 / 0.85;
      if (targetNode?.type === 'inverter') return (Number(tData?.watts) || 0) / 12 / 0.85;
      if (sourceNode?.type === 'solar') return (Number(sData?.watts) || 0) / 18;
      if (targetNode?.type === 'solar') return (Number(tData?.watts) || 0) / 18;
      let totalAmps = 0;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.type === 'consumer') totalAmps += (Number(n.data.watts) || 0) / 12;
        else if (n.type === 'consumer230v') totalAmps += (Number(n.data.watts) || 0) / 12 / 0.85;
      }
      return totalAmps;
    };

    let maxCumulativeDrop = 0;

    const dfs = (currentNodeId: string, currentDrop: number, visited: Set<string>) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);

      const node = nodes.find(n => n.id === currentNodeId);
      if (node?.type === 'battery' || node?.type === 'shorePower') {
        if (currentDrop > maxCumulativeDrop) {
          maxCumulativeDrop = currentDrop;
        }
        return;
      }

      const incomingEdges = edges.filter(e => e.target === currentNodeId);
      if (incomingEdges.length === 0) {
        if (currentDrop > maxCumulativeDrop) {
          maxCumulativeDrop = currentDrop;
        }
        return;
      }

      for (const edge of incomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const I = getI(sourceNode, node);
        const length = edge.data?.length || 1;
        const cs = edge.data?.crossSection || 2.5;
        const voltageDrop = (I * (length * 2)) / (58 * cs);
        const dropPercentage = (voltageDrop / 12) * 100;
        
        dfs(edge.source, currentDrop + dropPercentage, new Set(visited));
      }
    };

    dfs(targetNodeId, 0, new Set<string>());
    return maxCumulativeDrop;
  },
}));
