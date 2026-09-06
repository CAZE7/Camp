/**
 * WP-2 (#392): Geometrie-Schicht (Schicht 1) — öffentliche Oberfläche.
 *
 * Pure Functions, kein Domänenwissen, Werte aus den Tokens (WP-1).
 * Kollisionsmodell (WP-3), LaneRegistry (WP-5), A*-Kostenmodell (WP-6),
 * Hopping (WP-7), Re-Routing (WP-8) und Fan-Out (WP-9) bauen ausschließlich
 * auf dieser Schicht auf.
 */

export * from './types';
export * from './segments';
export * from './rects';
export * from './polyline';
