/**
 * lib/peukert.ts — Peukert-Faustmodell für die nutzbare Batteriekapazität
 * (AUDIT DOM-002-Nachpflege 2026-09-08, Nächster Modellschnitt).
 *
 * Bisher unterstellte die Autarkie-Rechnung (useDashboardMetrics) die
 * nominelle 20-h-Kapazität mal Entladetiefe — die Lastabhängigkeit der
 * entnehmbaren Ladung fehlte ganz (Peukert-Effekt). Eine reale Batterie
 * gibt bei höheren Entladeströmen WENIGER nutzbare Ah her als bei der
 * 20-h-Nennlast: Blei-Blöcke spürbar, LiFePO4 nur moderat.
 *
 * Faustformel (Peukert 1897, klassische Batterietechnik-Heuristik):
 *   Ah_entnehmbar = C_20 · DoD · (I_ref / I)^(k−1),   I_ref = C_20 / 20 h
 * mit Chemie-Exponent k ≈ 1,05 (LiFePO4) / 1,12 (AGM) / 1,15 (Gel).
 * k = 1 bedeutet: kein Peukert-Effekt (ideale Batterie).
 *
 * Ehrlichkeits-Status: UNVERIFIED-Faustwerte — Peukert-Exponenten streuen
 * je nach Hersteller/Block/Zellalter spürbar (LiFePO4 typ. 1,02–1,08,
 * AGM 1,10–1,15, Gel 1,10–1,20). Die Formel wird bewusst konservativ
 * angewendet: der Faktor ist nach OBEN gedeckelt (kleine Lasten schenken
 * der Batterie im Modell NICHTS hinzu — kein Bonus über die Nominal-
 * kapazität hinaus) und die sehr kleinströmige zellchemische Selbst-
 * entladung/Peukert-Überlagerung bei tage-/wochenlangen Tiny-Loads ist
 * nicht modelliert. BMS-Abschaltschwellen vor Tiefentladen sind
 * weiterhin nicht modelliert (steht im ExpertPanel).
 */

/** Peukert-Exponent je Chemie — Faustwerte, s. Dateikopf (UNVERIFIED). */
export const PEUKERT_EXPONENT: Record<string, number> = {
  LiFePO4: 1.05,
  AGM: 1.12,
  Gel: 1.15,
};

/**
 * Peukert-Faktor der nutzbaren Kapazität bei Dauerentnahme `currentA` aus
 * einem `capacity20hAh`-Block. ≤ 1 gedeckelt (kein Bonus), < 0 bzw. ungültige
 * Eingaben liefern 1 (= bisheriges Nennmodell, ehrlich NICHT verschärft).
 */
export function peukertCapacityFactor(capacity20hAh: number, currentA: number, exponentK: number): number {
  if (!(capacity20hAh > 0) || !(currentA > 0) || !(exponentK >= 1)) return 1;
  const referenceCurrent = capacity20hAh / 20;
  if (currentA <= referenceCurrent) return 1;
  const factor = Math.pow(referenceCurrent / currentA, exponentK - 1);
  return Math.min(1, factor);
}

/**
 * Peukert-Exponent eines Blocks: explizites `data.peukertExponent`
 * (Datenblatt) schlägt den Chemie-Faustwert; unbekannte Chemie fällt auf
 * den LiFePO4-Anker (geringste Peukert-Reduktion = konservativ? Nein: das
 * ist der WOHLMEINENDSTE Fall — aber Nominallast-Rechnung war bisher der
 * Default, und ein Blei-Wert für eine Lithium-Batterie würde die Autarkie
 * fälschlich dramatisieren; konservative Richtung für die AUTARKIE-Anzeige
 * wäre Blei — doch dann läge jede Lithium-Batterie falsch. Wir wählen
 * bewusst den Chemie-Fallback LiFePO4 und verweisen aufs Datenblattfeld).
 */
export function peukertExponentOf(data: Record<string, unknown> | undefined): number {
  const explicit = typeof data?.peukertExponent === 'number' ? data.peukertExponent : NaN;
  if (Number.isFinite(explicit) && explicit >= 1) return explicit;
  const chemistry = typeof data?.chemistry === 'string' ? data.chemistry : 'LiFePO4';
  return PEUKERT_EXPONENT[chemistry] ?? PEUKERT_EXPONENT['LiFePO4']!;
}

/**
 * Nutzbare Kapazität (Ah) eines Blocks unter konstanter Dauerlast:
 * Nennkapazität·DoD·Peukert-Faktor. `doDFraction` kommt vom Aufrufer
 * (VDE_BATTERY_DOD), damit die Modellgrenze pro Chemie konsistent bleibt.
 */
export function usableCapacityWithPeukertAh(
  capacity20hAh: number,
  doDFraction: number,
  averageCurrentA: number,
  exponentK: number
): number {
  if (!(capacity20hAh > 0)) return 0;
  const dod = doDFraction > 0 && doDFraction <= 1 ? doDFraction : 1;
  return capacity20hAh * dod * peukertCapacityFactor(capacity20hAh, averageCurrentA, exponentK);
}
