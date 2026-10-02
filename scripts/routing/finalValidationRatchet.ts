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
 * - **I2 ist 0** über alle sechs Referenzpläne (gemessen 2026-10-02; die
 *   früheren Port-Restfälle sind seit der Platzierungs-Freigabe
 *   `portFacingClearance = 68`, ADR 0027, behoben).
 * - **I3 läuft über diese Ratchet.** Eine Layout-Änderung verschiebt
 *   Verletzungen zwischen den Kategorien (rücken Bauteile auseinander,
 *   verschwinden Durchdringungen und es entstehen enge Parallelläufe). Eine
 *   Obergrenze PRO PLAN hält den Druck aufrecht, ohne echte Verbesserungen zu
 *   bestrafen. Die Werte dürfen sinken — dann sind sie nachzuziehen —, aber
 *   nie steigen.
 *
 * Zahlenstand 2026-10-02 (ADR 0031): Seit die Port-Bündel-Ausnahme
 * (ADR 0009/0025) SYMMETRISCH für I2 und I3 gilt — zwei Kanten an
 * derselben Anschlussstelle konvergieren zwangsläufig auf gemeinsamem
 * Stub/Fan-Out-Jog; I3 zählte genau diese Geometrie als Verletzung —,
 * zählt die Ratchet nur noch ECHTE Restfälle: Paare ohne gemeinsame
 * Anschlussstelle sowie Unterschreitungen an freien (gesuchten)
 * Trassensegmenten. Davor: 6/21/4/12/13/42 (Σ 98), davon 69 strukturelle
 * Bündel-Fälle. Die I3-Segment×Segment-Prüfung selbst (AUDIT ROUTE-012)
 * bleibt unverändert scharf.
 */
export const FINAL_VALIDATION_RATCHET: Readonly<Record<string, number>> = {
  simple: 2,
  camper: 7,
  solar: 0,
  inverter: 6,
  acdc: 3,
  complex: 23,
};

/**
 * Obergrenze eines Plans. Für Pläne ohne Eintrag gilt **0**: Ein neuer
 * Referenzplan muss seine Ratchet ausdrücklich bekommen, statt stillschweigend
 * ungeprüft durchzulaufen.
 */
export const finalValidationRatchetOf = (plan: string): number => FINAL_VALIDATION_RATCHET[plan] ?? 0;
