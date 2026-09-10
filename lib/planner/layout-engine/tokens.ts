/**
 * lib/planner/layout-engine/tokens.ts
 *
 * Layout-Tokens für die Knotenplatzierung (ELK, Dagre).
 *
 * ABGELEITET, NICHT DUPLIZIERT: Alle Werte, die sich Layout und Routing
 * teilen, kommen aus `lib/routing/tokens.ts` — der einzigen Quelle für
 * Abstände im Projekt. Hier stehen ausschließlich Werte, die es NUR beim
 * Layout gibt (Vorgabegrößen für unvermessene Knoten, Layer-Abstände).
 *
 * Vorgeschichte: Bis zur Konsolidierung (ADR 0014/0015) gab es mit
 * `lib/planner/tokens.ts` eine zweite Datei, die im Kommentar ebenfalls
 * „SINGLE SOURCE OF TRUTH" für dieselben Abstände beanspruchte — inklusive
 * eines Kostenmodells, das Kollisionen mit `collision: 100_000` als teuer
 * statt als verboten führte. Zwei Dateien, die beide die Wahrheit sein
 * wollen, sind keine Wahrheit. Die Datei ist entfernt; geteilte Werte
 * werden ab hier importiert, damit sie gar nicht mehr auseinanderlaufen
 * KÖNNEN.
 */

import { ROUTING_TOKENS } from '../../routing/tokens';

export const LAYOUT_TOKENS = {
  /** Geteilt — Mindestabstand Kabel ↔ fremdes Objekt. */
  cableClearance: ROUTING_TOKENS.cableClearance,

  /** Geteilt — Abstand zwischen Domänen (Elektrik ↔ Wasser). */
  crossDomainSpacing: ROUTING_TOKENS.crossDomainSpacing,

  /** Abstand Kante ↔ Knoten: zwei Clearances, damit beidseitig Luft bleibt. */
  edgeNodeSpacing: ROUTING_TOKENS.cableClearance * 2,

  /** Abstand paralleler Kanten derselben Domäne. */
  edgeEdgeSpacing: ROUTING_TOKENS.cableClearance,

  /** ELK-Begriff: Abstand Kante ↔ Knoten über Layer-Grenzen hinweg. */
  edgeNodeBetweenLayers: ROUTING_TOKENS.cableClearance * 2,

  /** Abstand zwischen Bauteilen/Strängen. */
  componentComponentSpacing: ROUTING_TOKENS.cableClearance * 2,

  /** Vorgabebreite, wenn ein Knoten keine gemessene Breite mitbringt. */
  defaultNodeWidth: 120,

  /** Vorgabehöhe, wenn ein Knoten keine gemessene Höhe mitbringt. */
  defaultNodeHeight: 80,
} as const;
