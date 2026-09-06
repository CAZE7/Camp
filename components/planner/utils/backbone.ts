/**
 * Kern-Verteilungsstruktur ("Trasse") des Elektrikplans: Batterie, Busbar,
 * Smart Shunt und Sicherungskasten. Kanten zwischen diesen Kern-Knoten bilden
 * die Hauptrouten (Backbone); Abgänge zu Verbrauchern/Ladequellen sind Zweige.
 */

const CORE_TYPES = new Set(['battery', 'busbar', 'shunt', 'fuse']);

export function isBackboneConnection(sourceType?: string, targetType?: string): boolean {
  return !!sourceType && !!targetType && CORE_TYPES.has(sourceType) && CORE_TYPES.has(targetType);
}
