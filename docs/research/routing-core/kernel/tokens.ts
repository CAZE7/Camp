/**
 * Tokens des globalen Routing-Kerns (Phase 2).
 *
 * Regel E des Repos verbietet Geometrie-Zahlen außerhalb der Tokens. Der Kern
 * erbt deshalb alle Abstände aus `ROUTING_TOKENS` und deklariert nur die
 * Werte, die es dort noch nicht gibt (Suchgewichte, Iterationslimits).
 * Die Suchgewichte sind **bewusst** identisch zu den Werten des Bestandsrouters
 * (`BEND_COST = 80`, `COST_WEIGHTS.crossing = 120`, `OBSTACLE_MARGIN = 14`):
 * der A/B-Vergleich soll an der Suche scheitern oder gewinnen, nicht an
 * abweichenden Gewichten.
 */

import { LEGACY_ROUTING_TOKENS, ROUTING_TOKENS } from '../../../../lib/routing/tokens';

export type CoreTokens = {
  /** Aufblähung der Hindernis-Rechtecke (px) — größte Freigabe-Stufe. */
  readonly obstacleMargin: number;
  /**
   * Freigabe-Leiter (§5.1). Der Kern sucht zuerst mit vollem Rand (14 px),
   * dann mit genau der Clearance (12 px).
   *
   * **Keine Stufe unter `cableClearance`.** Die frühere Leiter endete bei
   * 8 und 2 px und war damit eine eingebaute I3-Verletzung: was die Suche als
   * „engere Freigabe" benutzte, war für die Prüfinstanz ein Fehler. Eine
   * Lockerung, die eine Invariante bricht, ist keine Lockerung, sondern ein
   * Fehler mit anderem Namen.
   */
  readonly marginLadder: readonly number[];
  /** Knickstrafe in px-Äquivalent. */
  readonly bendCost: number;
  /** Kreuzungsstrafe in px-Äquivalent. */
  readonly crossingCost: number;
  /** Preis je Einheit Überlast im Verhandlungsverfahren. */
  readonly presentPenalty: number;
  /**
   * Preis für einen Schritt, der fremder Klarheit zu nah kommt (I3).
   *
   * Bewusst ein **Preis** und keine Sperre: eine Sperre kann eine Verhandlung
   * nicht mehr auflösen — der erste Lauf gewinnt, alle folgenden müssen
   * Umwege nehmen oder fallen aus. Mit einem hohen Preis bleibt jeder Pfad
   * erreichbar, und die Verhandlung hat etwas zu tauschen.
   */
  readonly proximityPenalty: number;
  /**
   * Reihenfolge der Klarheits-Modi. `strict` verbietet paralleles
   * Nebeneinanderlaufen unter der Clearance; `priced` bepreist es. Der zweite
   * Modus ist die **dokumentierte Enge**: er greift nur, wenn mit strikter
   * Klarheit gar kein Weg existiert, und das Ergebnis geht durch das Gate —
   * ein Verstoß wird dort sichtbar und nicht stillschweigend veröffentlicht.
   */
  readonly clearanceModes: readonly ('strict' | 'priced')[];
  /** Zuwachs der History-Strafe je Konflikt-Iteration. */
  readonly historyIncrement: number;
  /** Obergrenze der Verhandlungs-Iterationen (Sicherheitsnetz). */
  readonly maxNegotiationIterations: number;
  /** Vorzeitiger Abbruch nach so vielen Iterationen ohne bessere Konfliktlage. */
  readonly maxStagnantNegotiationIterations: number;
  /** Obergrenze der Kreuzungs-Refinement-Runden. */
  readonly maxCrossingPasses: number;
  /** Obergrenze der A*-Expansionen je Kante (Abbruch ⇒ Kante gilt als unverlegbar). */
  readonly maxExpansions: number;
  /** Stub-Mindestlänge (px). */
  readonly stubMin: number;
  /** Segment-Mindestlänge (px). */
  readonly segmentMin: number;
  /** Eckenradius; Schwelle des Bend-Merge (I7). */
  readonly bendRadius: number;
  /** Rasterweite paralleler Lanes (px). */
  readonly laneGrid: number;
  /** Mindestabstand Kabel ↔ fremdes Bauteil/Kabel (px). */
  readonly clearance: number;
  /**
   * Sperrradius eines reservierten Stubs (px) — nur echte Berührung.
   *
   * Die 12-px-Clearance wird für Anschlüsse **nicht** über Sperrflächen
   * erzwungen, sondern über das Klarheitsfeld bepreist. Eine harte Sperre mit
   * Clearance-Radius dichtet auf dichten Plänen jeden Korridor um jeden
   * Anschluss ab; das Ergebnis war „nichts routebar" statt „eng geroutet".
   */
  readonly stubReserveMargin: number;
};

export const CORE_TOKENS: CoreTokens = Object.freeze({
  obstacleMargin: LEGACY_ROUTING_TOKENS.obstacleMargin,
  marginLadder: [14, 12],
  bendCost: 80,
  crossingCost: 120,
  presentPenalty: 400,
  proximityPenalty: 2500,
  clearanceModes: ['strict', 'priced'] as const,
  historyIncrement: 200,
  maxNegotiationIterations: 8,
  maxStagnantNegotiationIterations: 1,
  maxCrossingPasses: 1,
  maxExpansions: 200_000,
  stubMin: ROUTING_TOKENS.stubMin,
  segmentMin: ROUTING_TOKENS.segmentMin,
  bendRadius: ROUTING_TOKENS.bendRadius,
  laneGrid: ROUTING_TOKENS.laneGrid,
  clearance: ROUTING_TOKENS.cableClearance,
  stubReserveMargin: 2,
});
