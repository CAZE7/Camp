/**
 * lib/solarSizing.ts — Auslegung der Solarinsel für den öffentlichen Rechner
 * (`/rechner/solaranlage/`).
 *
 * Warum ein eigenes Modul: `lib/solar.ts` beschreibt die elektrischen Grenzen
 * einer ANLAGE (Voc-Fenster, Stringströme, Sicherungsfaktoren). Hier geht es um
 * die vorgelagerte Frage „wie viel Modulleistung brauche ich überhaupt?" —
 * dieselbe Trennung wie zwischen `lib/electrical.ts` (Grenzen) und
 * `lib/cableSizing.ts` (Bemessung).
 *
 * Verwendete Modellgrößen (nichts erfunden):
 *   - Winterertrag 35 % des Sommerertrags → `VDE_SOLAR_WINTER_REDUCTION`
 *   - Ladezeit-Aufschlag (CC/CV, Wärme)   → `VDE_CHARGE_DERATING_FACTOR`
 *   - MPP-Spannung 18 V je 12-V-Modul     → `VDE_SOLAR_VMP_VOLTAGE`
 *
 * Der spezifische Jahresertrag (kWh je kWp) ist KEINE Projektkonstante: Er
 * hängt von Standort, Ausrichtung und Verschattung ab und ist deshalb ein
 * sichtbarer Eingabewert mit dokumentiertem Standard.
 */

import {
  VDE_CHARGE_DERATING_FACTOR,
  VDE_SOLAR_VMP_VOLTAGE,
  VDE_SOLAR_WINTER_REDUCTION,
} from './vde-standards';

/**
 * Spezifischer Ertrag im Standardfall in kWh je kWp und Tag — entspricht rund
 * 1 100 kWh/kWp im Jahr, dem unteren Rand guter mitteleuropäischer
 * Dachflächen (Dach, Süd, ohne Verschattung, 12-V-Module mit Laderegler).
 * Der Wert ist ein Eingabestandard, keine Messung: Wer einen schlechteren
 * Einbauort hat, setzt ihn im Rechner herunter.
 */
export const DEFAULT_YIELD_KWH_PER_KWP_DAY = 3.0;

/** Bezugsleistung, auf die der spezifische Ertrag normiert ist. */
export const KWP_REFERENCE_WATTS = 1000;

export type SolarSizingInput = {
  /** Täglicher Energiebedarf in Wattstunden. */
  dailyEnergyWh: number;
  /** Spezifischer Ertrag in kWh je kWp und Tag. */
  yieldKwhPerKwpDay?: number;
  /** Systemspannung in Volt (12 oder 24). */
  systemVoltageV: number;
  /** Modulleistung eines Panels in Watt peak. */
  panelWatts?: number;
  /**
   * true = den Winterfall auslegen (35 % des Ertrags nach
   * `VDE_SOLAR_WINTER_REDUCTION`), sonst den Sommerfall.
   */
  winterDesign?: boolean;
  /** Verschattungs- oder Ausrichtungsabschlag in Prozent (0…70). */
  deratePercent?: number;
};

export type SolarSizingResult = {
  /** Tagesbedarf in Wh, mit dem gerechnet wurde. */
  dailyEnergyWh: number;
  /** Angesetzter spezifischer Ertrag (kWh/kWp/Tag) nach Jahreszeit-Abschlag. */
  effectiveYieldKwhPerKwpDay: number;
  /** Wahrer Jahreszeit-Abschlag (1 = Sommer, 0,35 = Winter). */
  seasonFactor: number;
  /** Notwendige Modulleistung in Watt peak (ungerundet). */
  requiredPeakWatts: number;
  /** Notwendige Modulleistung, auf das Panelraster aufgerundet (Wp). */
  recommendedPeakWatts: number;
  /** Anzahl der Panels, die die Empfehlung ergibt. */
  panelCount: number;
  /** Modulleistung je Panel, mit der gerechnet wurde (Wp). */
  panelWatts: number;
  /** Rechnerisch erwarteter Ladestrom bei MPP-Spannung (A). */
  expectedChargeCurrentA: number;
  /**
   * Faktor, um den der Tagesbedarf im gewählten Fall gedeckt ist (> 1 =
   * Überdeckung, < 1 = Unterdeckung).
   */
  coverageFactor: number;
};

/**
 * Bemessung der Solarinsel.
 *
 * Rechenweg:
 *   Ertrag_je_1000_Wp = Ertrag_kWh/kWp/Tag · 1000 Wh/kWh · (1 − Abschlag)
 *   P_erf = Bedarf_Wh / Ertrag_je_1000_Wp · 1000 Wp · Ladezeit-Aufschlag
 *
 * @throws RangeError bei ungültigen Eingaben (Rule M).
 */
export function sizeSolarArray(input: SolarSizingInput): SolarSizingResult {
  const {
    dailyEnergyWh,
    yieldKwhPerKwpDay = DEFAULT_YIELD_KWH_PER_KWP_DAY,
    systemVoltageV,
    panelWatts = 100,
    winterDesign = false,
    deratePercent = 0,
  } = input;

  assertPositive('Tagesbedarf', dailyEnergyWh);
  assertPositive('Spezifischer Ertrag', yieldKwhPerKwpDay);
  assertPositive('Systemspannung', systemVoltageV);
  assertPositive('Modulleistung', panelWatts);
  if (!(deratePercent >= 0 && deratePercent <= 70)) {
    throw new RangeError(`Abschlag muss zwischen 0 und 70 % liegen, war ${deratePercent}`);
  }

  const seasonFactor = winterDesign ? VDE_SOLAR_WINTER_REDUCTION : 1;
  const effectiveYieldKwhPerKwpDay = yieldKwhPerKwpDay * seasonFactor * (1 - deratePercent / 100);
  if (effectiveYieldKwhPerKwpDay <= 0) {
    throw new RangeError('Der angesetzte Ertrag ist nach Abschlag 0 — Auslegung unmöglich');
  }

  // Ertrag je 1000 Wp und Tag in Wh, danach der Ladezeit-Aufschlag des Modells.
  const yieldWhPerKwpDay = effectiveYieldKwhPerKwpDay * 1000;
  const requiredPeakWatts =
    (dailyEnergyWh / yieldWhPerKwpDay) * KWP_REFERENCE_WATTS * VDE_CHARGE_DERATING_FACTOR;

  const panelCount = Math.max(1, Math.ceil(requiredPeakWatts / panelWatts));
  const recommendedPeakWatts = panelCount * panelWatts;

  // Ladestrom: Leistung / MPP-Spannung. Die MPP-Spannung ist modellweit die
  // eines 12-V-Moduls (`VDE_SOLAR_VMP_VOLTAGE`); für 24-V-Bänke ergibt erst der
  // Laderegler den doppelten Batteriestrom — deshalb die Systemspannungs-Relation.
  const expectedChargeCurrentA = recommendedPeakWatts / VDE_SOLAR_VMP_VOLTAGE;

  const expectedYieldWh = (recommendedPeakWatts / KWP_REFERENCE_WATTS) * yieldWhPerKwpDay;

  return {
    dailyEnergyWh,
    effectiveYieldKwhPerKwpDay,
    seasonFactor,
    requiredPeakWatts,
    recommendedPeakWatts,
    panelCount,
    panelWatts,
    expectedChargeCurrentA,
    coverageFactor: expectedYieldWh / dailyEnergyWh,
  };
}

function assertPositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} muss eine positive Zahl sein, war ${value}`);
  }
}
