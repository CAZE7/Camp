/**
 * store/planner/layoutSlice.ts
 *
 * Layout-Slice: onLayout.
 *
 * Nutzt die Routing-V2-Pipeline (`routeSchematicV2`): Layout über ELK
 * (mit dagre-Fallback), deterministische Lanes/Hops über die Collision Engine,
 * Kostenentscheidung über das Cost-Modell. Die Kanten erhalten die geführten
 * Pfade (data.routedPath + data.lane) und die VDE-Ergebnisse werden neu
 * validiert.
 */

import { routeSchematicV2 } from '../../lib/planner/routingV2';
import { validateSchematic } from '../../lib/planner/electrical';
import type { LayoutSliceState, SetState } from './types';
import { fitViewOnNextFrame } from './helpers';
import type { PlannerState } from './types';

/** Layout-Actions des Planner-Stores. */
export function createLayoutSlice(set: SetState, get: () => PlannerState): LayoutSliceState {
  return {
    onLayout: async (fitView) => {
      const { nodes, edges } = get();
      const result = await routeSchematicV2({ nodes, edges, direction: 'LR' });

      const finalNodes = result.nodes;
      const finalEdges = result.edges;
      set({
        nodes: finalNodes,
        edges: finalEdges,
        vdeValidationResults: validateSchematic(finalNodes, finalEdges),
      });

      fitViewOnNextFrame(fitView);
    },
  };
}
