/**
 * store/planner/baseSlice.ts
 *
 * Basis-Slice: State + Knoten/Kanten-Änderungen + Selektion + VDE-Updates.
 *
 * Enthält den Kernzustand (viewMode, nodes, edges, waterNodes, waterEdges,
 * season, selection, vdeValidationResults) und die unmittelbaren Mutations-
 * Helfer. AutoWire, Layout, BOM und Verbindungen liegen in eigenen Slices.
 */

import { initialNodes, initialEdges } from '../../lib/planner/initialGraph';
import {
  applyPlannerEdgeChanges,
  applyPlannerNodeChanges,
} from '../../lib/planner/reactFlowAdapter';
import { AUTO_WIRE_MANAGED_TYPES } from '../../lib/planner/autoWire';
import { attachRoutedPaths } from '../../lib/planner/routingV2';
import { validateSchematic } from '../../lib/planner/electrical';
import type { BaseSliceState, PlannerState, SetState } from './types';

/**
 * Fügt nur Auto-Wire-verwaltete Komponententypen zur "entfernt"-Liste hinzu,
 * ohne Duplikate zu erzeugen.
 */
function collectRemovedAutoTypes(
  existing: string[],
  types: Array<string | undefined>
): string[] {
  const toAdd: string[] = [];
  for (const type of types) {
    if (
      type &&
      (AUTO_WIRE_MANAGED_TYPES as readonly string[]).includes(type) &&
      !existing.includes(type)
    ) {
      toAdd.push(type);
    }
  }
  if (toAdd.length === 0) return existing;
  return [...existing, ...toAdd];
}

/** Basis-Slice mit reinem State und direkten Mutations-Helfern. */
export function createBaseSlice(set: SetState, get: () => PlannerState): BaseSliceState {
  return {
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

    removedAutoComponents: [],
    markAutoComponentsRemoved: (types) =>
      set((state) => ({
        removedAutoComponents: collectRemovedAutoTypes(
          state.removedAutoComponents,
          types
        ),
      })),

    vdeValidationResults: validateSchematic(initialNodes, initialEdges),
    hasVdeErrors: () => get().vdeValidationResults.some((result) => result.severity === 'error'),

    onNodesChange: (changes) => set((state) => {
      // Entfernte Auto-Wire-Komponenten merken, damit sie nicht erneut
      // automatisch angelegt werden.
      const removedManaged: string[] = [];
      for (const change of changes) {
        if (change.type !== 'remove') continue;
        const node = state.nodes.find((candidate) => candidate.id === change.id);
        if (node?.type) removedManaged.push(node.type);
      }
      const removedAutoComponents = collectRemovedAutoTypes(
        state.removedAutoComponents,
        removedManaged
      );

      const nodes = applyPlannerNodeChanges(changes, state.nodes);
      // Routing V2: Knotenbewegungen (Drag) aktualisieren die geführten Pfade,
      // damit die Kanten an den Knoten "hängen" bleiben und Lanes/Hops synchron sind.
      const edges = attachRoutedPaths(nodes, state.edges);
      return {
        nodes,
        edges,
        removedAutoComponents,
        vdeValidationResults: validateSchematic(nodes, edges),
      };
    }),
    onEdgesChange: (changes) => set((state) => {
      const edges = applyPlannerEdgeChanges(changes, state.edges);
      const routedEdges = attachRoutedPaths(state.nodes, edges);
      return {
        edges: routedEdges,
        vdeValidationResults: validateSchematic(state.nodes, routedEdges),
      };
    }),
    onWaterNodesChange: (changes) => set((state) => ({
      waterNodes: applyPlannerNodeChanges(changes, state.waterNodes),
    })),
    onWaterEdgesChange: (changes) => set((state) => ({
      waterEdges: applyPlannerEdgeChanges(changes, state.waterEdges),
    })),

    onSelectionChange: (params) => set({
      selectedNodes: params.nodes as PlannerState['nodes'],
      selectedEdges: params.edges as PlannerState['selectedEdges'],
    }),

    deleteSelected: () => set((state) => {
      const nodeIdsSet = new Set(state.selectedNodes.map((node) => node.id));
      const edgeIdsSet = new Set(state.selectedEdges.map((edge) => edge.id));

      const removedAutoComponents = collectRemovedAutoTypes(
        state.removedAutoComponents,
        state.selectedNodes.map((node) => node.type)
      );

      const nodes = state.nodes.filter((node) => !nodeIdsSet.has(node.id));
      const edges = state.edges.filter(
        (edge) => !nodeIdsSet.has(edge.source) && !nodeIdsSet.has(edge.target) && !edgeIdsSet.has(edge.id)
      );

      return {
        nodes,
        edges,
        removedAutoComponents,
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
      return { nodes, vdeValidationResults: validateSchematic(nodes, state.edges) };
    }),

    handleChangeLength: (id, length) => set((state) => {
      const edges = state.edges.map((edge) => {
        if (edge.id === id) {
          return { ...edge, data: { ...edge.data!, length } };
        }
        return edge;
      });
      return { edges, vdeValidationResults: validateSchematic(state.nodes, edges) };
    }),

    handleChangeCrossSection: (id, crossSection) => set((state) => {
      const edges = state.edges.map((edge) => {
        if (edge.id === id) {
          return { ...edge, data: { ...edge.data!, crossSection } };
        }
        return edge;
      });
      return { edges, vdeValidationResults: validateSchematic(state.nodes, edges) };
    }),
  };
}
