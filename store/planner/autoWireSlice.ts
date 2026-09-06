/**
 * store/planner/autoWireSlice.ts
 *
 * AutoWire-Slice: autoWireSystem.
 *
 * Fasst die Planung (lib/planner/autoWire → entkoppelte Pipeline) mit der
 * Routing-V2-Pipeline (`routeSchematicV2`, ELK mit dagre-Fallback) und der
 * VDE-Neuvalidierung zusammen.
 */

import { planAutoWiring } from '../../lib/planner/autoWire';
import { routeSchematicV2 } from '../../lib/planner/routingV2';
import { validateSchematic } from '../../lib/planner/electrical';
import type { AutoWireSliceState, SetState } from './types';
import { fitViewOnNextFrame, nextPlannerId } from './helpers';
import type { PlannerState } from './types';

/** AutoWire-Actions des Planner-Stores. */
export function createAutoWireSlice(set: SetState, get: () => PlannerState): AutoWireSliceState {
  return {
    autoWireSystem: async (fitView) => {
      const { nodes } = get();
      const result = planAutoWiring(nodes, { idFactory: nextPlannerId });

      if (!result.ok) {
        if (typeof window !== 'undefined') {
          window.alert(result.message);
        }
        return;
      }

      const layoutResult = await routeSchematicV2({
        nodes: result.nodes,
        edges: result.edges,
        direction: 'LR',
      });

      const finalNodes = layoutResult.nodes;
      const finalEdges = layoutResult.edges;
      set({
        nodes: finalNodes,
        edges: finalEdges,
        vdeValidationResults: validateSchematic(finalNodes, finalEdges),
      });

      fitViewOnNextFrame(fitView);
    },
  };
}
