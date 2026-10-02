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
  VOLTAGE_DROP_PCT_PLAN_LIMIT,
  VDE_SIZES,
  calculateCrossSection,
  calculateMaxFuse,
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
 * Bemessung einer 12-V-Leitung.
 *
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
