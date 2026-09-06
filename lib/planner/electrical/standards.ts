/**
 * lib/planner/electrical/standards.ts
 *
 * Grundlegende VDE-Normwerte (Tabellen & Konstanten).
 *
 * Dies ist die Basis-Schicht des getrennten Elektrik-Moduls. Sie enthält
 * bewusst NUR Werte und Typen — keine Berechnungen und keine Validierung.
 * Berechnungen liegen in cableSizing / voltageDrop / ampacity / fuseSizing,
 * die Validierung in validation.ts.
 *
 * Verwendete Normen (vereinfacht auf den Camper-Use-Case):
 *  - DIN VDE 0100-721: Errichten von Niederspannungsanlagen in Wohnmobilen
 *  - DIN VDE 0100-520: Kabel- und Leitungsanlagen
 *  - VDE 0298-4: Strombelastbarkeit von Kabeln
 *
 * WICHTIG: Diese Werte sind eine sichere Approximation und konservativ gewählt.
 * Für die finale Auslegung im Fahrzeug immer durch eine Elektrofachkraft prüfen.
 */

/** Standard-Kabelquerschnitte in mm² (Normreihe DIN EN 60228). */
export const VDE_CROSS_SECTIONS = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0, 120.0] as const;

/** Typ für einen validen Kabelquerschnitt. */
export type VDECrossSection = typeof VDE_CROSS_SECTIONS[number];

/** Mindest-Kabelquerschnitt nach VDE 0100-721. 1.5 mm² ist das absolute Minimum. */
export const VDE_MIN_CROSS_SECTION = 1.5;

/** Maximal zulässige Entladungstiefe (Depth of Discharge, DoD) je Batterie-Chemie. */
export const VDE_BATTERY_DOD: Record<string, number> = {
  LiFePO4: 0.9,
  AGM: 0.5,
  Gel: 0.5,
  Blei: 0.3,
};

/** Typischer Wirkungsgrad eines 12V→230V-Wechselrichters (konservativ 85%). */
export const VDE_INVERTER_EFFICIENCY = 0.85;

/** Maximaler empfohlener Auslastungsgrad eines Wechselrichters (80% der Nennleistung). */
export const VDE_INVERTER_MAX_LOAD_FRACTION = 0.8;

/**
 * Maximaler Auslösestrom eines RCD für Personenschutz nach VDE 0100-721.
 * Für Landstrom-Anschlüsse in Wohnmobilen ist ≤30mA vorgeschrieben.
 */
export const VDE_RCD_MAX_TRIP_CURRENT_MA = 30;

/** Maximaler Bemessungsdifferenzstrom in mA für den 230V-Personenschutz. */
export const VDE_230V_PERSON_PROTECTION_MA = 30;
