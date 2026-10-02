/**
 * scripts/routing/finalValidationRatchet.ts
 *
 * Obergrenze der I2/I3-Verletzungen je Referenzplan — die EINE Quelle für
 * beide Tore, die dieselbe Messung bewerten:
 *
 *   - `finalValidation.test.ts` (Vitest, läuft im Quality Gate mit)
 *   - `routing:audit` (eigener CI-Schritt)
 *
 * Zwei Kopien derselben Zahlen wären der klassische Fall aus ADR 0015: Sie
 * stimmen so lange überein, bis jemand eine davon ändert — und dann still.
 *
 * Zur Einordnung (ADR 0015 „Harte Final-Invariante"):
 *
 * - **I1 ist hart.** Eine Leitung, die durch ein fremdes Bauteil läuft, ist in
 *   einer Planungssoftware mit Sicherheitsbezug kein Kompromiss, sondern
 *   falsch. I1 wird überall auf 0 geprüft, ohne Spielraum.
 * - **I2/I3 laufen über diese Ratchet.** Eine Layout-Änderung verschiebt
 *   Verletzungen zwischen den Kategorien (rücken Bauteile auseinander,
 *   verschwinden Durchdringungen und es entstehen enge Parallelläufe). Eine
 *   Obergrenze PRO PLAN hält den Druck aufrecht, ohne echte Verbesserungen zu
 *   bestrafen. Die Werte dürfen sinken — dann sind sie nachzuziehen —, aber
 *   nie steigen.
 *
 * Die Zahlen sind der gemessene Stand nach AUDIT ROUTE-012: Die Prüfung I3
 * war zuvor nur Segment×Node; seit sie auch Segment×Segment abdeckt, sind
 * diese Verletzungen sichtbar (sie waren vorher schon da).
 */
export const FINAL_VALIDATION_RATCHET: Readonly<Record<string, number>> = {
  simple: 6,
  camper: 21,
  solar: 4,
  inverter: 12,
  acdc: 13,
  complex: 42,
};

/**
 * Obergrenze eines Plans. Für Pläne ohne Eintrag gilt **0**: Ein neuer
 * Referenzplan muss seine Ratchet ausdrücklich bekommen, statt stillschweigend
 * ungeprüft durchzulaufen.
 */
export const finalValidationRatchetOf = (plan: string): number => FINAL_VALIDATION_RATCHET[plan] ?? 0;
