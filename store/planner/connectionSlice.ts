/**
 * store/planner/connectionSlice.ts
 *
 * Verbindungs-Slice: isValidConnection, onConnect, onDrop, onCustomDrop.
 *
 * Kapselt die fachliche Verbindungserstellung (elektrisch & Wasser) und das
 * Hinzufügen von Knoten per Drag&Drop. Die eigentliche Domain-Logik kommt aus
 * lib/planner/routing.ts und lib/planner/nodeFactory.ts.
 */

import { addPlannerEdge } from '../../lib/planner/reactFlowAdapter';
import {
  createCableEdgeFromConnection,
  createWaterPipeEdgeFromConnection,
  isValidPlannerConnection,
  shouldWarnPumpToSink,
} from '../../lib/planner/routing';
import { createPlannerNode } from '../../lib/planner/nodeFactory';
import { attachRoutedPaths } from '../../lib/planner/routingV2';
import { validateSchematic } from '../../lib/planner/electrical';
import type { ConnectionSliceState, PlannerState, SetState } from './types';
import { nextPlannerId, notifyWaterWarning } from './helpers';

/** Verbindungs- und Drop-Actions des Planner-Stores. */
export function createConnectionSlice(set: SetState, get: () => PlannerState): ConnectionSliceState {
  return {
    isValidConnection: (connection) => {
      const { nodes, waterNodes, viewMode, edges } = get();
      return isValidPlannerConnection({ connection, viewMode, nodes, waterNodes, edges });
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
        // Routing V2: manuell gezogene Kante bekommt sofort einen deterministischen
        // Lane-Versatz + geführten orthogonale Pfad (bleibt im Editor konsistent).
        const routedEdges = attachRoutedPaths(state.nodes, edges);
        return {
          edges: routedEdges,
          vdeValidationResults: validateSchematic(state.nodes, routedEdges),
        };
      });
    },

    onDrop: (event, screenToFlowPosition) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (typeof type === 'undefined' || !type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = createPlannerNode({ id: nextPlannerId(), type, label, position });

      const { viewMode } = get();
      if (viewMode === 'water') {
        set((state) => ({ waterNodes: state.waterNodes.concat(newNode) }));
      } else {
        set((state) => {
          const nodes = state.nodes.concat(newNode);
          return { nodes, vdeValidationResults: validateSchematic(nodes, state.edges) };
        });
      }
    },

    onCustomDrop: (event, screenToFlowPosition) => {
      const customEvent = event as CustomEvent;
      const { clientX, clientY, type, label } = customEvent.detail;

      const position = screenToFlowPosition({ x: clientX, y: clientY });

      const newNode = createPlannerNode({ id: nextPlannerId(), type, label, position });

      const { viewMode } = get();
      if (viewMode === 'water') {
        set((state) => ({ waterNodes: state.waterNodes.concat(newNode) }));
      } else {
        set((state) => {
          const nodes = state.nodes.concat(newNode);
          return { nodes, vdeValidationResults: validateSchematic(nodes, state.edges) };
        });
      }
    },
  };
}
