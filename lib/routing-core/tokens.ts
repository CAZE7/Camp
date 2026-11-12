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

import { LEGACY_ROUTING_TOKENS, ROUTING_TOKENS } from '../routing/tokens';

export type CoreTokens = {
  /** Aufblähung der Hindernis-Rechtecke (px) — größte Freigabe-Stufe. */
  readonly obstacleMargin: number;
  /**
   * Freigabe-Leiter (§5.1). Der Kern sucht zuerst mit vollem Rand, dann mit
   * engerem, zuletzt mit Rohbox + 2 px — dieselbe Kaskade, die der
   * Bestandsrouter als „gelockerte Freigabe" fährt. Die Stufen sind
   * absteigend sortiert und enthalten `obstacleMargin` als erste.
   */
  readonly marginLadder: readonly number[];
  /** Knickstrafe in px-Äquivalent. */
  readonly bendCost: number;
  /** Kreuzungsstrafe in px-Äquivalent. */
  readonly crossingCost: number;
  /** Preis je Einheit Überlast im Verhandlungsverfahren. */
  readonly presentPenalty: number;
  /** Zuwachs der History-Strafe je Konflikt-Iteration. */
  readonly historyIncrement: number;
  /** Obergrenze der Verhandlungs-Iterationen (Sicherheitsnetz). */
  readonly maxNegotiationIterations: number;
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
  /** Sperrradius eines reservierten Stubs (px) — nur echte Berührung. */
  readonly stubReserveMargin: number;
};

export const CORE_TOKENS: CoreTokens = Object.freeze({
  obstacleMargin: LEGACY_ROUTING_TOKENS.obstacleMargin,
  marginLadder: [14, 8, 2],
  bendCost: 80,
  crossingCost: 120,
  presentPenalty: 60,
  historyIncrement: 40,
  maxNegotiationIterations: 8,
  maxCrossingPasses: 3,
  maxExpansions: 200_000,
  stubMin: ROUTING_TOKENS.stubMin,
  segmentMin: ROUTING_TOKENS.segmentMin,
  bendRadius: ROUTING_TOKENS.bendRadius,
  laneGrid: ROUTING_TOKENS.laneGrid,
  clearance: ROUTING_TOKENS.cableClearance,
  stubReserveMargin: 2,
});
