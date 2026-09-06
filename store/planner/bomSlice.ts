/**
 * store/planner/bomSlice.ts
 *
 * BOM-/Report-Slice: checkSchematic, exportBOM.
 *
 * Erzeugt die Stückliste (BOM) bzw. stößt die Schaltplan-Prüfung an und
 * verteilt sie über ein CustomEvent an die UI. Keine direkte UI-Abhängigkeit.
 */

import { calculateBom } from '../../lib/planner/bom';
import type { BomSliceState, PlannerState, SetState } from './types';

/** BOM- und Report-Actions des Planner-Stores. */
export function createBomSlice(set: SetState, get: () => PlannerState): BomSliceState {
  return {
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
      const bom = calculateBom(nodes, edges);
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('export-bom', { detail: bom });
        window.dispatchEvent(event);
      }
    },
  };
}
