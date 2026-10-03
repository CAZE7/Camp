import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';

/**
 * Aufnahmefähigkeit eines Port-Korridors — die Geometrie hinter ROUTE-BUG-31/32/37.
 *
 * ## Warum es diese Datei gibt
 *
 * An einem Port hängt selten nur eine Leitung. Der Port-Fan-Out staffelt die
 * Kanten deshalb um je ein Lane-Raster: Kante mit Rang `r` knickt erst nach
 * `stubMin + r · laneGrid` px ab. Der Port-Frame kappt diesen Wunsch an der
 * Bauteil-Freigabe (`stubCapFor` = Abstand zur nächsten fremden Box minus
 * `cableClearance`). Damit die Staffelung überhaupt Platz hat, muss der freie
 * Korridor den tiefsten Stub tragen:
 *
 *     nötiger freier Korridor (K Kabel) = stubMin + (K−1) · laneGrid
 *     Aufnahmefähigkeit (freier Korridor D) = 1 + ⌊(D − stubMin) / laneGrid⌋
 *
 * Beide Formeln sind reine Token-Arithmetik — keine eigenen Zahlen, keine
 * zweite Wahrheit. Bezugsgröße ist ausdrücklich der **freie** Korridor, also
 * `stubCapFor(...)` (der `cableClearance`-Anteil ist dort schon abgezogen);
 * `requiredRawCorridor` liefert dieselbe Größe für den rohen Boxabstand.
 *
 * ## Gemessener Anlass (2026-10-03, `complex`)
 *
 * Vor der Layout-Korrektur lagen die Sammelschienen so, dass dem Minus-Bündel
 * nur 48 px freier Korridor blieben. Für vier Leitungen braucht die Staffelung
 * 72 px (24 / 40 / 56 / 72) — es ist geometrisch unmöglich, vier Lanes mit
 * `cableClearance` in 48 px zu legen. Die harte Kappung presste die Ränge
 * zusammen; gemessen blieben zwei Paare mit 4 px Abstand (I3, Vektoren
 * (514.4,652)→(668,652) gegen (610,656)→(514.4,656) und die Entsprechung bei
 * y = 636/640). Genau dieser Kanal ist die belegte Wurzel des Rests.
 *
 * Die Kapazität ist ein **hinreichendes Layout-Kriterium**, keine Invariante:
 * Ein zu enger Korridor garantiert Probleme, ein rechnerisch knapper nicht
 * zwingend (wechselt ein Kabel die Seite, sinkt die Bündelgröße). Deshalb
 * prüft `scripts/routing/portCapacity.test.ts` die sechs Referenzpläne gegen
 * ihre gemessenen Bündel und hält die eine verbliebene, begründete
 * Über-Kapazität (`camper`, Minus-Schiene) in einer Liste fest.
 */

/** Nötiger FREIER Korridor (nach Abzug von `cableClearance`) für `bundleSize` Kabel. */
export function requiredPortCorridor(bundleSize: number, tokens: RoutingTokens = ROUTING_TOKENS): number {
  const lanes = Math.max(0, Math.floor(bundleSize) - 1);
  return tokens.stubMin + lanes * tokens.laneGrid;
}

/**
 * Nötiger ROHEr Korridor (Abstand Port → fremde Box) für `bundleSize` Kabel —
 * dieselbe Größe wie die Eingangsseite von `stubCapFor`.
 */
export function requiredRawCorridor(bundleSize: number, tokens: RoutingTokens = ROUTING_TOKENS): number {
  return requiredPortCorridor(bundleSize, tokens) + tokens.cableClearance;
}

/** Wie viele Kabel passen in einen FREIEN Korridor der Länge `free` (s. `stubCapFor`)? */
export function portCapacity(free: number, tokens: RoutingTokens = ROUTING_TOKENS): number {
  if (!Number.isFinite(free)) return Number.POSITIVE_INFINITY;
  const usable = Math.max(0, free - tokens.stubMin);
  return 1 + Math.floor(usable / tokens.laneGrid);
}
