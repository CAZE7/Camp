/**
 * components/planner/utils/backbone.ts — KERN-VERTEILUNGSSTRUKTUR (Trasse).
 *
 * Kanten zwischen Kern-Knoten bilden die Hauptrouten (Backbone); Abgänge zu
 * Verbrauchern/Ladequellen sind Zweige. Der Router bevorzugt das Backbone
 * beim Hüpfen (siehe `lib/routing/rules/hopping.ts`, Gewicht 1000) —
 * ein Zweig (z. B. 1,5 mm² zum Kühlschrank) zwingt die Hauptleitung nie
 * zum Umweg. Kern-Aussage: „Backbone bleibt gerade, Abzweig hüpft".
 *
 * DC-Kern (seit V1): Batterie, Busbar, Smart Shunt, Sicherungskasten.
 * AC-Kern (V2, ROUTE-003): Wechselrichter, Landstromanschluss, FI/LS-Kasten,
 *    AC-Verteilung. Kanten zwischen diesen AC-Kern-Knoten bilden den
 *    AC-Backbone (230-V-Trasse), sonst würde der RCD/LS-Abgang die
 *    Wechselrichter-Steckdose kreuzen.
 */

const DC_CORE_TYPES = new Set(['battery', 'busbar', 'shunt', 'fuse']);

const AC_CORE_TYPES = new Set([
  'inverter',
  'shorepower', // Landstromanschluss
  'ac_distribution', // FI/LS-Verteiler / AC-Unterverteilung
]);

/**
 * Jede Kante zwischen zwei Kern-Knoten der selben Domäne wird als Backbone
 * behandelt. DC-Kern-Knoten sind Batterie/Sammelschiene/Shunt/Sicherung;
 * AC-Kern-Knoten sind Wechselrichter/Landstrom/AC-Verteiler. Misch-Domänen
 * sind nie Backbone (Batterie → Wechselrichter ist ein Adapter-Pfad, keine
 * Trasse).
 *
 * Nicht-Kern-Knoten (Verbraucher, Ladequellen, Sicherungsautomaten) erzeugen
 * IMMER Zweige, auch wenn sie dünne 1,5-mm²-Leitungen tragen.
 */
export function isBackboneConnection(sourceType?: string, targetType?: string): boolean {
  if (!sourceType || !targetType) return false;
  if (DC_CORE_TYPES.has(sourceType) && DC_CORE_TYPES.has(targetType)) return true;
  if (AC_CORE_TYPES.has(sourceType) && AC_CORE_TYPES.has(targetType)) return true;
  return false;
}

/**
 * V2: Liste der AC-Kern-Typen zur Abfrage durch den Router/Rendering —
 * die optische Hervorhebung als Trasse (im BackboneGroupNode) soll AC-
 * Kernkanten ebenso behandeln wie die DC-Kernkabel.
 */
export function isAcBackboneNode(type?: string): boolean {
  return !!type && AC_CORE_TYPES.has(type);
}

export function isDcBackboneNode(type?: string): boolean {
  return !!type && DC_CORE_TYPES.has(type);
}
