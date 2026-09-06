/**
 * store/planner/index.ts
 *
 * Komponiert die getrennten Planner-Store-Slices zu einem einzigen Store.
 *
 * Die frühere `usePlannerStore.ts` (429 Zeilen) bündelte State, Actions,
 * AutoWire, Layout, BOM, Node-Erstellung und Validierung. Jetzt ist jede
 * Verantwortlichkeit in einem eigenen Slice gekapselt:
 *
 *   baseSlice         → State + Knoten/Kanten-Änderungen + Selektion + VDE-Updates
 *   connectionSlice   → isValidConnection, onConnect, onDrop, onCustomDrop
 *   autoWireSlice     → autoWireSystem
 *   layoutSlice       → onLayout
 *   bomSlice          → checkSchematic, exportBOM
 */

import { create } from 'zustand';
import { createBaseSlice } from './baseSlice';
import { createConnectionSlice } from './connectionSlice';
import { createAutoWireSlice } from './autoWireSlice';
import { createLayoutSlice } from './layoutSlice';
import { createBomSlice } from './bomSlice';
import type { PlannerState } from './types';

export type { PlannerState } from './types';

/**
 * Komponiert die Slices. Jeder Slice liefert exakt die Felder, für die er
 * zuständig ist (siehe `*SliceState`-Pick-Typen). Die Vereinigung ist damit
 * vollständig für `PlannerState` — ohne `as`-Cast, der Unvollständigkeiten
 * verschleiern würde.
 */
export const usePlannerStore = create<PlannerState>()((set, get) => ({
  ...createBaseSlice(set, get),
  ...createConnectionSlice(set, get),
  ...createAutoWireSlice(set, get),
  ...createLayoutSlice(set, get),
  ...createBomSlice(set, get),
}));
