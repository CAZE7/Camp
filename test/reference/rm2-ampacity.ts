/**
 * test/reference/rm2-ampacity.ts — REFERENZMODELL 2: Belastbarkeit, Derating,
 * Sicherungskoordination.
 *
 * Zweck
 * =====
 * Unabhängige Nachrechnung von
 *   - Tabellenbelastbarkeit I_z,Basis je Normquerschnitt,
 *   - Temperaturfaktor f₁, Bündelungsfaktor f₂, Verlegeartfaktor f₃,
 *   - der EINEN korrigierten Belastbarkeit I_z,
 *   - der daraus abgeleiteten Sicherungsgrenze,
 *   - und des Koordinations-Sandwichs I_b ≤ I_n ≤ I_z sowie I₂ ≤ 1,45·I_z.
 *
 * Kein Import aus `lib/electrical.ts`, `lib/cableConditions.ts` oder
 * `lib/verify/ampacity.ts`. Die Tabellen stehen hier **erneut** (s. RM-1 für
 * die Begründung des Duplikats).
 *
 * Mathematische Definition
 * ------------------------
 *     I_z = I_z,Basis(A) · min(0,7 ; f₁ · f₂ · f₃)
 *     f₁  = sqrt((T_max − ϑ_U) / (T_max − 30 °C))
 *     f₂  = k_B(n)                                  n = 1…9
 *     f₃  = 1,0                                     (keine geprüfte Tabelle)
 *     I_n ≤ I_z        (Sicherung schützt die Leitung)
 *     I_b ≤ I_n        (Sicherung löst im Nennbetrieb nicht aus)
 *     I₂  ≤ 1,45 · I_z (konventioneller Auslösestrom, IEC 60364-4-43 §433.1)
 *
 * Einheiten
 * ---------
 * I [A], A [mm²], ϑ [°C], Faktoren dimensionslos.
 *
 * Quellen und ihr Status (hier bewusst getrennt, s. Kapitel 5 des Konzepts)
 * ------------------------------------------------------------------------
 * - `I_z,Basis`: Transkription der DIN VDE 0298-4, Verlegeart B2, 2 belastete
 *   Adern, 30 °C, Cu/PVC. **Kein lizenzierter Normtext** — Sekundärquelle.
 *   Die Werte 136 A (50 mm²) und 172 A (70 mm²) weichen von einer verbreiteten
 *   Referenz leicht ab und sind aus Golden-Master-Gründen unverändert.
 *   Status: **Transkription, nicht verifiziert am Normtext.**
 * - `T_max`: PVC 70 °C, XLPE 90 °C — IEC 60364-5-52 Tabelle 52-4. **Normbeleg.**
 * - `f₂ = k_B(n)`: Transkription aus DIN VDE 0298-4 Tab. 22 / IEC 60364-5-52.
 *   **Transkription** zweier unabhängiger Publikationen.
 * - `0,7`: Planerpauschale von CAMP. **MODELLANNAHME**, keine Norm.
 * - `1,45`: IEC 60364-4-43 §433.1 Bedingung (2). **Normbeleg.**
 * - `1,6 : 1` Selektivität: Verhältnis-Heuristik. **MODELLANNAHME.**
 * - `0,2 m` ungeschützte Länge: ISO 13297:2020 §8.1 / ABYC E-11. **Normbeleg.**
 *
 * Gültigkeitsbereich
 * ------------------
 * - n = 1…9 belastete Stromkreise; n > 9 ist **nicht definiert** (kein
 *   Schätzwert — die Produktivfunktion wirft, dieses Modell ebenso).
 * - 0 °C ≤ ϑ_U < T_max.
 * - Querschnitte aus der Normreihe 1,5 … 70 mm². Über 70 mm² gibt es keine
 *   Tabellenstufe; das Modell sagt das ausdrücklich (`outside-model`), statt
 *   „70 mm² genügt“ zu behaupten.
 *
 * Bekannte Grenzen
 * ----------------
 * - Verlegeart B2 gilt für Rohr auf Wand, nicht für lose Bündel im Motorraum.
 * - f₃ = 1 ist eine **Lücke**, kein Wert: für Verlegeart-Korrekturen liegt im
 *   Repo keine geprüfte Tabelle vor. Die Lücke wird nicht durch 1,0 „gelöst“,
 *   sondern als Untergrenze der Aussage geführt.
 * - Die Tabelle ist eine **allgemeine** B2-Transkription. Sie ist KEINE
 *   validierte Fahrzeug-Kabeltabelle für FLRY-B / FLR2X-B (andere Isolierung,
 *   andere Bündelung, andere Umgebung). Wer sie so liest, überdehnt sie.
 *
 * Abweichungstoleranz
 * -------------------
 * Exakt (≤ 1e-12 relativ) gegenüber `calculateCableIz` für alle Kombinationen
 * aus (A, ϑ, n) innerhalb des Gültigkeitsbereichs. Jede Abweichung ist ein
 * Befund, keine Toleranzfrage.
 */

/** Normreihe [mm²] — bewusst neu deklariert, nicht importiert. */
export const REF_SIZES: readonly number[] = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70];

/**
 * Tabellenbelastbarkeit I_z,Basis [A] je Querschnitt.
 * Verlegeart B2, 2 belastete Adern, 30 °C, Cu/PVC. Transkription (s. Kopf).
 */
export const REF_AMPACITY: Readonly<Record<number, number>> = {
  1.5: 16.5,
  2.5: 23,
  4: 30,
  6: 38,
  10: 52,
  16: 69,
  25: 90,
  35: 111,
  50: 136,
  70: 172,
};

/** Bündelungsfaktoren f₂ für n = 1…9 (Index 0 ⇒ n = 1). */
export const REF_GROUP_FACTORS: readonly number[] = [1.0, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5];

/** Grenzleitertemperatur je Isolierstoff [°C] — IEC 60364-5-52 Tab. 52-4. */
export const REF_T_MAX: Readonly<Record<'PVC' | 'XLPE', number>> = { PVC: 70, XLPE: 90 };

/** Referenz-Umgebungstemperatur der Tabelle [°C]. */
export const REF_AMBIENT_REFERENCE_C = 30;

/** Planerpauschale — MODELLANNAHME, keine Norm (s. Kopf). */
export const REF_DERATE_FACTOR = 0.7;

/** Faktor des konventionellen Auslösestroms — IEC 60364-4-43 §433.1 (2). */
export const REF_I2_IZ_FACTOR = 1.45;

/** Übliche Normsicherungen [A]. */
export const REF_STANDARD_FUSES: readonly number[] = [
  5, 7.5, 10, 15, 16, 20, 25, 30, 32, 40, 50, 60, 63, 80, 100, 125, 160, 200, 250, 300, 350, 400,
];

/** Ungeschützte Leitungslänge ab Quelle [m] — ISO 13297:2020 §8.1. */
export const REF_MAX_UNPROTECTED_LENGTH_M = 0.2;

/** Bündelungsfaktor f₂ für n belastete Stromkreise. @throws bei n ∉ 1…9. */
export function refGroupFactor(circuits: number): number {
  if (!Number.isInteger(circuits) || circuits < 1 || circuits > 9) {
    throw new RangeError(`refGroupFactor: n muss ganzzahlig in 1…9 sein (${circuits})`);
  }
  return REF_GROUP_FACTORS[circuits - 1]!;
}

/**
 * Temperaturfaktor f₁ = sqrt((T_max − ϑ)/(T_max − 30)).
 * Oberhalb von T_max ist der Betrieb unzulässig — kein Faktor, sondern Fehler.
 */
export function refAmbientFactor(ambientC: number, insulation: 'PVC' | 'XLPE' = 'PVC'): number {
  const tMax = REF_T_MAX[insulation];
  if (!Number.isFinite(ambientC)) {
    throw new RangeError(`refAmbientFactor: Temperatur muss endlich sein (${ambientC})`);
  }
  if (ambientC >= tMax) {
    throw new RangeError(`refAmbientFactor: ${ambientC} °C ≥ T_max ${tMax} °C (${insulation})`);
  }
  return Math.sqrt((tMax - ambientC) / (tMax - REF_AMBIENT_REFERENCE_C));
}

export interface RefIzInput {
  crossSectionMm2: number;
  /** Umgebungstemperatur [°C]; Standard = Tabellenreferenz 30 °C. */
  ambientC?: number;
  insulation?: 'PVC' | 'XLPE';
  /** Anzahl belasteter Stromkreise in derselben Trasse. */
  bundledCircuits?: number;
  /** f₃; Standard 1,0 (keine geprüfte Tabelle). */
  installationFactor?: number;
}

export interface RefIzResult {
  baseIz: number;
  ambientFactor: number;
  groupingFactor: number;
  installationFactor: number;
  plannerFactor: number;
  /** min(0,7 ; f₁·f₂·f₃) — der tatsächlich wirksame Faktor. */
  effectiveFactor: number;
  correctedIz: number;
  /** true = die 0,7-Pauschale war strenger als die Physik. */
  plannerIsStricter: boolean;
}

/**
 * Korrigierte Belastbarkeit I_z = I_z,Basis · min(0,7 ; f₁·f₂·f₃).
 *
 * @throws RangeError wenn der Querschnitt nicht in der Tabelle steht (kein
 *   Ersatzwert), wenn f₃ ∉ (0, 1] ist (keine kapazitätserhöhende Korrektur)
 *   oder wenn ϑ ≥ T_max.
 */
export function refCorrectedIz(input: RefIzInput): RefIzResult {
  const base = REF_AMPACITY[input.crossSectionMm2];
  if (base === undefined) {
    throw new RangeError(`refCorrectedIz: Querschnitt ${input.crossSectionMm2} mm² nicht in der Tabelle`);
  }
  const insulation = input.insulation ?? 'PVC';
  const ambientFactor = input.ambientC === undefined ? 1 : refAmbientFactor(input.ambientC, insulation);
  const groupingFactor = input.bundledCircuits === undefined ? 1 : refGroupFactor(input.bundledCircuits);
  const installationFactor = input.installationFactor ?? 1;
  if (!(installationFactor > 0) || installationFactor > 1) {
    throw new RangeError(`refCorrectedIz: f₃ muss in (0, 1] liegen (${installationFactor})`);
  }

  const physical = Math.min(1, ambientFactor * groupingFactor * installationFactor);
  const plannerIsStricter = REF_DERATE_FACTOR <= physical;
  const effectiveFactor = plannerIsStricter ? REF_DERATE_FACTOR : physical;
  return {
    baseIz: base,
    ambientFactor,
    groupingFactor,
    installationFactor,
    plannerFactor: REF_DERATE_FACTOR,
    effectiveFactor,
    correctedIz: base * effectiveFactor,
    plannerIsStricter,
  };
}

/**
 * Größte Normsicherung, die die Leitung nach diesem Modell noch schützt:
 * größte Normstufe ≤ I_z,Basis · 0,7 (bewusst gegen die **Tabelle**, nicht
 * gegen eine kantenspezifische I_z — so ist die Produktivtabelle abgeleitet).
 */
export function refMaxFuse(crossSectionMm2: number): number {
  const base = REF_AMPACITY[crossSectionMm2];
  if (base === undefined) {
    throw new RangeError(`refMaxFuse: Querschnitt ${crossSectionMm2} mm² nicht in der Tabelle`);
  }
  const designIz = base * REF_DERATE_FACTOR;
  const candidates = REF_STANDARD_FUSES.filter((rating) => rating <= designIz + 1e-9);
  const fuse = candidates[candidates.length - 1];
  return fuse ?? REF_STANDARD_FUSES[0]!;
}

/** Vollständige Sicherungstabelle des Modells. */
export function refFuseMap(): Readonly<Record<number, number>> {
  const map: Record<number, number> = {};
  for (const size of REF_SIZES) map[size] = refMaxFuse(size);
  return map;
}

/**
 * Kleinster Normquerschnitt, dessen Tabellenwert `I_b / 0,7` trägt —
 * die Umkehrung der Dimensionierung, **mit** ausgewiesener Modellgrenze.
 */
export function refThermalCrossSection(
  currentA: number
):
  | { status: 'within-model'; crossSectionMm2: number }
  | { status: 'outside-model'; requiredCurrentA: number; maximumModeledCurrentA: number } {
  if (!Number.isFinite(currentA) || currentA < 0) {
    throw new RangeError(`refThermalCrossSection: Strom muss ≥ 0 sein (${currentA})`);
  }
  // Grenzwerte sind INKLUSIV: ein Tabellenwert, der den Strom exakt trägt,
  // trägt ihn. Deshalb wird mit relativer Toleranz verglichen — sonst
  // entscheidet die Divisionsreihenfolge über eine Normstufe
  // (`11.55 / 0.7` = 16,500000000000004 > 16,5, aber `11.55 * (1/0.7)` = 16,5).
  // Die Produktivfunktion umgeht das über die Multiplikation mit `1/0,7`;
  // hier steht die mathematisch saubere Formulierung derselben Aussage.
  const required = currentA / REF_DERATE_FACTOR;
  // Grenzwert inklusiv, Toleranz auf Gleitkomma-Niveau (1e-12 relativ). Eine
  // gröbere Toleranz würde die Modellgrenze selbst verwischen: bei 120,400000001 A
  // MUSS `outside-model` herauskommen, nicht „70 mm² genügt".
  const tolerance = 1e-12;
  const size = REF_SIZES.find(
    (candidate) => REF_AMPACITY[candidate]! >= required - tolerance * Math.max(1, required)
  );
  if (size === undefined) {
    return {
      status: 'outside-model',
      requiredCurrentA: currentA,
      maximumModeledCurrentA: REF_AMPACITY[70]! * REF_DERATE_FACTOR,
    };
  }
  return { status: 'within-model', crossSectionMm2: size };
}

/**
 * Prüft das Koordinations-Sandwich und liefert **jede** verletzte Bedingung
 * benannt — nicht nur ein Ja/Nein. Das ist die Struktur, die ein Verdikt
 * braucht, um nachvollziehbar zu sein.
 */
export function refCoordination(input: { ib: number | null; in: number | null; iz: number | null }): {
  satisfied: boolean;
  violations: ReadonlyArray<'ib-over-iz' | 'ib-over-in' | 'in-over-iz'>;
  /** I₂ = 1,45 · I_z; `null`, wenn I_z fehlt. */
  i2Limit: number | null;
} {
  const { ib, in: rated, iz } = input;
  const violations: Array<'ib-over-iz' | 'ib-over-in' | 'in-over-iz'> = [];
  if (ib !== null && iz !== null && ib > iz + 1e-9) violations.push('ib-over-iz');
  if (ib !== null && rated !== null && ib > rated + 1e-9) violations.push('ib-over-in');
  if (rated !== null && iz !== null && rated > iz + 1e-9) violations.push('in-over-iz');
  return {
    satisfied: violations.length === 0,
    violations,
    i2Limit: iz === null ? null : REF_I2_IZ_FACTOR * iz,
  };
}
