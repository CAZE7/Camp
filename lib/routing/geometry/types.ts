/**
 * WP-2 (#392): Basistypen der Geometrie-Schicht (Schicht 1, ROUTING-V2.md §2.3).
 *
 * Strukturell identisch zu den bisherigen Typen in `pathfinding.ts` /
 * `orthogonalRouting.ts` — TypeScript-strukturtypisiert sind beide Welten
 * austauschbar; die Router re-exportieren diese Typen weiter.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Segment = [Point, Point];

/**
 * Numerik-Epsilons — exakt die Werte der bisherigen Router-Implementierungen
 * (Verhalten byte-identisch, Golden Master bleibt gültig).
 */
export const EPS = 1e-6;
export const ORIENT_EPS = 1e-9;
