/**
 * lib/verify/physics.ts — EXAKTE DIMENSIONIERUNGSGLEICHUNGEN der Verifikation.
 *
 * Alle Gleichungen dieses Moduls sind geschlossen und ohne Faustformel-Zusatz:
 *
 *   1. Temperaturabhängiger Kupferwiderstand
 *        ρ(T) = ρ₂₀ · [1 + α₂₀ · (T − 20 °C)]
 *      mit ρ₂₀ = 0,0175 Ω·mm²/m und α₂₀ = 0,00393 1/K — beide aus
 *      `lib/materials.ts` (EINE Werkstoffquelle, kein zweiter Kupferwert).
 *
 *   2. Spannungsfall (Hin- und Rückleiter)
 *        ΔU = k_Pfad · L · I_b · ρ(T) / A      (k_Pfad = 2 bei Hin+Rück)
 *        ΔU_% = ΔU / U_n · 100
 *
 *   3. Thermische Belastbarkeit mit Korrekturfaktoren (DIN VDE 0298-4 /
 *      IEC 60364-5-52):
 *        I_z = I_r0 · f₁(ϑ_U) · f₂(n)
 *      f₁ ist die physikalische Form des Umgebungstemperaturfaktors
 *        f₁ = √((T_max − ϑ_U) / (T_max − 30 °C))
 *      mit T_max = 70 °C (PVC) bzw. 90 °C (XLPE). Diese Form reproduziert die
 *      veröffentlichte Tabelle B.52.14 (PVC) auf zwei Nachkommastellen
 *      (30 °C 1,00 · 40 °C 0,87 · 50 °C 0,71 · 55 °C 0,61 · 60 °C 0,50);
 *      `physics.test.ts` prüft die Tabellenzeilen gegen die Formel, statt der
 *      Tabelle zu vertrauen. f₂ kommt aus `groupFactor` (VDE_GROUP_FACTORS,
 *      Sekundärquellen-Transkription in `lib/electrical.ts`).
 *
 *      WICHTIG — Richtung der Verifikation: Die Engine setzt IMMER den
 *      STRENGEREN der verfügbaren I_z-Werte an — die Pauschale des Planers
 *      (`DERATE_FACTOR` 0,7) oder das Produkt der physikalischen Faktoren. Ein
 *      Kältebonus (f₁ > 1) wird nie kapazitätserhöhend verwendet. Die
 *      Verifikation darf niemals optimistischer sein als die Dimensionierung.
 *
 *   4. Abschaltbedingung (Schleifenimpedanz)
 *        Z_s = 2·R_Leitung + R_Quelle + R_Übergang
 *        I_k,min = c · U_n / Z_s ≥ I_a
 *      mit I_a = 5·I_n (Charakteristik B) bzw. 10·I_n (C) aus
 *      `lib/acProtection.ts` (IEC 60898-1, obere Magnetgrenze) und dem
 *      Spannungsfaktor c = 0,95 (IEC 60909-0, konservativer Minimalfall).
 *
 * Kein Zahlenwert dieses Moduls ist geraten: Was Modellannahme ist, steht als
 * `MODEL_ASSUMPTION` in der Regelmatrix und im Report.
 */

import { COPPER_RESISTIVITY_OHM_MM2_PER_M, COPPER_TEMPERATURE_COEFFICIENT_PER_K } from '../materials';
import { DERATE_FACTOR, VDE_AMPACITY, groupFactor } from '../electrical';
import {
  VOLTAGE_DROP_PCT_CRITICAL,
  VOLTAGE_DROP_PCT_PLAN_LIMIT,
  VOLTAGE_DROP_PCT_TARGET,
} from '../electrical';
import type { LoadClass } from './types';

// ============================================================================
// 1. WERKSTOFF (Kupfer)
// ============================================================================

/** Referenztemperatur der Werkstoffwerte in °C. */
export const REFERENCE_TEMPERATURE_C = 20;

/** ρ₂₀ des Modells in Ω·mm²/m (eine Quelle: `lib/materials.ts`). */
export const COPPER_RHO_20 = COPPER_RESISTIVITY_OHM_MM2_PER_M;

/** α₂₀ von Kupfer in 1/K (eine Quelle: `lib/materials.ts`). */
export const COPPER_ALPHA_20 = COPPER_TEMPERATURE_COEFFICIENT_PER_K;

/**
 * Spezifischer Widerstand von Kupfer bei Leitetemperatur T:
 * ρ(T) = ρ₂₀ · [1 + α₂₀ · (T − 20 °C)].
 *
 * @throws RangeError bei nicht-endlicher Temperatur oder T ≤ −273,15 °C.
 *   Ein stiller Ersatzwert würde den Spannungsfall und die Schleifenimpedanz
 *   „plausibel“ verfälschen.
 */
export function copperResistivityAt(temperatureC: number): number {
  if (!Number.isFinite(temperatureC)) {
    throw new RangeError(`copperResistivityAt: Temperatur muss endlich sein (erhielt ${temperatureC})`);
  }
  if (temperatureC <= -273.15) {
    throw new RangeError(`copperResistivityAt: ${temperatureC} °C liegt unter dem absoluten Nullpunkt`);
  }
  return COPPER_RHO_20 * (1 + COPPER_ALPHA_20 * (temperatureC - REFERENCE_TEMPERATURE_C));
}

/** Faktor, um den ρ gegenüber 20 °C steigt (1 bei 20 °C, 1,2 bei 70 °C). */
export function resistivityRiseFactor(temperatureC: number): number {
  return copperResistivityAt(temperatureC) / COPPER_RHO_20;
}

/** Anzahl der vom Strom durchflossenen Leiter einer Leitung (Standard: Hin+Rück). */
export type CurrentPathFactor = 1 | 2;

export interface ResistanceInput {
  /** Einfache Leitungslänge in Meter. */
  lengthM: number;
  /** Leiterquerschnitt in mm² (> 0). */
  crossSectionMm2: number;
  /** Leitetemperatur in °C (Standard 20 °C = kalter Planungswert). */
  temperatureC?: number;
  /** 2 = Hin- und Rückleiter (Standard), 1 = Einfachleitung. */
  currentPathFactor?: CurrentPathFactor;
}

/**
 * Leitungswiderstand R = k · L · ρ(T) / A in Ohm.
 *
 * @throws RangeError bei nicht-positivem Querschnitt oder negativer Länge —
 *   eine 0 mm²-Leitung ist kein Leiter, und L < 0 gibt es nicht (Importdaten
 *   müssen auffallen, nicht gerundet werden).
 */
export function conductorResistanceOhm(input: ResistanceInput): number {
  const { lengthM, crossSectionMm2 } = input;
  const temperatureC = input.temperatureC ?? REFERENCE_TEMPERATURE_C;
  const pathFactor = input.currentPathFactor ?? 2;
  if (!(crossSectionMm2 > 0)) {
    throw new RangeError(`conductorResistanceOhm: Querschnitt muss > 0 sein (erhielt ${crossSectionMm2})`);
  }
  if (!(lengthM >= 0)) {
    throw new RangeError(`conductorResistanceOhm: Länge muss ≥ 0 sein (erhielt ${lengthM})`);
  }
  if (pathFactor !== 1 && pathFactor !== 2) {
    // Der Typ verlangt bereits 1 | 2; der Laufzeitcheck fängt JS-Aufrufer ab,
    // die sich nicht an den Typ halten (dort steht dann ein Fremdwert).
    throw new RangeError(
      `conductorResistanceOhm: currentPathFactor ∈ {1,2} (erhielt ${String(input.currentPathFactor)})`
    );
  }
  return (pathFactor * lengthM * copperResistivityAt(temperatureC)) / crossSectionMm2;
}

// ============================================================================
// 2. SPANNUNGSFALL
// ============================================================================

export interface VoltageDropInput extends ResistanceInput {
  /** Betriebsstrom I_b in A. */
  currentA: number;
}

/** Spannungsfall in Volt: ΔU = k · L · I_b · ρ(T) / A. */
export function voltageDropVolts(input: VoltageDropInput): number {
  const { currentA } = input;
  if (!(currentA >= 0)) {
    throw new RangeError(`voltageDropVolts: Strom muss ≥ 0 sein (erhielt ${currentA})`);
  }
  return currentA * conductorResistanceOhm(input);
}

/**
 * Spannungsfall in Prozent der Nennspannung.
 *
 * @throws RangeError bei U_n ≤ 0 — der Bezugswert darf nie geraten werden.
 */
export function voltageDropPercent(dropV: number, nominalVoltageV: number): number {
  if (!(nominalVoltageV > 0)) {
    throw new RangeError(`voltageDropPercent: Nennspannung muss > 0 sein (erhielt ${nominalVoltageV})`);
  }
  return (dropV / nominalVoltageV) * 100;
}

/**
 * Spannungsfall-Budget je Lastklasse in Prozent.
 *
 * 1 % für Ladekreise, Mess-/Sensoriklast und sicherheitsrelevante Lasten,
 * 3 % für Standardverbraucher. Diese Werte sind **Planungsvorgaben des
 * Modells** (die DIN VDE 0298-4 enthält keine Spannungsfall-Grenzwerte;
 * AUDIT ELE-010) — sie stehen deshalb als `MODEL_ASSUMPTION` in der Matrix.
 */
export function voltageDropBudgetPercent(loadClass: LoadClass): number {
  switch (loadClass) {
    case 'charging':
    case 'sensitive':
    case 'safety':
      return VOLTAGE_DROP_PCT_TARGET;
    case 'standard':
      return VOLTAGE_DROP_PCT_PLAN_LIMIT;
    default: {
      // Erschöpfende Prüfung: Ein neuer Wert der Union MUSS hier auftauchen,
      // statt still das Standardbudget zu erben.
      const exhaustive: never = loadClass;
      throw new RangeError(`voltageDropBudgetPercent: unbekannte Lastklasse ${String(exhaustive)}`);
    }
  }
}

/** Obere Meldegrenze der Spannungsfall-Stufen (kritisch) — Modellwert. */
export const VOLTAGE_DROP_PCT_ALARM = VOLTAGE_DROP_PCT_CRITICAL;

// ============================================================================
// 3. THERMISCHE BELASTBARKEIT (I_z)
// ============================================================================

/** Isolierstoffklasse — bestimmt die Grenzleitertemperatur T_max. */
export type InsulationClass = 'PVC' | 'XLPE';

/** Grenzleitertemperaturen der Isolierstoffe in °C (IEC 60364-5-52 Tab. 52-4). */
export const MAX_CONDUCTOR_TEMPERATURE_C: Record<InsulationClass, number> = {
  PVC: 70,
  XLPE: 90,
};

/** Referenz-Umgebungstemperatur der Tabellenwerte in °C (Luft). */
export const REFERENCE_AMBIENT_C = 30;

/**
 * Umgebungstemperatur-Korrekturfaktor f₁:
 *
 *   f₁ = √((T_max − ϑ_U) / (T_max − 30 °C))
 *
 * @throws RangeError bei ϑ_U ≥ T_max: Der Leiter kann bei dieser
 *   Umgebungstemperatur gar nicht mehr betrieben werden — das ist kein
 *   Faktor 0, sondern ein Planungsfehler mit Ansage.
 */
export function ambientTemperatureFactor(ambientC: number, insulation: InsulationClass = 'PVC'): number {
  if (!Number.isFinite(ambientC)) {
    throw new RangeError(`ambientTemperatureFactor: Temperatur muss endlich sein (erhielt ${ambientC})`);
  }
  const tMax = MAX_CONDUCTOR_TEMPERATURE_C[insulation];
  if (ambientC >= tMax) {
    throw new RangeError(
      `ambientTemperatureFactor: Umgebung ${ambientC} °C ≥ Grenzleitertemperatur ${tMax} °C (${insulation}) — Betrieb unzulässig`
    );
  }
  return Math.sqrt((tMax - ambientC) / (tMax - REFERENCE_AMBIENT_C));
}

/** Korrekturfaktoren der Belastbarkeit. */
export interface AmpacityConditions {
  /** Umgebungstemperatur in °C (Standard 30 °C = Tabellenreferenz). */
  ambientC: number;
  /** Isolierstoff (Standard PVC, weil das Ampacity-Modell PVC-Werte nutzt). */
  insulation?: InsulationClass;
  /** Anzahl belasteter Stromkreise in derselben Trasse (1…9, s. groupFactor). */
  bundledCircuits?: number;
}

/** Ergebnis der I_z-Ermittlung inklusive ausgewiesener Faktoren. */
export interface AmpacityResult {
  /** Angesetzte Belastbarkeit in A. */
  izA: number;
  /** Basistabellenwert in A. */
  baseAmpacityA: number;
  /** Angesetzter Temperaturfaktor. */
  ambientFactor: number;
  /** Angesetzter Häufungsfaktor. */
  groupingFactor: number;
  /** Kombinierter Faktor (≤ 1, nie kapazitätserhöhend). */
  combinedFactor: number;
  /** Herkunft der angesetzten Korrektur (Reportpflicht). */
  basis: 'plan-model-pauschale' | 'plan-model-und-physik';
}

/**
 * Zentrale, maschinenlesbare Aufschlüsselung der korrigierten Belastbarkeit
 * I_z (Auftrag §7). JEDE Korrektur ist ein benannter Faktor — keine
 * Doppelanwendung, keine versteckte Pauschale:
 *
 *   I_z = I_z,basis × f_ambient × f_grouping × f_installation × f_planer
 *
 *   - `ambientFactor`        f₁(ϑ_U) — Umgebungstemperatur (≤ 1, nie kapazitäts-
 *                              erhöhend); 1 ohne Temperaturangabe (30 °C =
 *                              Tabellenreferenz).
 *   - `groupingFactor`       f₂(n) — Häufung in der Trasse (VDE_GROUP_FACTORS);
 *                              1 ohne Angabe.
 *   - `installationFactor`   Verlegesart-Korrektur. **Nicht modelliert** →
 *                              explizit 1,0 (der Plan trägt keine
 *                              Verlegeart; 1,0 = keine Kürzung, keine Erhöhung).
 *   - `plannerSafetyFactor`  die Planer-Pauschale `DERATE_FACTOR` (0,7) — die
 *                              Iz-Wahrheit der Dimensionierung (AUDIT ELE-001).
 *                              Gilt exakt EINMAL (min-Verknüpfung, nicht
 *                              multiplikativ doppelt).
 *
 * Der strenge Wert gewinnt: `min(1, f₁·f₂·f_inst)` gegen `plannerSafetyFactor`.
 * Ein Kältebonus (f₁ > 1) wird nie kapazitätserhöhend angesetzt.
 */
export interface CorrectedIzBreakdown {
  /** Basistabellenwert in A (VDE_AMPACITY, B2). */
  baseIz: number;
  /** f₁ — Umgebungstemperaturfaktor. */
  ambientFactor: number;
  /** f₂ — Häufungsfaktor. */
  groupingFactor: number;
  /** f — Verlegesart (nicht modelliert, explizit 1,0). */
  installationFactor: number;
  /** f — Planer-Pauschale (DERATE_FACTOR 0,7). */
  plannerSafetyFactor: number;
  /** Ergebnis: korrigierte Belastbarkeit in A. */
  correctedIz: number;
  /** Menschenlesbare Rechnung (Reportpflicht, UI „Warum?“). */
  explanation: string;
}

/** Bedingungen für die zentrale Iz-Korrektur (alle optional, keine Stillerfüllung). */
export interface CorrectedIzConditions {
  /** Umgebungstemperatur in °C (30 °C = Tabellenreferenz). */
  ambientC?: number;
  /** Isolierstoff (PVC/XLPE, Default PVC). */
  insulation?: InsulationClass;
  /** Anzahl belasteter Stromkreise in der Trasse (1…9). */
  bundledCircuits?: number;
}

/**
 * Zentrale Berechnung der korrigierten Belastbarkeit I_z mit vollständiger
 * Faktoren-Aufschlüsselung. EINE Autorität für „was darf die Leitung tragen“:
 * Verifikation, Sizing-Checks und die UI lesen alle denselben Wert.
 *
 * @throws RangeError bei unbekanntem Querschnitt (keine stille 0 A).
 */
export function calculateCorrectedIz(
  crossSectionMm2: number,
  conditions?: CorrectedIzConditions
): CorrectedIzBreakdown {
  const base = VDE_AMPACITY[crossSectionMm2];
  if (base === undefined) {
    throw new RangeError(
      `calculateCorrectedIz: Querschnitt ${crossSectionMm2} mm² ist nicht in der Belastbarkeitstabelle — kein stiller Ersatzwert`
    );
  }

  const insulation = conditions?.insulation ?? 'PVC';
  const hasAmbient = conditions?.ambientC !== undefined;
  const ambientFactor = hasAmbient ? ambientTemperatureFactor(conditions.ambientC as number, insulation) : 1;
  const groupingFactor =
    conditions?.bundledCircuits === undefined ? 1 : groupFactor(conditions.bundledCircuits);
  const installationFactor = 1; // Verlegesart nicht modelliert — explizit 1,0.
  const plannerSafetyFactor = DERATE_FACTOR;

  // Physikalischer Faktor (nie kapazitätserhöhend) gegen die Pauschale —
  // der STRENGERE (kleinere) Faktor gewinnt. 0,7 wird exakt einmal wirksam.
  const physical = Math.min(1, ambientFactor * groupingFactor * installationFactor);
  const effective = Math.min(plannerSafetyFactor, physical);
  const correctedIz = base * effective;

  const fmt = (value: number): string => value.toFixed(2);
  const explanation = `I_z = ${fmt(base)} A × min(${fmt(plannerSafetyFactor)} [Planerpauschale], ${fmt(
    physical
  )} [f₁ ${fmt(ambientFactor)} × f₂ ${fmt(groupingFactor)} × f₃ ${fmt(installationFactor)}]) = ${fmt(
    correctedIz
  )} A`;

  return {
    baseIz: base,
    ambientFactor,
    groupingFactor,
    installationFactor,
    plannerSafetyFactor,
    correctedIz,
    explanation,
  };
}

/**
 * Angesetzte Belastbarkeit I_z einer Leitung.
 *
 * Die Engine rechnet mit dem STRENGEREN zweier Werte:
 *   - Planer-Pauschale `DERATE_FACTOR` (0,7) — die Iz-Wahrheit der
 *     Dimensionierung (AUDIT ELE-001), und
 *   - physikalische Korrektur f₁(ϑ_U) · f₂(n), falls Umgebungsdaten vorliegen.
 *
 * Ein Kältebonus (f₁ > 1) wird **nie** kapazitätserhöhend angesetzt: Der
 * kombinierte Faktor ist auf 1 begrenzt. Damit kann die Verifikation niemals
 * mehr Strom zulassen als die Dimensionierung.
 *
 * @throws RangeError bei unbekanntem Querschnitt (keine stille 0 A).
 */
export function effectiveAmpacityA(crossSectionMm2: number, conditions?: AmpacityConditions): AmpacityResult {
  // Eine Rechnung für beide: die zentrale Aufschlüsselung (Auftrag §7).
  const breakdown = calculateCorrectedIz(crossSectionMm2, conditions);
  const basis: AmpacityResult['basis'] =
    conditions?.ambientC === undefined && conditions?.bundledCircuits === undefined
      ? 'plan-model-pauschale'
      : 'plan-model-und-physik';
  // Kompatibilität: ohne Bedingungen trägt das Feld `ambientFactor` die
  // Pauschale (so war es historisch); mit Bedingungen den echten Faktor.
  const ambientField =
    conditions?.ambientC === undefined ? breakdown.plannerSafetyFactor : breakdown.ambientFactor;
  return {
    izA: breakdown.correctedIz,
    baseAmpacityA: breakdown.baseIz,
    ambientFactor: ambientField,
    groupingFactor: breakdown.groupingFactor,
    combinedFactor: breakdown.correctedIz / breakdown.baseIz,
    basis,
  };
}

/**
 * Betriebliche Leitererwärmung für die Spannungsfallrechnung in °C.
 *
 * 70 °C ist der ungünstigste Dauerbetriebsfall eines PVC-isolierten Leiters
 * (Grenzleitertemperatur). Der Planer rechnet mit 20 °C (kalter Wert); für
 * die Verifikation ist der warme Wert die konservative Seite (höheres ρ →
 * höherer Spannungsfall). Wer 20 °C ansetzen will, übergibt sie explizit.
 */
export const VOLTAGE_DROP_DESIGN_TEMPERATURE_C = 70;

// ============================================================================
// 4. ABSCHALTBEDINGUNG (Z_s, I_k,min, I_a)
// ============================================================================

/**
 * Spannungsfaktor c für den minimalen Kurzschlussstrom (IEC 60909-0,
 * Niederspannung: c_min = 0,95). Der konservative Fall entscheidet: kleineres
 * U ⇒ kleineres I_k ⇒ strengere Anforderung an Z_s.
 */
export const MIN_VOLTAGE_FACTOR_C = 0.95;

export interface LoopImpedanceInput {
  /** Einfache Leitungslänge in Meter. */
  lengthM: number;
  /** Querschnitt des Außenleiters in mm². */
  phaseMm2: number;
  /** Querschnitt des Rückleiters (PE bzw. Minus) in mm². */
  returnMm2: number;
  /** Innenwiderstand/Quellenimpedanz in Ω (Standard 0 = nicht angesetzt). */
  sourceResistanceOhm?: number;
  /** Übergangs-/Kontaktwiderstände in Ω (Standard 0 = nicht angesetzt). */
  contactResistanceOhm?: number;
  /** Leitetemperatur in °C (Standard 20 °C — kalter, konservativer Wert). */
  temperatureC?: number;
}

/**
 * Schleifenimpedanz Z_s = k·L·ρ(T)·(1/A_phase + 1/A_Rück) + R_Quelle + R_Übergang.
 *
 * Die Form ist identisch zu `cableLoopContributionOhm` aus `lib/acProtection.ts`
 * — dort mit ρ(20 °C) und ohne Quellen-/Übergangsanteile. Diese Funktion ist
 * die allgemeine Variante für die Verifikation (Temperatur und Zusatzanteile
 * explizit) und ruft dieselben Werkstoffkonstanten.
 *
 * @throws RangeError bei nicht-positiven Querschnitten.
 */
export function loopImpedanceOhm(input: LoopImpedanceInput): number {
  const { lengthM, phaseMm2, returnMm2 } = input;
  if (!(phaseMm2 > 0) || !(returnMm2 > 0)) {
    throw new RangeError(
      `loopImpedanceOhm: Querschnitte müssen > 0 sein (erhielt ${phaseMm2} / ${returnMm2} mm²)`
    );
  }
  const temperatureC = input.temperatureC ?? REFERENCE_TEMPERATURE_C;
  const rho = copperResistivityAt(temperatureC);
  const linePart = rho * lengthM * (1 / phaseMm2 + 1 / returnMm2);
  return linePart + (input.sourceResistanceOhm ?? 0) + (input.contactResistanceOhm ?? 0);
}

/**
 * Minimaler Kurzschluss-/Fehlerstrom I_k,min = c · U_n / Z_s.
 *
 * @throws RangeError bei Z_s ≤ 0 — Division durch 0 Ω ist kein „unendlicher
 *   Strom“, sondern eine unvollständige Rechnung.
 */
export function minimumFaultCurrentA(
  nominalVoltageV: number,
  loopImpedance: number,
  voltageFactorC: number = MIN_VOLTAGE_FACTOR_C
): number {
  if (!(loopImpedance > 0)) {
    throw new RangeError(`minimumFaultCurrentA: Z_s muss > 0 sein (erhielt ${loopImpedance})`);
  }
  if (!(voltageFactorC > 0 && voltageFactorC <= 1)) {
    throw new RangeError(`minimumFaultCurrentA: c muss in (0, 1] liegen (erhielt ${voltageFactorC})`);
  }
  return (voltageFactorC * nominalVoltageV) / loopImpedance;
}

/**
 * Abschaltbedingung (IEC 60364-4-41 §411.3.2): I_k,min ≥ I_a.
 * Gibt das Verdikt samt Randzahlen zurück, damit der Report die Rechnung
 * zeigen kann statt nur „fail“.
 */
export interface DisconnectionCheck {
  minimumFaultCurrentA: number;
  requiredTripCurrentA: number;
  satisfied: boolean;
  loopImpedanceOhm: number;
  /** Zulässige Schleifenimpedanz Z_s,max = c·U_n/I_a. */
  maxLoopImpedanceOhm: number;
}

export function checkDisconnection(
  nominalVoltageV: number,
  loopImpedance: number,
  requiredTripCurrentA: number,
  voltageFactorC: number = MIN_VOLTAGE_FACTOR_C
): DisconnectionCheck {
  if (!(requiredTripCurrentA > 0)) {
    throw new RangeError(
      `checkDisconnection: Auslösestrom I_a muss > 0 sein (erhielt ${requiredTripCurrentA})`
    );
  }
  const ikMin = minimumFaultCurrentA(nominalVoltageV, loopImpedance, voltageFactorC);
  return {
    minimumFaultCurrentA: ikMin,
    requiredTripCurrentA,
    satisfied: ikMin >= requiredTripCurrentA,
    loopImpedanceOhm: loopImpedance,
    maxLoopImpedanceOhm: (voltageFactorC * nominalVoltageV) / requiredTripCurrentA,
  };
}

// ============================================================================
// 5. SELEKTIVITÄT (I²t-Vergleich)
// ============================================================================

/** Schmelzintegral-Paar zweier in Reihe liegender Schutzeinrichtungen. */
export interface SelectivityEnergy {
  /** I²t (A²s) bis zum Ansprechen (pre-arcing) der VORGELAGERTEN Einrichtung. */
  upstreamPreArcingI2t: number;
  /** I²t (A²s) bis zum vollständigen Löschen (total clearing) der NACHGELAGERTEN. */
  downstreamClearingI2t: number;
}

/**
 * Energieseitige Selektivität: Die vorgelagerte Sicherung darf im
 * Fehlerfall nicht ansprechen, bevor die nachgelagerte gelöscht hat:
 *
 *     I²t_pre-arcing,upstream > I²t_total,downstream   (bei I_k)
 *
 * Diese Bedingung ist die physikalisch richtige Form; das Verhältnis
 * I_n,upstream/I_n,downstream ≥ 1,6 ist nur ihre Daumenregel für gleiche
 * Sicherungsfamilien (Fachliteratur, kein Normzitat).
 */
export function selectivityByEnergy(energy: SelectivityEnergy): boolean {
  return energy.upstreamPreArcingI2t > energy.downstreamClearingI2t;
}

/** Daumenregel-Verhältnis für gleichartige Sicherungen (Fachliteratur). */
export const SELECTIVITY_RATIO_HEURISTIC = 1.6;

/** RCD-Selektivität: Verhältnis der Bemessungsdifferenzströme (Fachliteratur). */
export const RCD_SELECTIVITY_RATIO_HEURISTIC = 3;
