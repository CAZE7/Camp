/**
 * lib/cableSizing.ts — Leitungsbemessung für den öffentlichen Rechner.
 *
 * Warum ein eigenes Modul: Die Einzelschritte der Dimensionierung liegen
 * bereits in `lib/electrical.ts` (Normreihe, Derating, Sicherungsgrenze) und
 * `lib/units.ts` (Physik, geprüfte Einheiten). Der Rechner braucht aber eine
 * Antwort auf die Frage „welche Leitung soll ich verlegen, und wie sichere
 * ich sie ab?" — inklusive der Fälle, in denen die Normreihe nicht mehr
 * ausreicht. Diese Verdichtung ist Domänenlogik und gehört deshalb hierher,
 * nicht in die Anzeige (ARCHITECTURE-RULES Rule D).
 *
 * Zwei Eigenschaften sind bewusst:
 *   1. Es gibt keinen stillen Ersatzwert. Ungültige Eingaben werfen
 *      (`RangeError`) — die Anzeige entscheidet sichtbar, was sie damit tut
 *      (Rule M).
 *   2. Die Empfehlung ist immer eine Normgröße aus `VDE_SIZES`. Reicht selbst
 *      70 mm² nicht (Spannungsfall oder Strom), meldet das Ergebnis
 *      `exceedsStandardRange` — es wird NICHT auf einen ungeprüften Wert
 *      gerundet und auch keine Sicherung dafür ausgewiesen.
 */

import {
  VOLTAGE_DROP_PCT_CRITICAL,
  VOLTAGE_DROP_PCT_PLAN_LIMIT,
  VDE_AMPACITY,
  VDE_SIZES,
  calculateCrossSection,
  calculateMaxFuse,
  designAmpacity,
  lookupThermalCrossSection,
  selectFuseSize,
} from './electrical';
import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from './materials';
import { amps, crossSectionForVoltageDrop, dropPercent, meters, mm2, volts, voltageDrop } from './units';

/** Nennspannung des 12-V-Bordnetzes, auf das der Rechner dimensioniert. */
export const DC_NOMINAL_VOLTAGE_V = 12;

/**
 * Zulässiger Spannungsfall der Dimensionierung in Volt. Abgeleitet aus der
 * Planungsgrenze `VOLTAGE_DROP_PCT_PLAN_LIMIT` (3 %) und der Nennspannung —
 * dieselbe Grenze, mit der `calculateCrossSection` rechnet (0,36 V bei 12 V).
 */
export const DC_ALLOWED_VOLTAGE_DROP_V = (DC_NOMINAL_VOLTAGE_V * VOLTAGE_DROP_PCT_PLAN_LIMIT) / 100;

/** Kleinste und größte Normgröße der Reihe nach DIN VDE 0298-4 (Modell). */
export const MIN_STANDARD_CROSS_SECTION_MM2: number = (() => {
  const first = VDE_SIZES[0];
  if (first === undefined) throw new Error('VDE_SIZES ist leer — kleinste Normgröße nicht bestimmbar');
  return first;
})();

/** Größte Normgröße, die das Modell kennt (70 mm²). */
export const MAX_STANDARD_CROSS_SECTION_MM2: number = (() => {
  const last = VDE_SIZES[VDE_SIZES.length - 1];
  if (last === undefined) throw new Error('VDE_SIZES ist leer — größte Normgröße nicht bestimmbar');
  return last;
})();

/** Welches Kriterium die Empfehlung bestimmt hat. */
export type SizingCriterion = 'voltageDrop' | 'ampacity' | 'standardMinimum';

export type CableSizing = {
  /** Empfohlener Querschnitt als Normgröße in mm². */
  crossSectionMm2: number;
  /** Ungerundeter Querschnitt, den Spannungsfall bzw. Strom fordern (mm²). */
  requiredCrossSectionMm2: number;
  /** Spannungsfall der empfohlenen Leitung in Volt. */
  voltageDropV: number;
  /** Spannungsfall der empfohlenen Leitung in Prozent der Nennspannung. */
  voltageDropPercent: number;
  /** Nächstgrößere Sicherung, die Strom und Kabelgrenze erfüllt (A); null außerhalb der Normreihe. */
  fuseA: number | null;
  /** Größte Sicherung, die der empfohlene Querschnitt zulässt (A); null außerhalb der Normreihe. */
  maxFuseA: number | null;
  /** Bestimmendes Kriterium: Spannungsfall, Strombelastbarkeit oder Norm-Minimum. */
  criterion: SizingCriterion;
  /** true = selbst 70 mm² erfüllen die Forderung nicht (Leitung teilen / 24 V prüfen). */
  exceedsStandardRange: boolean;
};

/**
 * Prüft eine Eingabe auf „endlich und positiv" (Rule M).
 *
 * Die Einheitenkonstruktoren in `lib/units.ts` sichern den Typ, nicht den
 * Wertebereich: `meters(0)` ist ein gültiger Wert des Typs `Meters`, aber
 * keine sinnvolle Leitung. Ohne diese Prüfung entstünde aus einer Länge von
 * null ein Strom von unendlich — eine stille Ersatzantwort statt eines
 * Fehlers.
 */
function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} muss eine positive Zahl sein, war ${value}`);
  }
}

/**
 * Bemessung einer 12-V-Leitung.

 * Der Spannungsfall-Term wird mit `crossSectionForVoltageDrop` unabhängig
 * nachgerechnet, obwohl `calculateCrossSection` ihn intern enthält. Grund:
 * Nur so ist erkennbar, ob die Normreihe überhaupt ausreicht — die
 * Querschnittsempfehlung selbst deckelt bei der größten Normgröße und würde
 * einen Überlauf sonst als scheinbar gültige 70 mm² ausgeben.
 *
 * @throws RangeError wenn Strom oder Länge keine gültigen Größen sind
 *   (NaN, unendlich oder negativ — `lib/units.ts` prüft die Einheiten).
 */
export function sizeCable(currentA: number, lengthM: number): CableSizing {
  const current = amps(currentA);
  const length = meters(lengthM);
  const allowedDrop = volts(DC_ALLOWED_VOLTAGE_DROP_V);

  // Querschnitt, den der Spannungsfall fordert: A = I · 2L / (κ · ΔU).
  const dropArea = crossSectionForVoltageDrop(current, length, allowedDrop, COPPER_CONDUCTIVITY_MS_PER_MM2);
  // Querschnitt, den die Strombelastbarkeit fordert (Tabellenwert mit Derating).
  const thermalArea = lookupThermalCrossSection(current);

  const requiredCrossSectionMm2 = Math.max(MIN_STANDARD_CROSS_SECTION_MM2, dropArea, thermalArea);
  const exceedsStandardRange = requiredCrossSectionMm2 > MAX_STANDARD_CROSS_SECTION_MM2 + 1e-9;

  const criterion: SizingCriterion =
    dropArea >= thermalArea && dropArea > MIN_STANDARD_CROSS_SECTION_MM2
      ? 'voltageDrop'
      : thermalArea > MIN_STANDARD_CROSS_SECTION_MM2
        ? 'ampacity'
        : 'standardMinimum';

  const crossSectionMm2 = calculateCrossSection(current, length);
  const drop = voltageDrop(current, length, mm2(crossSectionMm2), COPPER_CONDUCTIVITY_MS_PER_MM2);

  return {
    crossSectionMm2,
    requiredCrossSectionMm2,
    voltageDropV: drop,
    voltageDropPercent: dropPercent(drop, volts(DC_NOMINAL_VOLTAGE_V)),
    fuseA: exceedsStandardRange ? null : selectFuseSize(current, crossSectionMm2),
    maxFuseA: exceedsStandardRange ? null : calculateMaxFuse(crossSectionMm2),
    criterion,
    exceedsStandardRange,
  };
}

/** Bewertung eines Spannungsfalls gegenüber den Grenzen des Modells. */
export type VoltageDropVerdict = 'ziel' | 'planungsgrenze' | 'verstoss' | 'kritisch';

export type VoltageDropResult = {
  /** Querschnitt, für den gerechnet wurde (mm²). */
  crossSectionMm2: number;
  /** Spannungsfall über Hin- und Rückleitung in Volt. */
  dropV: number;
  /** Spannungsfall in Prozent der Systemspannung. */
  dropPercent: number;
  /** Einordnung gegen 1 / 3 / 4 % des Modells (`lib/electrical.ts`). */
  verdict: VoltageDropVerdict;
  /** Querschnitt, den die 3-%-Grenze für Strom und Länge fordert (Normgröße). */
  recommendedCrossSectionMm2: number;
  /**
   * true = mit dem gewählten Querschnitt wird die 3-%-Planungsgrenze
   * überschritten. Ab 4 % meldet der Planer zusätzlich einen Verstoß
   * (`VOLTAGE_DROP_PCT_CRITICAL`) — die Anzeige entscheidet, wie sie das
   * benennt (Rule M: keine stille Empfehlung).
   */
  exceedsPlanLimit: boolean;
};

/**
 * Spannungsfall einer bereits gewählten Leitung.
 *
 * Der Unterschied zu `sizeCable`: Dort wird der Querschnitt GESUCHT, hier wird
 * ein vorhandener bewertet. Beide Wege benutzen dieselbe Formel
 * (ΔU = I · 2L / (κ · A), `lib/units.ts`) und dieselben Grenzen
 * (`lib/electrical.ts`) — es gibt keinen zweiten Rechenweg.
 *
 * @throws RangeError wenn Strom, Länge oder Querschnitt keine gültigen Größen
 *   sind (NaN, unendlich oder ≤ 0 — `lib/units.ts` prüft die Einheiten).
 */
export function voltageDropFor(
  currentA: number,
  lengthM: number,
  crossSectionMm2: number,
  systemVoltageV: number = DC_NOMINAL_VOLTAGE_V
): VoltageDropResult {
  requirePositive(currentA, 'Strom');
  requirePositive(lengthM, 'Länge');
  requirePositive(crossSectionMm2, 'Querschnitt');
  requirePositive(systemVoltageV, 'Systemspannung');

  const current = amps(currentA);
  const length = meters(lengthM);
  const section = mm2(crossSectionMm2);
  const system = volts(systemVoltageV);

  const drop = voltageDrop(current, length, section, COPPER_CONDUCTIVITY_MS_PER_MM2);
  const percent = dropPercent(drop, system);
  const verdict: VoltageDropVerdict =
    percent <= 1
      ? 'ziel'
      : percent <= VOLTAGE_DROP_PCT_PLAN_LIMIT
        ? 'planungsgrenze'
        : percent <= VOLTAGE_DROP_PCT_CRITICAL
          ? 'verstoss'
          : 'kritisch';

  return {
    crossSectionMm2,
    dropV: drop,
    dropPercent: percent,
    verdict,
    recommendedCrossSectionMm2: sizeCable(currentA, lengthM).crossSectionMm2,
    exceedsPlanLimit: percent > VOLTAGE_DROP_PCT_PLAN_LIMIT,
  };
}

/**
 * Größter Strom, den ein Querschnitt auf einer Länge führen darf, ohne die
 * 3-%-Grenze zu überschreiten — die Umkehrung der Spannungsfall-Formel
 * (I = κ · A · ΔU / 2L). Für Tabellen („so weit trägt welcher Querschnitt").
 *
 * @throws RangeError bei ungültigem Querschnitt oder ungültiger Länge.
 */
export function maxCurrentForPlanLimit(
  crossSectionMm2: number,
  lengthM: number,
  systemVoltageV: number = DC_NOMINAL_VOLTAGE_V
): number {
  requirePositive(crossSectionMm2, 'Querschnitt');
  requirePositive(lengthM, 'Länge');
  requirePositive(systemVoltageV, 'Systemspannung');

  const section = mm2(crossSectionMm2);
  const length = meters(lengthM);
  const allowedDrop = (systemVoltageV * VOLTAGE_DROP_PCT_PLAN_LIMIT) / 100;
  return (COPPER_CONDUCTIVITY_MS_PER_MM2 * section * allowedDrop) / (2 * length);
}

/**
 * Strom, den ein Querschnitt thermisch führen darf — Tabellenwert der
 * DIN VDE 0298-4 (Verlegeart B2) mit dem Derating des Modells. Bewusst ein
 * eigener Name: In Tabellen steht daneben der Spannungskriterium-Wert, und
 * beide werden ständig verwechselt („das Kabel darf 38 A" ist ohne
 * Verlegeart keine Aussage).
 */
export function thermalCurrentFor(crossSectionMm2: number): { tableA: number | null; designA: number } {
  requirePositive(crossSectionMm2, 'Querschnitt');

  const tableA = VDE_AMPACITY[crossSectionMm2] ?? null;
  return { tableA, designA: designAmpacity(mm2(crossSectionMm2)) };
}
