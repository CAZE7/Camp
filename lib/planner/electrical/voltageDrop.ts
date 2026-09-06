/**
 * lib/planner/electrical/voltageDrop.ts
 *
 * Spannungsabfall-Berechnung nach VDE 0100-520 / VDE 0100-521.
 */

/** Spezifischer Widerstand von Kupfer bei 20°C in Ω·mm²/m. */
export const VDE_COPPER_RESISTIVITY = 0.0175;

import { VDE_CROSS_SECTIONS, VDE_MIN_CROSS_SECTION } from './standards';

/** Maximal zulässiger Spannungsabfall als Bruchteil der Systemspannung. */
export const VDE_MAX_VOLTAGE_DROP_12V = 0.10; // 10% von 12V = 1.2V
export const VDE_MAX_VOLTAGE_DROP_230V = 0.03; // 3% von 230V = 6.9V

/**
 * Berechnet den erforderlichen Mindestquerschnitt in mm² für einen gegebenen
 * Strom und eine Kabellänge, sodass der Spannungsabfall den Maximalwert
 * nicht überschreitet.
 *
 * @param currentA Strom in Ampere
 * @param lengthM Länge der Leitung in Metern
 * @param maxVoltageDropFraction Max. zulässiger Spannungsabfall (default 10%)
 * @param systemVoltage Systemspannung (default 12V)
 * @returns Erforderlicher Mindestquerschnitt in mm²
 */
export function calculateMinCrossSection(
  currentA: number,
  lengthM: number,
  maxVoltageDropFraction: number = VDE_MAX_VOLTAGE_DROP_12V,
  systemVoltage: number = 12
): number {
  if (currentA <= 0 || lengthM <= 0) {
    // VDE_MIN_CROSS_SECTION ist das absolute Minimum.
    return VDE_MIN_CROSS_SECTION;
  }

  // ΔU_max = maxDrop * systemVoltage
  // A_min = (ρ · L · 2 · I) / ΔU_max   (Faktor 2: Hin- und Rückleiter)
  const maxVoltageDrop = maxVoltageDropFraction * systemVoltage;
  return (VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / maxVoltageDrop;
}

/**
 * Rundet einen Querschnitt auf den nächstgrößeren normierten Querschnitt auf.
 *
 * @param minRequired Mindestquerschnitt in mm²
 * @returns Aufgerundeter normierter Querschnitt, oder 120 mm² wenn größer
 */
export function roundUpToVDECrossSection(minRequired: number): number {
  return VDE_CROSS_SECTIONS.find((size) => size >= minRequired) ?? VDE_CROSS_SECTIONS[VDE_CROSS_SECTIONS.length - 1];
}

/**
 * Berechnet den tatsächlichen Spannungsabfall in Volt.
 *
 * @returns Spannungsabfall in Volt
 */
export function calculateVoltageDrop(
  currentA: number,
  lengthM: number,
  crossSection: number,
  systemVoltage: number = 12
): number {
  if (crossSection <= 0) return Infinity;
  // ΔU = (ρ · L · 2 · I) / A
  return (VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / crossSection;
}
