/**
 * lib/materials.ts — EINE Quelle für die Kupfer-Kennwerte des Modells.
 *
 * Vorher standen die beiden Leitfähigkeits-Schreibweisen an fünf Stellen im
 * Code (electrical.ts, autoWire/primitives.ts, shortCircuit.ts,
 * edges/utils/voltageDrop.ts, acProtection.ts) — teils als κ = 58,
 * teils als ρ = 0,0175. Beide sind derselbe Werkstoff bei **20 °C**:
 *
 *     ρ(1/κ) = 1 / 58 = 0,017241 Ω·mm²/m  ≈  0,0175
 *
 * Der Unterschied beträgt ~1,5 % und wirkte in die falsche Richtung: die
 * ρ-Variante rechnet den Widerstand (und damit den Kurzschlussstrom) etwas
 * pessimistischer, die κ-Variante den Spannungsfall etwas optimistischer.
 * EINE Konstante je Richtung, beide hier dokumentiert, beendet das.
 *
 * **Temperatur (AUDIT ELE-010 Restpunkt):** Beide Werte gelten bei 20 °C.
 * Kupfer steigt mit ~0,4 %/K; bei betriebswarmen 70 °C liegt ρ rund 20 %
 * höher als bei 20 °C (1 + 0,00393·50 ≈ 1,20). Der Planer rechnet also auf
 * der 20-°C-Basis — das ist die übliche Planungsgrundlage für
 * Spannungsfall-Budgets (DIN VDE 0100-520 nennt den Spannungsfall ohne
 * Temperaturzuschlag, weil die Last im Normalbetrieb unterhalb der
 * Leitertemperaturgrenze liegt). Für die Kurzschluss- und
 * Schleifenimpedanz-Schätzung bleibt der kalte Wert die konservative Seite:
 * warmer Leiter ⇒ höherer Widerstand ⇒ kleinerer Ik ⇒ kleineres Zs ⇒ die
 * Abschaltbedingung wird durch den Kaltwert NICHT geschönt.
 */

/** Leitfähigkeit κ von Kupfer bei 20 °C in m/(Ω·mm²). */
export const COPPER_CONDUCTIVITY_MS_PER_MM2 = 58;

/**
 * Spezifischer Widerstand ρ von Kupfer bei 20 °C in Ω·mm²/m.
 *
 * Der Verlegepraxis-Wert 0,0175 (≈ 1,5 % über dem Kehrwert von κ = 58).
 * Bewusst beibehalten: Alle Tabellenwerte und Normzitate der Branche sind
 * auf 0,0175 bezogen, und der Kurzschluss-Strang rechnet damit auf der
 * sicheren Seite.
 */
export const COPPER_RESISTIVITY_OHM_MM2_PER_M = 0.0175;

/** Exakter Kehrwert der modellierten Leitfähigkeit — für Konsistenzprüfungen. */
export const COPPER_RESISTIVITY_FROM_CONDUCTIVITY_OHM_MM2_PER_M = 1 / COPPER_CONDUCTIVITY_MS_PER_MM2;

/**
 * Temperaturkoeffizient von Kupfer in 1/K (lineare Näherung, 0…100 °C).
 * Nur für die Dokumentation/Konsistenzprüfung — kein Recheneingang der
 * Planungsfunktionen.
 */
export const COPPER_TEMPERATURE_COEFFICIENT_PER_K = 0.00393;

/** Widerstands-Aufschlag bei Betriebstemperatur T gegenüber 20 °C. */
export const copperResistanceRiseFactor = (
  operatingTemperatureC: number,
  referenceTemperatureC = 20
): number => 1 + COPPER_TEMPERATURE_COEFFICIENT_PER_K * (operatingTemperatureC - referenceTemperatureC);
