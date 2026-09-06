/**
 * lib/vde-standards.ts
 *
 * Backward-kompatible Barrel-Datei.
 *
 * Historisch lag hier die gesamte VDE-Logik in einer großen Datei (551 Zeilen)
 * mit mehreren Verantwortlichkeiten. Diese ist nun in `lib/planner/electrical/`
 * aufgeteilt (Standards, Ampacity, VoltageDrop, FuseSizing, CableSizing,
 * Conduit, Validation).
 *
 * Diese Datei re-exportiert nur noch — alle bestehenden Imports
 * (`import { ... } from '../vde-standards'`) funktionieren unverändert weiter.
 */
export * from './planner/electrical';
