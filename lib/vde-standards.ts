/**
 * lib/vde-standards.ts
 *
 * ZENTRALE API für alle VDE-Normen, die im Elektroplanner verwendet werden.
 *
 * Warum diese Datei?
 * =================
 * PR #299 hat die thermische Auslegung und Domain-Logik in `lib/electrical.ts`
 * zentralisiert (VDE_SIZES, VDE_AMPACITY, FUSE_MAP, DERATE_FACTOR,
 * calculateCrossSection, getEdgeDomain, getHandleDomain, …).
 *
 * Diese Datei ergänzt das um die restlichen VDE-Werte, die noch an mehreren
 * Stellen dupliziert waren:
 *   - components/edges/CableEdge.tsx (0.85 Inverter-Effizienz, / 18 Vmp)
 *   - components/nodes/ConduitNode.tsx (CONDUIT_SIZES, CABLE_OUTER_DIAMETERS, 60%)
 *   - components/planner/hooks/useDashboardMetrics.ts (0.85, 0.35, 1.15, DoD)
 *   - components/Inspector.tsx (RCD-/VDE-Hinweise)
 *
 * Bei jedem Patch konnte eine Stelle aktualisiert und die andere vergessen
 * werden, was zu inkonsistenten Ergebnissen führte. Diese Datei ist die
 * EINZIGE Stelle, an der die erweiterten VDE-Werte definiert werden.
 * Die thermische Basis kommt unverändert aus electrical.ts (Re-Exports).
 *
 * Verwendete Normen (vereinfacht auf das Camper-Use-Case):
 * -------------------------------------------------------
 * - DIN VDE 0100-721: Errichten von Niederspannungsanlagen in Wohnmobilen
 * - DIN VDE 0100-520: Kabel- und Leitungsanlagen (Füllgrad, Spannungsabfall)
 * - VDE 0298-4: Strombelastbarkeit von Kabeln
 * - DIN EN 60228: Leiter, isolierte Kabel — Normquerschnitte
 * - DIN EN 61386: Elektroinstallationsrohrsysteme (EN 20 – EN 50)
 *
 * WICHTIG: Diese Werte sind eine sichere Approximation und konservativ
 * gewählt. Für die finale Auslegung im Fahrzeug immer durch eine
 * Elektrofachkraft prüfen.
 *
 * Einheiten (seit K1b)
 * ====================
 * Alle rechnenden Funktionen dieses Moduls arbeiten mit den Branded Types aus
 * `lib/units.ts` (`Amps`, `Volts`, `Mm2`, `Meters`, `Watts`). Damit kann der
 * Compiler vertauschte Argumente ablehnen — `calculateVoltageDrop(länge, strom, …)`
 * kompiliert nicht mehr.
 *
 * Zwei Grenzen bleiben bewusst primitiv:
 *   1. Rückgabewerte sind zuweisbar an `number`, weil eine Marke zur Laufzeit
 *      eine Zahl ist. Bestehende Aufrufer brechen dadurch nicht.
 *   2. Werte aus `node.data` / `edge.data` (React Flow, localStorage) sind
 *      `unknown`-nah und werden mit `quantityOr(...)` geprüft eingelesen.
 *      Unbrauchbare Werte (negativ, NaN, Text) werden dort zu 0 bzw. zum
 *      dokumentierten Ersatzwert — genau wie vorher `Number(x) || 0`, nur
 *      jetzt an einer benannten Stelle.
 */

export {
  VDE_SIZES,
  VDE_SIZES as VDE_CROSS_SECTIONS,
  VDE_AMPACITY as VDE_AMPACITY_RAW,
  DERATE_FACTOR,
  FUSE_MAP as VDE_FUSE_MAP,
  calculateMaxFuse as calculateMaxFuseBase,
  lookupThermalCrossSection as lookupThermalCrossSectionBase,
  calculateCrossSection as calculateCrossSectionBase,
  calculateStrokeWidth,
  getEdgeDomain,
  getHandleDomain,
} from './electrical';
import { VDE_SIZES, VDE_AMPACITY, FUSE_MAP, calculateMaxFuse } from './electrical';

import type { Node, Edge } from 'reactflow';
import {
  addAmps,
  amps,
  conductorResistance,
  currentFromPower,
  divideAmps,
  maxAmps,
  maxMm2,
  meters,
  mm2,
  parseQuantity,
  quantityOr,
  scaleMeters,
  toFixedNumber,
  volts,
  voltageFromResistance,
  watts,
  ZERO_AMPS,
  ZERO_METERS,
  ZERO_WATTS,
  type Amps,
  type Meters,
  type Mm2,
  type Scalar,
  type Volts,
  type Watts,
} from './units';

// Keep a typed local alias so consumers can write `VDECrossSection`.
// electrical.ts does not mark VDE_SIZES `as const`, so this is `number`.
export type VDECrossSection = typeof VDE_SIZES[number];

// Local cable-spec shape — avoid importing CableEdgeData (circular).
type CableSpec = {
  length?: number;
  crossSection?: number;
  fuseSize?: number;
};

// Silence unused-import warnings for symbols that exist so this module
// can wrap / document the electrical.ts API without forcing every caller
// to import from two files.
void VDE_AMPACITY;
void FUSE_MAP;
void calculateMaxFuse;

// ============================================================================
// STROMBELASTBARKEIT (sichere Werte für Validierung)
// ============================================================================

/**
 * Maximale Strombelastbarkeit pro Querschnitt — konservative Validierungswerte.
 * Diese Tabelle ist bewusst runder als VDE_AMPACITY (electrical.ts) und wird
 * ausschließlich für die Validierungs-API (validateCableEdge) verwendet.
 *
 * electrical.ts / VDE_AMPACITY bleibt die Quelle für die thermische Auslegung
 * (calculateCrossSection, lookupThermalCrossSection).
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
 * Standard-Sicherungsgrößen (in A) als grobe Zuordnung zum Querschnitt.
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
 * Diese sind die Standard-Empfehlungen in calculateWire.
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

// ============================================================================
// SPANNUNGSABFALL-BERECHNUNG (mit echtem Kupferwiderstand)
// ============================================================================

/**
 * Spezifischer Widerstand von Kupfer bei 20°C in Ω·mm²/m.
 *
 * electrical.ts verwendet die Leitfähigkeit 58 m/(Ω·mm²) ≈ 1/0.01724.
 * Hier rechnen wir bewusst mit ρ = 0.0175 (etwas konservativer) und einem
 * höheren zulässigen Spannungsabfall (10% bei 12V, branchenüblich im Camper).
 *
 * R [Ω] = (ρ · L) / A
 *   ρ = 0.0175 Ω·mm²/m (Kupfer)
 *   L = Länge in m
 *   A = Querschnitt in mm²
 *
 * Spannungsabfall ΔU = R · I · 2  (Faktor 2 = Hin- und Rückleiter)
 *                   = (ρ · L · 2 · I) / A
 *
 * In 12V-Camper-Netzen sind max 10% Spannungsabfall (also 1.2V) zulässig.
 * In 230V-Netzen max 3% (6.9V) gemäß VDE 0100-520.
 */
export const VDE_COPPER_RESISTIVITY: Scalar = 0.0175; // Ω·mm²/m

/**
 * Maximal zulässiger Spannungsabfall als Bruchteil der Systemspannung.
 * VDE 0100-520 erlaubt max 3% in 230V-Netzen; bei 12V sind 10% branchenüblich.
 */
export const VDE_MAX_VOLTAGE_DROP_12V: Scalar = 0.10; // 10% von 12V = 1.2V
export const VDE_MAX_VOLTAGE_DROP_230V: Scalar = 0.03; // 3% von 230V = 6.9V

/**
 * Berechnet den erforderlichen Mindestquerschnitt in mm² für einen gegebenen
 * Strom und eine Kabellänge, sodass der Spannungsabfall den Maximalwert
 * nicht überschreitet.
 *
 * @param currentA Strom in Ampere
 * @param lengthM Länge der Leitung in Metern (einfache Strecke; Hin- und
 *                Rückleiter wird intern mit Faktor 2 berücksichtigt)
 * @param maxVoltageDropFraction Max. zulässiger Spannungsabfall als Bruchteil
 * @param systemVoltage Systemspannung (default: 12V)
 * @returns Erforderlicher Mindestquerschnitt in mm² (nicht aufgerundet)
 */
export function calculateMinCrossSection(
  currentA: Amps,
  lengthM: Meters,
  maxVoltageDropFraction: Scalar = VDE_MAX_VOLTAGE_DROP_12V,
  systemVoltage: Volts = volts(12)
): Mm2 {
  if (currentA <= 0 || lengthM <= 0) {
    return VDE_MIN_CROSS_SECTION; // 1.5 mm² ist das absolute Minimum
  }

  // ΔU_max = maxDrop * systemVoltage
  // A_min = (ρ · L · 2 · I) / ΔU_max
  const maxVoltageDrop = maxVoltageDropFraction * systemVoltage;
  return mm2((VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / maxVoltageDrop);
}

/**
 * Rundet einen Querschnitt auf den nächstgrößeren normierten Querschnitt auf.
 *
 * @param minRequired Mindestquerschnitt in mm²
 * @returns Aufgerundeter normierter Querschnitt, oder der größte VDE_SIZES-Wert
 */
export function roundUpToVDECrossSection(minRequired: Mm2): Mm2 {
  return mm2(VDE_SIZES.find(size => size >= minRequired) ?? VDE_SIZES[VDE_SIZES.length - 1]);
}

/**
 * Berechnet den tatsächlichen Spannungsabfall für einen gegebenen Strom,
 * eine Länge und einen Querschnitt.
 *
 * @returns Spannungsabfall in Volt (Hin- und Rückleiter)
 */
export function calculateVoltageDrop(
  currentA: Amps,
  lengthM: Meters,
  crossSection: Mm2,
  _systemVoltage: Volts = volts(12)
): Volts {
  // Hin- und Rückleiter: die doppelte Strecke trägt den Strom.
  // R = ρ · (2·L) / A, danach ΔU = R · I (Ohmsches Gesetz).
  //
  // Der frühere Sonderfall `crossSection <= 0 → Infinity` entfällt: `Mm2`
  // kann nicht 0 oder negativ sein (Konstruktor `mm2` wirft). Wird der Typ
  // umgangen, wirft `conductorResistance` — ein unbrauchbares Ergebnis ist
  // sichtbar statt als Infinity durch die Validierung zu wandern.
  const resistance = conductorResistance(
    scaleMeters(lengthM, 2),
    crossSection,
    VDE_COPPER_RESISTIVITY
  );
  return voltageFromResistance(resistance, currentA);
}

// ============================================================================
// LEERROHR / KABELKANAL (60% Maximum nach VDE 0100-520)
// ============================================================================

/**
 * Standard-Leerrohr-Innendurchmesser nach DIN EN 61386 (EN 20 – EN 50).
 * Werte in mm (Innendurchmesser).
 */
export const VDE_CONDUIT_INNER_DIAMETERS: Record<string, number> = {
  'EN 20': 16.9,
  'EN 25': 21.4,
  'EN 32': 28.1,
  'EN 40': 37.7,
  'EN 50': 47.2,
};

/** Maximal zulässiger Füllgrad eines Leerrohrs nach VDE 0100-520. */
export const VDE_MAX_CONDUIT_FILL_PERCENT = 60;

/**
 * Kabelaußendurchmesser pro Querschnitt in mm (gilt für FLYY/FLRY-Leitungen).
 * Wird für die Leerrohr-Füllgradberechnung benötigt.
 */
export const VDE_CABLE_OUTER_DIAMETERS: Record<number, number> = {
  1.5: 2.4,
  2.5: 3.0,
  4.0: 3.7,
  6.0: 4.3,
  10.0: 6.5,
  16.0: 8.3,
  25.0: 10.4,
  35.0: 11.6,
  50.0: 13.5,
  70.0: 15.5,
  95.0: 18.0,
  120.0: 20.0,
};

/**
 * Berechnet den Füllgrad eines Leerrohrs bei gegebenen Kabeln.
 *
 * @param conduitType Schlüssel aus VDE_CONDUIT_INNER_DIAMETERS (z.B. 'EN 20')
 * @param cableCrossSections Liste der Querschnitte der verlegten Kabel
 * @returns Füllgrad in Prozent (0–100+)
 */
export function calculateConduitFillPercent(
  conduitType: keyof typeof VDE_CONDUIT_INNER_DIAMETERS,
  cableCrossSections: readonly Mm2[]
): number {
  const innerDiameter = VDE_CONDUIT_INNER_DIAMETERS[conduitType];
  if (!innerDiameter) return 0;

  const innerArea = Math.PI * Math.pow(innerDiameter / 2, 2);

  const totalCableArea = cableCrossSections.reduce((acc, cs) => {
    const outerDiam = VDE_CABLE_OUTER_DIAMETERS[cs] ?? VDE_CABLE_OUTER_DIAMETERS[2.5];
    return acc + Math.PI * Math.pow(outerDiam / 2, 2);
  }, 0);

  return (totalCableArea / innerArea) * 100;
}

/**
 * Findet das kleinste Leerrohr, das die Kabel mit
 * <= VDE_MAX_CONDUIT_FILL_PERCENT aufnehmen kann.
 *
 * @returns Empfohlener Leerrohr-Typ oder null, wenn keiner passt
 */
export function recommendConduitType(cableCrossSections: readonly Mm2[]): string | null {
  for (const [type, diameter] of Object.entries(VDE_CONDUIT_INNER_DIAMETERS)) {
    const innerArea = Math.PI * Math.pow(diameter / 2, 2);
    const totalCableArea = cableCrossSections.reduce((acc, cs) => {
      const outerDiam = VDE_CABLE_OUTER_DIAMETERS[cs] ?? VDE_CABLE_OUTER_DIAMETERS[2.5];
      return acc + Math.PI * Math.pow(outerDiam / 2, 2);
    }, 0);
    if ((totalCableArea / innerArea) * 100 <= VDE_MAX_CONDUIT_FILL_PERCENT) {
      return type;
    }
  }
  return null;
}

// ============================================================================
// WECHSELRICHTER, RCD, SOLAR, BATTERIE
// ============================================================================

/**
 * Typischer Wirkungsgrad eines 12V→230V-Wechselrichters.
 * Hersteller-Angaben liegen meist bei 85–93%. 0.85 = 15% Verlust ist konservativ.
 */
export const VDE_INVERTER_EFFICIENCY: Scalar = 0.85;

/**
 * Maximaler empfohlener Auslastungsgrad eines Wechselrichters
 * (dauerhafte Last sollte max 80% der Nennleistung betragen).
 */
export const VDE_INVERTER_MAX_LOAD_FRACTION: Scalar = 0.80;

/**
 * Maximaler Auslösestrom eines RCD für Personenschutz nach VDE 0100-721.
 * Für Landstrom-Anschlüsse in Wohnmobilen ist ≤30mA vorgeschrieben.
 */
export const VDE_RCD_MAX_TRIP_CURRENT_MA = 30;

/**
 * Maximaler Bemessungsdifferenzstrom in mA für den 230V-Personenschutz.
 */
export const VDE_230V_PERSON_PROTECTION_MA = 30;

/**
 * Winter-Ertragsfaktor für Solarmodule (ca. 35% des Sommerertrags).
 */
export const VDE_SOLAR_WINTER_REDUCTION = 0.35;

/**
 * Typische MPP-Spannung (Vmp) eines 12V-Solarmoduls in Volt.
 * Module liefern nicht bei Systemspannung, sondern bei ~18V.
 */
export const VDE_SOLAR_VMP_VOLTAGE: Volts = volts(18);

/**
 * Ladezeit-Derating (CC/CV-Knick, Wärme, Alterung). 1.15 = +15%.
 */
export const VDE_CHARGE_DERATING_FACTOR = 1.15;

/**
 * Maximal zulässige Entladungstiefe (Depth of Discharge, DoD)
 * je nach Batterie-Chemie.
 */
export const VDE_BATTERY_DOD: Record<string, number> = {
  LiFePO4: 0.9,
  AGM: 0.5,
  Gel: 0.5,
  Blei: 0.3,
};

/**
 * Mindest-Kabelquerschnitt nach VDE 0100-721.
 * 1.5 mm² ist der absolute Mindestwert.
 */
export const VDE_MIN_CROSS_SECTION: Mm2 = mm2(1.5);

// ============================================================================
// SYSTEMSPANNUNG & KANTENSTRÖME (EINZIGE QUELLE FÜR STROM-BERECHNUNGEN)
// ============================================================================

/**
 * Ermittelt die nominale Systemspannung anhand der Batterien im Plan.
 * Default 12.8V (typisch LiFePO4) ohne explizite Angabe.
 */
export const DEFAULT_SYSTEM_VOLTAGE: Volts = volts(12.8);
export const LEAD_SYSTEM_VOLTAGE: Volts = volts(12.0);

export function getSystemVoltage(nodes: Node[]): Volts {
  const batteries = nodes.filter((n) => n.type === 'battery');
  if (batteries.length === 0) return DEFAULT_SYSTEM_VOLTAGE;

  // Explizite nominalVoltage an einer beliebigen Batterie gewinnt.
  // `node.data` stammt aus localStorage/JSON — daher geprüft einlesen und
  // unbrauchbare Werte (0, negativ, Text) überspringen statt sie zu übernehmen.
  for (const b of batteries) {
    const nominalVoltage = parseQuantity((b.data as { nominalVoltage?: unknown })?.nominalVoltage, volts);
    if (nominalVoltage !== null && nominalVoltage > 0) {
      return nominalVoltage;
    }
  }

  // Fallback: chemiebasierte Schätzung der ersten Batterie
  const chemistry = String((batteries[0].data as { chemistry?: string })?.chemistry || '').toLowerCase();
  if (chemistry === 'agm' || chemistry === 'lead' || chemistry === 'gel') {
    return LEAD_SYSTEM_VOLTAGE;
  }

  // Default für LiFePO4 und unbekannte Chemien
  return DEFAULT_SYSTEM_VOLTAGE;
}

/**
 * Berechnet den Nennstrom einer Kante aus den verbundenen Komponenten.
 *
 * DIESE Funktion ist die EINZIGE Strom-Quelle für Kabel-Dimensionierung und
 * Live-Validierung (CableEdge, calculatePathVoltageDrop, Auto-Wire). Dadurch
 * kann Auto-Wire exakt die Ströme dimensionieren, die die Validierung später
 * verwendet — Abweichungen (z.B. "Sicherung zu klein") sind damit
 * ausgeschlossen, solange die Komponentendaten unverändert bleiben.
 *
 * Prioritäten (physikalische Begründung):
 *   1. totalAmps — explizit gesetzter Gesamtstrom (z.B. Hauptleitungen)
 *   2. Solar-Kante: Panel-Strom (watts / Vmp). Die Zuleitung vom Panel zum
 *      Laderegler trägt den PANEL-Strom, nicht die Nennleistung des Reglers.
 *   3. 12V-Verbraucher: watts / Systemspannung
 *   4. Wechselrichter (DC-Seite): watts / Systemspannung / Wirkungsgrad
 *   5. Generische amps-Angabe (Laderegler, Booster, AC-Ladegeräte)
 *   6. Fallback: max(Last, Ladung) — Batterie-Hauptleitungen führen
 *      bidirektionalen Strom; Panel-Strom zählt nur ohne Laderegler
 */
export function calculateEdgeCurrent(
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  nodes: Node[],
  sysVoltage?: Volts
): Amps {
  const sData = sourceNode?.data as Record<string, unknown> | undefined;
  const tData = targetNode?.data as Record<string, unknown> | undefined;
  const voltage = sysVoltage ?? getSystemVoltage(nodes);

  /** Leistung aus `node.data` — negative/ungültige Angaben zählen als 0 W. */
  const loadOf = (data: Record<string, unknown> | undefined): Watts =>
    quantityOr(data?.watts, watts, ZERO_WATTS);
  /** Strom aus `node.data` — negative/ungültige Angaben zählen als 0 A. */
  const currentOf = (data: Record<string, unknown> | undefined): Amps =>
    quantityOr(data?.amps, amps, ZERO_AMPS);
  /** I = P / U mit der Systemspannung. */
  const currentAt = (load: Watts, at: Volts): Amps => currentFromPower(load, at);

  // 1. Expliziter Gesamtstrom (manuell gesetzt oder von Auto-Wire berechnet)
  const sourceTotal = parseQuantity(sData?.totalAmps, amps);
  if (sData?.totalAmps !== undefined) return sourceTotal ?? ZERO_AMPS;
  const targetTotal = parseQuantity(tData?.totalAmps, amps);
  if (tData?.totalAmps !== undefined) return targetTotal ?? ZERO_AMPS;

  const isSolarType = (type: string | undefined): boolean => type === 'solar' || type === 'roofSolar';

  // 2. Solar-Zuleitung: trägt den Panel-Strom, nicht die Regler-Nennleistung
  if (isSolarType(sourceNode?.type)) return currentAt(loadOf(sData), VDE_SOLAR_VMP_VOLTAGE);
  if (isSolarType(targetNode?.type)) return currentAt(loadOf(tData), VDE_SOLAR_VMP_VOLTAGE);

  // 3. 12V-Verbraucher
  if (sourceNode?.type === 'consumer') return currentAt(loadOf(sData), voltage);
  if (targetNode?.type === 'consumer') return currentAt(loadOf(tData), voltage);

  // 4. Wechselrichter (DC-Eingangsstrom inkl. Verlusten)
  if (sourceNode?.type === 'inverter') {
    return divideAmps(currentAt(loadOf(sData), voltage), VDE_INVERTER_EFFICIENCY);
  }
  if (targetNode?.type === 'inverter') {
    return divideAmps(currentAt(loadOf(tData), voltage), VDE_INVERTER_EFFICIENCY);
  }

  // 5. Generische Ampere-Angabe (Laderegler, Booster, AC-Ladegeräte)
  if (sData?.amps !== undefined && sourceNode?.type !== 'battery') return currentOf(sData);
  if (tData?.amps !== undefined && targetNode?.type !== 'battery') return currentOf(tData);

  // 6. Fallback: Systemaggregate über alle Komponenten
  // Batterie-Hauptleitungen führen bidirektionalen Strom → max(Last, Ladung).
  // Panel-Strom zählt nur, wenn kein Laderegler die Leistung bereits abbildet.
  let totalConsumerAmps: Amps = ZERO_AMPS;
  let totalChargerAmps: Amps = ZERO_AMPS;
  const hasMppt = nodes.some((n) => n.type === 'mpptController' || n.type === 'charger');
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const nData = n.data as Record<string, unknown> | undefined;
    if (n.type === 'consumer') {
      totalConsumerAmps = addAmps(totalConsumerAmps, currentAt(loadOf(nData), voltage));
    } else if (n.type === 'inverter') {
      totalConsumerAmps = addAmps(
        totalConsumerAmps,
        divideAmps(currentAt(loadOf(nData), voltage), VDE_INVERTER_EFFICIENCY)
      );
    } else if (['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(n.type as string)) {
      totalChargerAmps = addAmps(totalChargerAmps, currentOf(nData));
    } else if (isSolarType(n.type) && !hasMppt) {
      totalChargerAmps = addAmps(totalChargerAmps, currentAt(loadOf(nData), VDE_SOLAR_VMP_VOLTAGE));
    }
  }

  return maxAmps(totalConsumerAmps, totalChargerAmps);
}

// ============================================================================
// HAUPTFUNKTION: Kabelberechnung
// ============================================================================

/**
 * Berechnet den passenden Kabelquerschnitt und die empfohlene Sicherung.
 *
 * @param currentA Strom in Ampere
 * @param lengthM Kabellänge in Metern (Hin- und Rückleiter intern)
 * @returns Empfohlener Querschnitt (mm²) und Sicherungsgröße (A)
 */
export function calculateWire(
  currentA: Amps,
  lengthM: Meters
): { crossSection: Mm2; fuseSize: Amps; length: Meters; minCrossSection: Mm2 } {
  const minCrossSection = calculateMinCrossSection(currentA, lengthM);
  const minRequired = maxMm2(VDE_MIN_CROSS_SECTION, minCrossSection);
  const crossSection = roundUpToVDECrossSection(minRequired);
  const fuseSize = amps(
    VDE_CONSERVATIVE_FUSES[crossSection] ?? VDE_STANDARD_FUSES[crossSection] ?? 15
  );

  return { crossSection, fuseSize, length: lengthM, minCrossSection };
}

// ============================================================================
// VALIDIERUNG: Einzelne Edge / Komponente
// ============================================================================

/**
 * Ergebnis einer VDE-Validierung.
 */
export type VDEValidationResult = {
  isValid: boolean;
  severity: 'error' | 'warning' | 'ok';
  message: string;
  code: string; // z.B. 'UNDERSIZED_CABLE', 'MISSING_RCD'
};

/**
 * Validiert eine einzelne Kabel-Edge gegen die VDE-Norm.
 *
 * Reihenfolge der Checks (erster Treffer gewinnt):
 *   1. NO_DATA
 *   2. UNDERSIZED_CABLE
 *   3. HIGH_VOLTAGE_DROP
 *   4. OVERSIZED_FUSE
 *   5. NON_STANDARD_CROSS_SECTION
 *   6. OK
 */
export function validateCableEdge(
  edge: Edge<CableSpec>,
  _sourceNode: Node | undefined,
  _targetNode: Node | undefined,
  currentA: Amps
): VDEValidationResult {
  const data = edge.data;
  if (!data) {
    return {
      isValid: false,
      severity: 'error',
      message: 'Kabel hat keine Spezifikationen (Länge/Querschnitt fehlt).',
      code: 'NO_DATA',
    };
  }

  // Persistenzgrenze: `edge.data` kommt aus localStorage / React Flow.
  // Ein fehlender oder unbrauchbarer Querschnitt ist "kein Querschnitt"
  // und wird unten als UNDERSIZED_CABLE gemeldet — nicht stillschweigend
  // durch das Minimum ersetzt.
  const rawCrossSection = data.crossSection ?? 0;
  const crossSection = parseQuantity(data.crossSection, mm2);
  const length = quantityOr(data.length, meters, ZERO_METERS);

  // 1. Mindest-Querschnitt
  if (crossSection === null || crossSection < VDE_MIN_CROSS_SECTION) {
    return {
      isValid: false,
      severity: 'error',
      message: `Kabel-Querschnitt ${rawCrossSection} mm² ist kleiner als das VDE-Minimum von ${VDE_MIN_CROSS_SECTION} mm².`,
      code: 'UNDERSIZED_CABLE',
    };
  }

  // 2. Spannungsabfall
  const voltageDrop = calculateVoltageDrop(currentA, length, crossSection);
  if (voltageDrop > VDE_MAX_VOLTAGE_DROP_12V * 12) {
    return {
      isValid: false,
      severity: 'warning',
      message: `Spannungsabfall ${toFixedNumber(voltageDrop, 2).toFixed(2)}V überschreitet ${(VDE_MAX_VOLTAGE_DROP_12V * 100).toFixed(0)}% von 12V. Kabel evtl. zu schwach dimensioniert.`,
      code: 'HIGH_VOLTAGE_DROP',
    };
  }

  // 3. Sicherung gegen Querschnitt
  if (data.fuseSize) {
    const maxFuse = VDE_CURRENT_CAPACITY[crossSection] ?? Infinity;
    if (data.fuseSize > maxFuse) {
      return {
        isValid: false,
        severity: 'error',
        message: `Sicherung ${data.fuseSize}A ist zu groß für ${crossSection} mm² Kabel (max ${maxFuse}A). Brandgefahr!`,
        code: 'OVERSIZED_FUSE',
      };
    }
  }

  // 4. Normierter Querschnitt?
  if (!VDE_SIZES.includes(crossSection)) {
    return {
      isValid: false,
      severity: 'warning',
      message: `Querschnitt ${crossSection} mm² ist kein normierter Wert. Empfohlen: ${roundUpToVDECrossSection(crossSection)} mm².`,
      code: 'NON_STANDARD_CROSS_SECTION',
    };
  }

  return {
    isValid: true,
    severity: 'ok',
    message: 'Kabel ist VDE-konform dimensioniert.',
    code: 'OK',
  };
}

/**
 * Validiert, ob eine Batterie-Komponente korrekt konfiguriert ist.
 */
export function validateBatteryNode(node: Node): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const data = node.data as { chemistry?: string };
  const chemistry = data?.chemistry || 'LiFePO4';
  const dod = VDE_BATTERY_DOD[chemistry];

  if (!dod) {
    results.push({
      isValid: false,
      severity: 'warning',
      message: `Unbekannte Batterie-Chemie "${chemistry}". Verwendete DoD könnte falsch sein.`,
      code: 'UNKNOWN_CHEMISTRY',
    });
  }

  return results;
}

/**
 * Validiert, ob ein Landstrom-Anschluss einen RCD hat (VDE 0100-721 Pflicht).
 */
export function validateShorePowerNode(node: Node): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const data = node.data as { hasRcd?: boolean; label?: string };

  if (!data?.hasRcd) {
    results.push({
      isValid: false,
      severity: 'error',
      message: `Landstromanschluss "${data?.label || ''}" hat keinen RCD (FI-Schalter ≤${VDE_RCD_MAX_TRIP_CURRENT_MA}mA). Nach DIN VDE 0100-721 vorgeschrieben!`,
      code: 'MISSING_RCD',
    });
  }

  return results;
}

/**
 * Validiert, ob ein Wechselrichter überlastet ist.
 */
export function validateInverterNode(node: Node, allNodes: Node[]): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const data = node.data as { continuousPower?: number; concurrentDevices?: string[] };
  const continuousPower = data?.continuousPower || 0;
  const concurrentDevices = data?.concurrentDevices || [];

  if (continuousPower <= 0) return results;

  const totalLoad = allNodes
    .filter(n => n.type === 'consumer230v' && concurrentDevices.includes(n.id))
    .reduce((acc, n) => acc + ((n.data as { watts?: number })?.watts || 0), 0);

  const maxAllowed = continuousPower * VDE_INVERTER_MAX_LOAD_FRACTION;

  if (totalLoad > continuousPower) {
    results.push({
      isValid: false,
      severity: 'error',
      message: `Wechselrichter überlastet: ${totalLoad}W angeschlossene Last übersteigt Nennleistung ${continuousPower}W.`,
      code: 'INVERTER_OVERLOADED',
    });
  } else if (totalLoad > maxAllowed) {
    results.push({
      isValid: false,
      severity: 'warning',
      message: `Wechselrichter-Auslastung ${totalLoad}W übersteigt empfohlene ${VDE_INVERTER_MAX_LOAD_FRACTION * 100}% der Nennleistung (${maxAllowed}W).`,
      code: 'INVERTER_NEAR_LIMIT',
    });
  }

  return results;
}

/**
 * Validiert einen kompletten Schaltplan und gibt alle Verstöße zurück.
 */
export function validateSchematic(
  nodes: Node[],
  edges: Edge<CableSpec>[]
): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // 1. Alle Edges prüfen
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    // Bewusst die nominalen 12 V und nicht getSystemVoltage(): diese
    // Plausibilitätsprüfung soll unabhängig von der Batteriechemie immer
    // dasselbe Ergebnis liefern (siehe Tests in vde-standards.test.ts).
    const nominal12V = volts(12);
    let currentA: Amps = ZERO_AMPS;
    if (sourceNode?.type === 'consumer') {
      currentA = currentFromPower(quantityOr(sourceNode.data?.watts, watts, ZERO_WATTS), nominal12V);
    } else if (targetNode?.type === 'consumer') {
      currentA = currentFromPower(quantityOr(targetNode.data?.watts, watts, ZERO_WATTS), nominal12V);
    } else if (sourceNode?.type === 'charger') {
      currentA = quantityOr(sourceNode.data?.amps, amps, ZERO_AMPS);
    } else if (targetNode?.type === 'charger') {
      currentA = quantityOr(targetNode.data?.amps, amps, ZERO_AMPS);
    }

    const result = validateCableEdge(edge, sourceNode, targetNode, currentA);
    if (result.severity !== 'ok') {
      results.push(result);
    }
  }

  // 2. Alle Nodes prüfen
  for (const node of nodes) {
    if (node.type === 'battery') {
      results.push(...validateBatteryNode(node));
    } else if (node.type === 'shorePower') {
      results.push(...validateShorePowerNode(node));
    } else if (node.type === 'inverter') {
      results.push(...validateInverterNode(node, nodes));
    }
  }

  return results;
}
