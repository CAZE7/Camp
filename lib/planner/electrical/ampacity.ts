/**
 * lib/planner/electrical/ampacity.ts
 *
 * Strombelastbarkeit von Kabeln (Ampere pro Querschnitt) nach VDE 0298-4.
 *
 * Diese Tabelle bestimmt, welcher Querschnitt für einen gegebenen Strom
 * gewählt werden MUSS (min.) und welche Sicherung maximal zulässig ist.
 */

/**
 * Maximale Strombelastbarkeit pro Querschnitt nach VDE 0298-4
 * (Verlegeart C: Kabel im Leerrohr auf Holzwand, einadrig).
 * Werte konservativ mit ca. 20% Sicherheitsmarge.
 */
export const VDE_CURRENT_CAPACITY: Record<number, number> = {
  1.5: 16,
  2.5: 25,
  4.0: 32,
  6.0: 50,
  10.0: 70,
  16.0: 100,
  25.0: 130,
  35.0: 150,
  50.0: 200,
  70.0: 250,
  95.0: 300,
  120.0: 350,
};

/**
 * Maximal zulässiger Dauerstrom für einen Querschnitt.
 *
 * @param crossSection Querschnitt in mm²
 * @returns            Max. Strom in A, oder 0 wenn unbekannt
 */
export function maxSustainedCurrent(crossSection: number): number {
  return VDE_CURRENT_CAPACITY[crossSection] ?? 0;
}
