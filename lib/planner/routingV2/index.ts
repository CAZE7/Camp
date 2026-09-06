/**
 * lib/planner/routingV2/index.ts
 *
 * Öffentliche API von Routing V2.
 *
 * Bündelt die zuvor getrennten Bausteine zu einem kohärenten geometrischen
 * Routing-Modell:
 *   - tokens          (GEOMETRY / geometryTokens)  → Single Source of Truth
 *   - collision       → Collision Engine
 *   - laneRegistry    → deterministische Trassen-Zuordnung
 *   - costModel       → Kostenbewertung
 *   - hopping         → Crossing-Hopping
 *   - elkAdapter      → ELK-Layout (mit dagre-Fallback)
 */
export * from '../geometry';
export * from './collision';
export * from './laneRegistry';
export * from './costModel';
export * from './hopping';
export * from './elkAdapter';
export * from './orchestrator';
