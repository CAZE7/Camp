/**
 * lib/planner/autoWire.ts
 *
 * Backward-kompatible Fassade der AutoWire-Pipeline.
 *
 * Die eigentliche Logik liegt nun in `lib/planner/autowire/` und ist in klar
 * getrennte Stufen aufgeteilt (Analyse → Topologie → Wiring Strategy →
 * Sizing → Routing → Result). Diese Datei re-exportiert nur noch, damit alle
 * bestehenden Aufrufer (Store, Tests) unverändert funktionieren.
 */
export {
  AUTO_WIRE_MISSING_BATTERY_MESSAGE,
  AUTO_WIRE_MULTIPLE_BATTERIES_MESSAGE,
  AUTO_WIRE_MANAGED_TYPES,
  planAutoWiringPipeline as planAutoWiring,
} from './autowire';
export type { AutoWireOptions, AutoWireResult } from './autowire';
