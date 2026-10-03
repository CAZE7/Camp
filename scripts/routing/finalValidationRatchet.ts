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
 * Zahlenstand 2026-10-03 (ADR 0033 — Trenngang + Korridor-Kapazität): Alle
 * sechs Pläne stehen bei **0**. Drei gemessene Ursachen des Rests sind
 * behoben, jede mit eigener Regression:
 *
 *  1. Der Abschluss-Gang `separateCableClearance` (ADR 0033) stellt die
 *     Freigabe her, statt sie nur teuer zu machen: er verschiebt innere
 *     Segmente und nimmt einen Zug nur bei STRENG sinkender Verstoßzahl an
 *     (plus Wächter gegen neue Hindernis-Treffer, neue Kreuzungen und
 *     Umweg-Länge). Ergebnis ohne jede Layout-Änderung: camper 7→0,
 *     inverter 7→0, acdc 7→2, complex 25→3.
 *  2. `closestLocusArcs` ordnete im senkrechten Zweig die Kandidatenpunkte
 *     dem falschen Pfad zu (`hs`/`vs` sind gegenüber `(s1,s2)` vertauscht).
 *     Ein legitimer Bündel-Fall (complex: e-fuse-fridge ↔ e-fuse-fan, Bögen
 *     38/40 im Korridor) zählte deshalb als I3. Fix + Regression in
 *     `lib/routing/rules/portBundle.test.ts` (complex 3→0 bzw. acdc 2→0).
 *  3. Der Referenzplan `complex` hatte am Minus-Port ein übervolles Bündel:
 *     48 px freier Korridor, vier Leitungen brauchen 72 px
 *     (`lib/routing/rules/portCapacity.ts`). Die harte Kappung erzeugte zwei
 *     4-px-Parallelläufe. Korrektur der Vorlage (`busbar-plus` 500→496,
 *     `busbar-minus` 680→688) — danach ist KEIN Port-Bündel der sechs Pläne
 *     über Kapazität (Test: `scripts/routing/portCapacity.test.ts`).
 *
 * Kreuzungen: complex 27→25 (Ratchet nachgezogen), alle übrigen unverändert.
 * Der Versatz-Gate (`SHIFT_RATCHET`) verbessert sich mit: I3 je Plan
 * 25/26/0/10/24/0 statt 130/469/45/75/180/1225.
 *
 * Zahlenstand 2026-10-03 (ADR 0031 v2 — Locus-Regel): Die erste Fassung der
 * Port-Bündel-Ausnahme (2026-10-02) steckte die Freistellung in ein
 * SEGMENT-FENSTER (die ersten N Stützpunkte je Kante). Das Fenster war
 * zu grob: Es hat 8 Paare über-freigestellt, die KEINE legitimen
 * Bündel-Fälle sind (nächste Annäherung weiter als `portFacingClearance`
 * vom gemeinsamen Port, oder gar kein gemeinsamer Port). Die Locus-Fassung
 * misst stattdessen die Bogenlänge der nächsten Annäherung auf BEIDEN
 * Pfaden vom gemeinsamen Port aus (`isPortBundleProximity`,
 * `arcAt` mit `portAtStart`) — dieselbe Messweise wie die I2-Ausnahme,
 * eine Wahrheit (ADR 0031).
 *
 * RECATURE-LEDGER 2026-10-03 (Ratchet darf grundsätzlich nur sinken —
 * Anstieg nur mit dokumentierter Begründung): Die vier angestiegenen
 * Werte (solar 0→1, inverter 6→7, acdc 3→7, complex 23→25) sind reine
 * CHECKER-Verschärfung, KEINE Router-Änderung: Der Routing-Output aller
 * sechs Referenzpläne ist byte-identisch zum Stand der alten Messung
 * (verify via `serializeRoutes`, gemessen gegen Commit b9da1a5). Die
 * Fenster-Regel hat diese Verstöße schlicht nicht gezählt; die Locus-
 * Regel zählt sie ehrlich. Referenzfälle: solar e-auto-1↔e-auto-10
 * (Berührung 0 px ohne gemeinsamen Port), complex e-busbar-fuse↔
 * e-shore-inv (0,8 px, kein gemeinsamer Port).
 *
 * Zahlenstand 2026-10-02 (ADR 0031 v1, Segment-Fenster — ersetzt): Seit
 * die Port-Bündel-Ausnahme SYMMETRISCH für I2 und I3 galt, zählte die
 * Ratchet nur noch Restfälle: 2/7/0/6/3/23 (Σ 41), davor 6/21/4/12/13/42
 * (Σ 98, AUDIT ROUTE-012). Die I3-Segment×Segment-Prüfung selbst bleibt
 * unverändert scharf.
 */
export const FINAL_VALIDATION_RATCHET: Readonly<Record<string, number>> = {
  simple: 0,
  camper: 0,
  solar: 0,
  inverter: 0,
  acdc: 0,
  complex: 0,
};

/**
 * Obergrenze eines Plans. Für Pläne ohne Eintrag gilt **0**: Ein neuer
 * Referenzplan muss seine Ratchet ausdrücklich bekommen, statt stillschweigend
 * ungeprüft durchzulaufen.
 */
export const finalValidationRatchetOf = (plan: string): number => FINAL_VALIDATION_RATCHET[plan] ?? 0;
