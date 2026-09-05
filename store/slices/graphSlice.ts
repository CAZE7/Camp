import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { getLayoutedElements } from '../../components/planner/utils/layout';
import { TEMPLATES_DICT } from '../../components/planner/templates';
import { getEdgeDomain, getHandleDomain } from '../../lib/electrical';
import { newEntityId } from '../../lib/id';
import { getSystemVoltage } from '../../lib/vde-standards';
import { performAutoWiring, relevantCumulativeDrop } from '../../lib/autoWire';
import { type CableEdgeData } from '../../components/edges/CableEdge';
import {
  getDerivedSystemState,
  getNodeMap,
  graphSnapshot,
  withHistory,
  pathDropCache,
  plannerGraphSignature,
  HISTORY_LIMIT,
} from './graphInternals';
import type { PlannerSlice, PlannerState } from './types';

/**
 * Graph-Slice: Knoten, Kanten (Strom + Wasser), Selektions-Mutationen,
 * Auto-Wire, Layout, Stückgut-Aktionen und die Undo-History.
 *
 * History, Spannungsfall-Cache und Node-Maps gehören hierher, weil jede
 * dieser Operationen die vier Graph-Arrays atomar verändert: ein Undo-Snapshot
 * muss alle vier treffen, sonst entsteht ein gemischter Zustand (Pfade aus
 * Vergangenheit, Knoten aus Zukunft).
 */
export type GraphSlice = Pick<
  PlannerState,
  | 'nodes'
  | 'edges'
  | 'setNodes'
  | 'setEdges'
  | 'waterNodes'
  | 'waterEdges'
  | 'setWaterNodes'
  | 'setWaterEdges'
  | 'historyPast'
  | 'historyFuture'
  | 'canUndo'
  | 'canRedo'
  | 'onNodesChange'
  | 'onEdgesChange'
  | 'onWaterNodesChange'
  | 'onWaterEdgesChange'
  | 'onSelectionChange'
  | 'focusElement'
  | 'deleteSelected'
  | 'updateNodeData'
  | 'handleChangeLength'
  | 'handleChangeFuseSize'
  | 'isValidConnection'
  | 'onConnect'
  | 'autoWireSystem'
  | 'onLayout'
  | 'applyTemplate'
  | 'onDrop'
  | 'onCustomDrop'
  | 'addNode'
  | 'undo'
  | 'redo'
  | 'clearPlan'
  | 'calculatePathVoltageDrop'
>;

export const createGraphSlice: PlannerSlice<GraphSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  setNodes: (update) =>
    set((state) =>
      withHistory(state, { nodes: typeof update === 'function' ? update(state.nodes) : update })
    ),
  setEdges: (update) =>
    set((state) =>
      withHistory(state, { edges: typeof update === 'function' ? update(state.edges) : update })
    ),
  waterNodes: [],
  waterEdges: [],
  setWaterNodes: (update) =>
    set((state) =>
      withHistory(state, { waterNodes: typeof update === 'function' ? update(state.waterNodes) : update })
    ),
  setWaterEdges: (update) =>
    set((state) =>
      withHistory(state, { waterEdges: typeof update === 'function' ? update(state.waterEdges) : update })
    ),
  historyPast: [],
  historyFuture: [],
  canUndo: false,
  canRedo: false,
  onNodesChange: (changes) =>
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes);
      const deletedNodeIds = new Set<string>();
      for (const change of changes) {
        if (change.type === 'remove') deletedNodeIds.add(change.id);
      }
      if (deletedNodeIds.size > 0) {
        return withHistory(state, {
          nodes: newNodes,
          edges: state.edges.filter((e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)),
        });
      }
      // Während des Ziehens nicht jeden Pixel als eigenen Undo-Schritt speichern.
      const shouldCheckpoint = changes.some(
        (change) => change.type === 'remove' || (change.type === 'position' && !change.dragging)
      );
      return shouldCheckpoint ? withHistory(state, { nodes: newNodes }) : { nodes: newNodes };
    }),
  onEdgesChange: (changes) =>
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.edges) as Edge<CableEdgeData>[];
      return changes.some((change) => change.type === 'remove')
        ? withHistory(state, { edges: nextEdges })
        : { edges: nextEdges };
    }),
  onWaterNodesChange: (changes) =>
    set((state) => {
      const newWaterNodes = applyNodeChanges(changes, state.waterNodes);
      const deletedNodeIds = new Set<string>();
      for (const change of changes) {
        if (change.type === 'remove') deletedNodeIds.add(change.id);
      }
      if (deletedNodeIds.size > 0) {
        return withHistory(state, {
          waterNodes: newWaterNodes,
          waterEdges: state.waterEdges.filter(
            (e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
          ),
        });
      }
      const shouldCheckpoint = changes.some(
        (change) => change.type === 'remove' || (change.type === 'position' && !change.dragging)
      );
      return shouldCheckpoint
        ? withHistory(state, { waterNodes: newWaterNodes })
        : { waterNodes: newWaterNodes };
    }),
  onWaterEdgesChange: (changes) =>
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.waterEdges);
      return changes.some((change) => change.type === 'remove')
        ? withHistory(state, { waterEdges: nextEdges })
        : { waterEdges: nextEdges };
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
  deleteSelected: () =>
    set((state) => {
      const nodeIdsSet = new Set<string>();
      for (const node of state.selectedNodes) {
        nodeIdsSet.add(node.id);
      }

      const edgeIdsSet = new Set<string>();
      for (const edge of state.selectedEdges) {
        edgeIdsSet.add(edge.id);
      }

      const filterNode = (n: Node) => !nodeIdsSet.has(n.id);
      const filterEdge = (e: Edge) =>
        !nodeIdsSet.has(e.source) && !nodeIdsSet.has(e.target) && !edgeIdsSet.has(e.id);

      return withHistory(state, {
        nodes: state.nodes.filter(filterNode),
        edges: state.edges.filter(filterEdge),
        waterNodes: state.waterNodes.filter(filterNode),
        waterEdges: state.waterEdges.filter(filterEdge),
        selectedNodes: [],
        selectedEdges: [],
      });
    }),
  updateNodeData: (id, data) =>
    set((state) =>
      withHistory(state, {
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
        }),
      })
    ),
  handleChangeLength: (id, length) =>
    set((state) =>
      withHistory(state, {
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
        }),
      })
    ),
  handleChangeFuseSize: (id, fuseSize) =>
    set((state) =>
      withHistory(state, {
        edges: state.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, fuseSize } } : e)),
      })
    ),
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
    const duplicate = activeEdges.some(
      (edge) =>
        edge.source === connection.source &&
        edge.target === connection.target &&
        edge.sourceHandle === connection.sourceHandle &&
        edge.targetHandle === connection.targetHandle
    );
    if (duplicate) return false;

    // Bewusst KEINE generische Zyklusprüfung: Ein funktionierender Stromkreis
    // ist topologisch immer ein Zyklus (Plus-Leitung hin, Minus-Rückleitung
    // zurück). Die Prüfung blockierte den Rückleiter consumer− → battery−,
    // sobald die Plus-Leitung battery+ → consumer+ existierte — und je nach
    // Zeichenreihenfolge umgekehrt. Der Spannungsfall-Walk (cumulativeDropAt)
    // und das Tracing sind gegen echte Zyklen abgesichert (visited-Mengen).

    return true;
  },
  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    // Selbstschleifen (Quelle = Ziel) lehnen auch React Flows addEdge und
    // die Heilung nicht generell ab — sie wären aber topologisch sinnlos
    // und ließen Spannungsfall-Rekursionen über eine Null-Länge-Kante
    // laufen. Hier schon abfangen, statt sie später „heilen" zu müssen.
    if (connection.source === connection.target) return;

    const { viewMode, waterNodes, nodes } = get();

    if (viewMode === 'water') {
      const { nodesMap, waterNodesMap } = getDerivedSystemState(nodes, waterNodes);
      const sourceNode = nodesMap.get(connection.source || '') || waterNodesMap.get(connection.source || '');
      const targetNode = nodesMap.get(connection.target || '') || waterNodesMap.get(connection.target || '');

      if (sourceNode?.type === 'pump' && targetNode?.type === 'sink') {
        get().setWaterWarning('Ein Accumulator schont die Pumpe und verhindert stotternden Wasserfluss.');
        setTimeout(() => get().setWaterWarning(null), 5000);
      }

      const newEdge: Edge = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        id: newEntityId(),
        type: 'waterPipe',
        data: {},
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
      id: newEntityId(),
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
    //
    // M11-2/R-8: performAutoWiring platziert automatisch erzeugte Knoten
    // bereits in Flussrichtung auf dem 16-px-Raster (applyFlowLayout in
    // lib/autoWire/placement.ts) und lässt Nutzerplatzierungen unberührt.
    // Der frühere zusätzliche getLayoutedElements-Pass würde ALLE Knoten
    // erneut in die Funktions-Pipeline-Spalten stapeln — das hob die
    // Flussrichtung wieder auf (Kabel-Umwege, M11-2) und verschob
    // handplatzierte Bauteile. Das Spalten-Layout bleibt dem expliziten
    // „Aufräumen“-Knopf (onLayout) vorbehalten.
    set((state) => withHistory(state, { nodes: [...result.nodes], edges: [...result.edges] }));

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
        window.dispatchEvent(
          new CustomEvent('planner-auto-wired', { detail: { edgeCount: result.edges.length } })
        );
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
      set((state) =>
        withHistory(state, {
          waterNodes: [...layoutedNodes],
          waterEdges: [...layoutedEdges],
          isLayoutPending: true,
        })
      );
    } else {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'LR');
      set((state) =>
        withHistory(state, {
          nodes: [...layoutedNodes],
          edges: [...layoutedEdges],
          isLayoutPending: true,
        })
      );
    }
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
        window.setTimeout(() => set({ isLayoutPending: false }), 300);
      });
    } else {
      set({ isLayoutPending: false });
    }
  },
  applyTemplate: (templateId: string) => {
    const template = TEMPLATES_DICT[templateId];
    if (template) {
      set((state) =>
        withHistory(state, {
          nodes: [...template.nodes],
          edges: [...template.edges],
          // Wasserbewusst NICHT zurücksetzen: die Templates beschreiben nur
          // den Elektrikplan. Ein stiller Kollateralschaden auf waterNodes/
          // waterEdges war Datenverlust (nur über Undo erkennbar zurückholbar).
          selectedNodes: [],
          selectedEdges: [],
        })
      );
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
      id: `${type}-${newEntityId()}`,
      type,
      position,
      data: { label, ...(watts !== undefined ? { watts } : {}) },
    };

    if (type === 'battery') {
      newNode.data = { capacity: 100, chemistry: 'LiFePO4', ...newNode.data };
    } else if (type === 'consumer') {
      newNode.data = { watts: 50, hours: 2, ...newNode.data };
    } else if (
      type === 'charger' ||
      type === 'mpptController' ||
      type === 'dcdcCharger' ||
      type === 'acBatteryCharger'
    ) {
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
  undo: () =>
    set((state) => {
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
  redo: () =>
    set((state) => {
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
  clearPlan: () =>
    set((state) =>
      withHistory(state, {
        nodes: [],
        edges: [],
        waterNodes: [],
        waterEdges: [],
        selectedNodes: [],
        selectedEdges: [],
        firstTappedHandle: null,
      })
    ),
  calculatePathVoltageDrop: (targetNodeId, customNodes, customEdges) => {
    const edges = customEdges || get().edges;
    const nodes = customNodes || get().nodes;
    const signature = plannerGraphSignature(nodes, edges);

    let entry = pathDropCache.get(edges);
    if (!entry || entry.signature !== signature) {
      entry = { signature, nodes, map: new Map() };
      pathDropCache.set(edges, entry);
    }
    const cached = entry.map.get(targetNodeId);
    if (cached !== undefined) return cached;

    // Identische Logik wie die Auto-Wire-Dimensionierung (cumulativeDropAt):
    // Versorgungspfad (Batterie/Landstrom) bevorzugt, sonst bester Ladezweig.
    const sysVoltage = getSystemVoltage(nodes);
    const nodesMap = getNodeMap(nodes, []);
    const value = relevantCumulativeDrop(targetNodeId, nodesMap, edges, nodes, sysVoltage);
    entry.map.set(targetNodeId, value);
    return value;
  },
});
