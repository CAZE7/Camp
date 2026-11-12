/**
 * CAMP Global Routing Engine — öffentliche Oberfläche (Phase 2).
 *
 * Bewusst klein: Eingabe rein, Routen raus, Prüfbericht dazu. Keine
 * Seiteneffekte, kein Zustand, kein DOM, kein React.
 * Spezifikation: `docs/research/routing-core/GLOBAL-ROUTING-SPEC.md`.
 */
export { routeCore, crossingPairs } from './engine';
export { validateCore, totalCrossingPairs, type CoreValidation } from './validate';
export { CORE_TOKENS, type CoreTokens } from './tokens';
export type {
  CoreEdge,
  CoreHandle,
  CoreInput,
  CoreMetrics,
  CoreNode,
  CoreResult,
  CoreRoute,
  CoreRouteKind,
  CoreSide,
  CoreUnroutable,
} from './model';
