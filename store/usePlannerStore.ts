/**
 * store/usePlannerStore.ts
 *
 * Backward-kompatible Fassade des Planner-Stores.
 *
 * Die eigentliche Logik liegt nun in `store/planner/` und ist in klar
 * getrennte Slices aufgeteilt (base, connection, autoWire, layout, bom).
 * Diese Datei re-exportiert den Store, damit alle bestehenden Aufrufer
 * (Komponenten, Tests) unverändert funktionieren.
 */
export { usePlannerStore } from './planner';
export type { PlannerState } from './planner';
