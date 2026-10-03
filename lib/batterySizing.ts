/**
 * lib/batterySizing.ts — Kapazitätsbemessung der Aufbaubatterie für den
 * öffentlichen Rechner (`/rechner/batteriekapazitaet/`).
 *
 * Warum ein eigenes Modul und keine Rechnung in der Anzeige: ARCHITECTURE-RULES
 * Rule D — die Anzeige implementiert keine elektrischen Berechnungen. Die
 * Bausteine liegen bereits vor und werden hier nur zusammengesetzt:
 *
 *   - Entladetiefe je Chemie   → `VDE_BATTERY_DOD` (lib/vde-standards.ts)
 *   - Peukert-Effekt           → `peukertCapacityFactor` (lib/peukert.ts)
 *   - Ladestrom-Reserve        → `VDE_CHARGE_DERATING_FACTOR` (dito)
 *
 * Es gibt KEINE Alters-, Temperatur- oder Zyklenmodellierung im Projekt. Statt
 * eine zu erfinden, ist die Reserve ein sichtbarer Eingabewert (Standard 0)
 * und die Grenze steht in `limits` der Seite — eine Zahl, die niemand belegt
 * hat, gehört nicht in ein Ergebnis.
 */

import { peukertCapacityFactor, peukertExponentOf } from './peukert';
import { VDE_BATTERY_DOD, VDE_CHARGE_DERATING_FACTOR } from './vde-standards';

/** Chemien, die das Modell kennt (Deckungsgleichheit prüft `batterySizing.test.ts`). */
export type BatteryChemistry = 'LiFePO4' | 'AGM' | 'Gel' | 'Blei';

export const BATTERY_CHEMISTRIES: readonly BatteryChemistry[] = ['LiFePO4', 'AGM', 'Gel', 'Blei'];

export type BatterySizingInput = {
  /** Täglicher Energiebedarf in Wattstunden. */
  dailyEnergyWh: number;
  /** Gewünschte autarke Tage ohne Ladung (Ladung wird nicht gegengerechnet). */
  autonomyDays: number;
  /** Nennspannung des Bordnetzes in Volt (12 oder 24). */
  systemVoltageV: number;
  chemistry: BatteryChemistry;
  /**
   * Zuschlag für Alterung, Kälte und unvollständige Ladung in Prozent
   * (0…50). Standard 0: Das Projekt modelliert diese Effekte nicht, also
   * entscheidet der Nutzer sichtbar über den Zuschlag.
   */
  reservePercent?: number;
  /** Dauerstrom der dominanten Last in Ampere — Eingang des Peukert-Faktors. */
  referenceCurrentA?: number;
  /**
   * Ladefenster in Stunden, in dem der Tagesverbrauch nachgeladen werden soll
   * (Standard 5 h — Modellannahme für einen Ladetag, sichtbar als Eingabe).
   */
  chargeWindowHours?: number;
};

export type BatterySizingResult = {
  /** Benötigte entnehmbare Energie in Wh (Bedarf × Autarkietage). */
  requiredUsableWh: number;
  /** Entladetiefe der gewählten Chemie (0…1). */
  dodFraction: number;
  /** Nennkapazität in Ah, die der Bedarf ohne Peukert und ohne Reserve fordert. */
  requiredNominalAh: number;
  /** Nennkapazität inklusive Reservezuschlag (Ah). */
  requiredNominalWithReserveAh: number;
  /** Empfohlene Nennkapazität als übliche Baugröße in 5-Ah-Stufen (Ah). */
  recommendedNominalAh: number;
  /** Peukert-Faktor der chemiespezifischen Kennlinie (≤ 1). */
  peukertFactor: number;
  /** Peukert-Exponent der Chemie (Datenblattwert schlägt Faustwert). */
  peukertExponent: number;
  /** Nutzbare Kapazität der EMPFOHLENEN Größe bei Nennlast (Ah). */
  usableAhOfRecommendation: number;
  /** Strom, der dem Peukert-Faktor zugrunde liegt (A). */
  referenceCurrentA: number;
  /**
   * Ladestrom, der den Tagesverbrauch im Ladefenster nachlädt — inklusive des
   * Ladezeit-Aufschlags des Modells (`VDE_CHARGE_DERATING_FACTOR`, CC/CV-Knick,
   * Wärme, Alterung). Beschreibt den LADEPFAD, nicht die Batterie.
   */
  chargeCurrentA: number;
  /** Ladefenster, mit dem gerechnet wurde (h). */
  chargeWindowHours: number;
  /** Einordnung: trägt die empfohlene Größe den Bedarf? */
  sufficient: boolean;
};

/**
 * Voreingestelltes Ladefenster in Stunden. Modellannahme, keine Messung: Sie
 * beschreibt, über wie viele Stunden ein Ladetag (Solar/Fahren/Landstrom)
 * trägt. Wer es anders weiß, ändert den Wert im Rechner sichtbar.
 */
export const DEFAULT_CHARGE_WINDOW_HOURS = 5;

/** Übliche Baugrößen-Raster für Aufbaubatterien (Ah). */
const CAPACITY_STEP_AH = 5;

/**
 * Bemessung der Aufbaubatterie.
 *
 * Rechenweg (alle Faktoren aus dem Modell, keiner erfunden):
 *   C_erf = (Bedarf_Wh · Tage) / (U · DoD) · (1 + Reserve)
 *   Autarkie: C_nenn · DoD · Peukert ≥ Bedarf/Tag
 *
 * @throws RangeError bei ungültigen Eingaben (Rule M: kein stiller Fallback).
 */
export function sizeBattery(input: BatterySizingInput): BatterySizingResult {
  const {
    dailyEnergyWh,
    autonomyDays,
    systemVoltageV,
    chemistry,
    reservePercent = 0,
    referenceCurrentA,
    chargeWindowHours = DEFAULT_CHARGE_WINDOW_HOURS,
  } = input;

  assertPositive('Tagesbedarf', dailyEnergyWh);
  assertPositive('Autarkietage', autonomyDays);
  assertPositive('Systemspannung', systemVoltageV);
  assertPositive('Ladefenster', chargeWindowHours);
  if (!(reservePercent >= 0 && reservePercent <= 50)) {
    throw new RangeError(`Reserve muss zwischen 0 und 50 % liegen, war ${reservePercent}`);
  }

  const dodFraction = VDE_BATTERY_DOD[chemistry];
  if (dodFraction === undefined) {
    throw new RangeError(`Unbekannte Chemie "${chemistry}" — VDE_BATTERY_DOD kennt sie nicht`);
  }

  const requiredUsableWh = dailyEnergyWh * autonomyDays;
  const requiredNominalAh = requiredUsableWh / (systemVoltageV * dodFraction);
  const requiredNominalWithReserveAh = requiredNominalAh * (1 + reservePercent / 100);
  const recommendedNominalAh = Math.ceil(requiredNominalWithReserveAh / CAPACITY_STEP_AH) * CAPACITY_STEP_AH;

  // Laststrom: ausdrücklich übergebener Dauerstrom schlägt die Tagesmittlung
  // (Bedarf/24 h). Beides ist Modell, nicht Messung — sichtbar in `limits`.
  const averageCurrentA =
    referenceCurrentA !== undefined && referenceCurrentA > 0
      ? referenceCurrentA
      : dailyEnergyWh / systemVoltageV / 24;

  const peukertExponent = peukertExponentOf({ chemistry });
  const peukertFactor = peukertCapacityFactor(recommendedNominalAh, averageCurrentA, peukertExponent);
  const usableAhOfRecommendation = recommendedNominalAh * dodFraction * peukertFactor;

  // Nachladen: Tagesbedarf / (U · Fenster) mit dem Ladezeit-Aufschlag des
  // Modells — dieselbe Größe, die `useDashboardMetrics` für die Ladezeit nutzt.
  const chargeCurrentA = (dailyEnergyWh / (systemVoltageV * chargeWindowHours)) * VDE_CHARGE_DERATING_FACTOR;

  return {
    requiredUsableWh,
    dodFraction,
    requiredNominalAh,
    requiredNominalWithReserveAh,
    recommendedNominalAh,
    peukertFactor,
    peukertExponent,
    usableAhOfRecommendation,
    referenceCurrentA: averageCurrentA,
    chargeCurrentA,
    chargeWindowHours,
    sufficient: usableAhOfRecommendation * systemVoltageV + 1e-9 >= dailyEnergyWh,
  };
}

function assertPositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} muss eine positive Zahl sein, war ${value}`);
  }
}
