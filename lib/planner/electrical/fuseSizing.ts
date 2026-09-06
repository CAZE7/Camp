/**
 * lib/planner/electrical/fuseSizing.ts
 *
 * Sicherungs-Auslegung passend zum Kabelquerschnitt.
 */

/**
 * Standard-Sicherungsgrößen (in A) je Querschnitt.
 * Wird als Vorschlag verwendet, wenn der Nutzer eine Sicherung setzt.
 */
export const VDE_STANDARD_FUSES: Record<number, number> = {
  1.5: 15,
  2.5: 20,
  4.0: 30,
  6.0: 40,
  10.0: 60,
  16.0: 80,
  25.0: 100,
  35.0: 150,
  50.0: 200,
  70.0: 250,
  95.0: 300,
  120.0: 350,
};

/**
 * Konservativere Sicherungs-Vorschläge (etwa 80% der max. Strombelastbarkeit).
 * Standard-Empfehlungen im AutoWire.
 */
export const VDE_CONSERVATIVE_FUSES: Record<number, number> = {
  1.5: 10,
  2.5: 16,
  4.0: 25,
  6.0: 40,
  10.0: 60,
  16.0: 80,
  25.0: 100,
  35.0: 125,
  50.0: 160,
  70.0: 200,
};

/**
 * Empfiehlt eine Sicherungsgröße für einen Querschnitt.
 *
 * @param crossSection Querschnitt in mm²
 * @param conservative Wenn true, konservative (kleinere) Empfehlung.
 * @returns Empfohlene Sicherungsgröße in A, oder 15A als Fallback.
 */
export function recommendFuseSize(crossSection: number, conservative = true): number {
  const table = conservative ? VDE_CONSERVATIVE_FUSES : VDE_STANDARD_FUSES;
  return table[crossSection] ?? VDE_STANDARD_FUSES[crossSection] ?? 15;
}
