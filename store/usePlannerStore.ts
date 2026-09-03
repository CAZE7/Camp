import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createUiSlice } from './slices/uiSlice';
import { createGraphSlice } from './slices/graphSlice';
import { persistOptions } from './slices/persistence';
import type { PlannerState } from './slices/types';

/**
 * Planner-Store — Komposition aus Zustand-Slices (M6-5).
 *
 * Die öffentliche Schnittstelle (usePlannerStore, getDerivedSystemState,
 * plannerGraphSignature) ist unverändert; die Implementierung liegt in:
 *
 *   store/slices/types.ts        PlannerState + GraphSnapshot + Slice-Typ
 *   store/slices/uiSlice.ts      Ansicht, Panels, Saison, Selektions-Flags
 *   store/slices/graphSlice.ts   Graph, Auto-Wire, Layout, History
 *   store/slices/graphInternals.ts  Caches/Helper des Graph-Slices
 *   store/slices/persistence.ts  localStorage-Vertrag (Version/Migration)
 *
 * Persist wird bewusst hier (und nicht pro Slice) angewendet: Der gespeicherte
 * Stand ist EIN Dokument ('werft-planner-v1') mit gemeinsamen Versionsschritt.
 * Zwei persistierte Slices würden zwei Versionspläne bedeuten, die bei
 * Migrationen gegen einander laufen können.
 */
export const usePlannerStore = create<PlannerState>()(
  persist<PlannerState, [], [], Partial<PlannerState>>(
    (...args) => ({ ...createUiSlice(...args), ...createGraphSlice(...args) }),
    persistOptions
  )
);

export type { PlannerState, GraphSnapshot } from './slices/types';
export { getDerivedSystemState, plannerGraphSignature } from './slices/graphInternals';
export { PLANNER_STORAGE_VERSION, migratePlannerPersisted } from './slices/persistence';
