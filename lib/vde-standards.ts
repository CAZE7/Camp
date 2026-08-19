/**
 * lib/vde-standards.ts
 *
 * ZENTRALE API für alle VDE-Normen, die im Elektroplanner verwendet werden.
 *
 * Die thermische Basis (VDE_SIZES, VDE_AMPACITY, FUSE_MAP, calculateCrossSection,
 * getEdgeDomain, getHandleDomain, Kupfer-/Spannungsfall-Konstanten) kommt aus
 * `./electrical` und wird von hier aus re-exportiert. Es gibt KEINE zweite,
 * abweichende Implementierung mehr.
 *
 * Diese Datei ergänzt die Werte, die über die reine Kabeldimensionierung
 * hinausgehen:
 *   - Strombelastbarkeits- / Sicherungs-Vorschlagstabellen
 *   - Leerrohr / Füllgrad (VDE 0100-520 / DIN EN 61386)
 *   - Wechselrichter-Wirkungsgrad & -Auslastung
 *   - RCD 30 mA Personenschutz
 *   - Solar (Vmp, Winter-Ertrag), Lade-Derating, Batterie-DoD
 *   - High-level Validierung (validateCableEdge, validateSchematic, …)
 *
 * Verwendete Normen (vereinfacht auf das Camper-Use-Case):
 * - DIN VDE 0100-721: Errichten von Niederspannungsanlagen in Wohnmobilen
 * - DIN VDE 0100-520: Kabel- und Leitungsanlagen (Füllgrad, Spannungsabfall)
 * - VDE 0298-4: Strombelastbarkeit von Kabeln
 * - DIN EN 60228: Leiter, isolierte Kabel — Normquerschnitte
 * - DIN EN 61386: Elektroinstallationsrohrsysteme (EN 20 – EN 50)
 *
 * WICHTIG: Diese Werte sind eine sichere Approximation und konservativ
 * gewählt. Für die finale Auslegung im Fahrzeug immer durch eine
 * Elektrofachkraft prüfen.
 */

export {
  VDE_SIZES,
  VDE_SIZES as VDE_CROSS_SECTIONS,
  VDE_AMPACITY,
  VDE_AMPACITY as VDE_AMPACITY_RAW,
  DERATE_FACTOR,
  FUSE_MAP as VDE_FUSE_MAP,
  VDE_COPPER_RESISTIVITY,
  VDE_COPPER_CONDUCTIVITY,
  VDE_MAX_VOLTAGE_DROP_12V,
  VDE_MAX_VOLTAGE_DROP_230V,
  VDE_MAX_DROP_VOLTS_DC_12V,
  VDE_MAX_DROP_VOLTS_AC_230V,
  VDE_NOMINAL_DC_VOLTAGE,
  VDE_NOMINAL_AC_VOLTAGE,
  VDE_MIN_CROSS_SECTION,
  calculateMaxFuse as calculateMaxFuseBase,
  lookupThermalCrossSection as lookupThermalCrossSectionBase,
  calculateCrossSection as calculateCrossSectionBase,
  calculateStrokeWidth,
  getEdgeDomain,
  getHandleDomain,
} from './electrical';

import {
  VDE_SIZES,
  VDE_AMPACITY,
  FUSE_MAP,
  VDE_COPPER_RESISTIVITY,
  VDE_MAX_VOLTAGE_DROP_12V,
  VDE_MAX_VOLTAGE_DROP_230V,
  VDE_MAX_DROP_VOLTS_DC_12V,
  VDE_MAX_DROP_VOLTS_AC_230V,
  VDE_MIN_CROSS_SECTION,
  calculateMaxFuse,
} from './electrical';

import type { Node, Edge } from 'reactflow';

// Keep a typed local alias so consumers can write `VDECrossSection`.
// electrical.ts does not mark VDE_SIZES `as const`, so this is `number`.
export type VDECrossSection = typeof VDE_SIZES[number];

// Local cable-spec shape — avoid importing CableEdgeData (circular).
type CableSpec = {
  length?: number;
  crossSection?: number;
  fuseSize?: number;
  edgeDomain?: 'DC_12V' | 'AC_230V' | string;
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
 *
 * Jeder Wert liegt <= VDE_CURRENT_CAPACITY[cs], also wird der Leiter durch
 * die gewählte Sicherung thermisch nicht überlastet.
 */
export const VDE_STANDARD_FUSES: Record<number, number> = {
  1.5: 16,
  2.5: 20,
  4.0: 25,
  6.0: 32,
  10.0: 50,
  16.0: 63,
  25.0: 80,
  35.0: 100,
  50.0: 125,
  70.0: 160,
  95.0: 250,
  120.0: 300,
};

/**
 * Konservativere Sicherungs-Vorschläge (kleiner als die Standardwerte, für
 * berechnete Querschnitte in `calculateWire`). Für jeden Wert gilt:
 * conservative <= standard <= Ampacity.
 */
export const VDE_CONSERVATIVE_FUSES: Record<number, number> = {
  1.5: 10,
  2.5: 16,
  4.0: 20,
  6.0: 25,
  10.0: 40,
  16.0: 50,
  25.0: 63,
  35.0: 80,
  50.0: 100,
  70.0: 125,
};

// ============================================================================
// SPANNUNGSABFALL-BERECHNUNG (mit echtem Kupferwiderstand)
// ============================================================================

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
  currentA: number,
  lengthM: number,
  maxVoltageDropFraction: number = VDE_MAX_VOLTAGE_DROP_12V,
  systemVoltage: number = 12
): number {
  if (
    !Number.isFinite(currentA) ||
    !Number.isFinite(lengthM) ||
    currentA <= 0 ||
    lengthM <= 0
  ) {
    return VDE_MIN_CROSS_SECTION; // 1.5 mm² ist das absolute Minimum
  }

  // ΔU_max = maxDrop * systemVoltage
  // A_min = (ρ · L · 2 · I) / ΔU_max
  const maxVoltageDrop = maxVoltageDropFraction * systemVoltage;
  const minCrossSection = (VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / maxVoltageDrop;
  return minCrossSection;
}

/**
 * Rundet einen Querschnitt auf den nächstgrößeren normierten Querschnitt auf.
 *
 * @param minRequired Mindestquerschnitt in mm²
 * @returns Aufgerundeter normierter Querschnitt, oder der größte VDE_SIZES-Wert
 */
export function roundUpToVDECrossSection(minRequired: number): number {
  return VDE_SIZES.find(size => size >= minRequired) ?? VDE_SIZES[VDE_SIZES.length - 1];
}

/**
 * Berechnet den tatsächlichen Spannungsabfall für einen gegebenen Strom,
 * eine Länge und einen Querschnitt.
 *
 * @returns Spannungsabfall in Volt (Hin- und Rückleiter)
 */
export function calculateVoltageDrop(
  currentA: number,
  lengthM: number,
  crossSection: number
): number {
  if (!Number.isFinite(currentA) || !Number.isFinite(lengthM)) return 0;
  if (crossSection <= 0) return Infinity;
  // ΔU = (ρ · L · 2 · I) / A
  return (VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / crossSection;
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
 * Summiert die Kabel-Querschnittsflächen. Ungültige Querschnitte (<=0 oder
 * nicht in der Tabelle bekannt) führen zu einem `null`-Ergebnis, statt still
 * mit 2.5 mm² weiterzurechnen (was vorher zu klein dimensionierte Rohre
 * empfehlen konnte).
 */
function sumCableAreas(cableCrossSections: number[]): number | null {
  let totalCableArea = 0;
  for (const cs of cableCrossSections) {
    if (typeof cs !== 'number' || !Number.isFinite(cs) || cs <= 0) {
      return null;
    }
    const outerDiam = VDE_CABLE_OUTER_DIAMETERS[cs];
    if (!outerDiam) {
      return null;
    }
    totalCableArea += Math.PI * Math.pow(outerDiam / 2, 2);
  }
  return totalCableArea;
}

/**
 * Berechnet den Füllgrad eines Leerrohrs bei gegebenen Kabeln.
 *
 * @returns Füllgrad in Prozent (0–100+) oder `null`, wenn ein Querschnitt
 *          unbekannt ist.
 */
export function calculateConduitFillPercent(
  conduitType: keyof typeof VDE_CONDUIT_INNER_DIAMETERS,
  cableCrossSections: number[]
): number {
  const innerDiameter = VDE_CONDUIT_INNER_DIAMETERS[conduitType];
  if (!innerDiameter) return 0;

  const totalCableArea = sumCableAreas(cableCrossSections);
  if (totalCableArea === null) return 0;

  const innerArea = Math.PI * Math.pow(innerDiameter / 2, 2);
  return (totalCableArea / innerArea) * 100;
}

/**
 * Findet das kleinste Leerrohr, das die Kabel mit
 * <= VDE_MAX_CONDUIT_FILL_PERCENT aufnehmen kann.
 *
 * @returns Empfohlener Leerrohr-Typ oder null, wenn keiner passt oder ein
 *          Querschnitt unbekannt ist.
 */
export function recommendConduitType(cableCrossSections: number[]): string | null {
  const totalCableArea = sumCableAreas(cableCrossSections);
  if (totalCableArea === null) return null;

  for (const [type, diameter] of Object.entries(VDE_CONDUIT_INNER_DIAMETERS)) {
    const innerArea = Math.PI * Math.pow(diameter / 2, 2);
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
export const VDE_INVERTER_EFFICIENCY = 0.85;

/**
 * Maximaler empfohlener Auslastungsgrad eines Wechselrichters
 * (dauerhafte Last sollte max 80% der Nennleistung betragen).
 */
export const VDE_INVERTER_MAX_LOAD_FRACTION = 0.80;

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
export const VDE_SOLAR_VMP_VOLTAGE = 18;

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
 * Dauerhafter Entladestrom als Vielfaches der Nennkapazität (1C = 1 h).
 * 1C ist ein konservativer, praxisüblicher Wert für die Dimensionierung der
 * Batterie-Hauptleitung ohne Kenntnis der genauen Zellspezifikation.
 */
export const VDE_BATTERY_MAX_DISCHARGE_C_RATE = 1.0;

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
  currentA: number,
  lengthM: number
): { crossSection: number; fuseSize: number; length: number; minCrossSection: number } {
  const minCrossSection = calculateMinCrossSection(currentA, lengthM);
  const minRequired = Math.max(VDE_MIN_CROSS_SECTION, minCrossSection);
  const crossSection = roundUpToVDECrossSection(minRequired);
  const fuseSize =
    VDE_CONSERVATIVE_FUSES[crossSection] ??
    VDE_STANDARD_FUSES[crossSection] ??
    VDE_FUSE_FALLBACK;

  return { crossSection, fuseSize, length: lengthM, minCrossSection };
}

/** Fallback-Sicherungswert, falls für einen Querschnitt nichts gepflegt ist. */
export const VDE_FUSE_FALLBACK = 15;

// ============================================================================
// VALIDIERUNG: Einzelne Edge / Komponente
// ============================================================================

export type VDEValidationResult = {
  isValid: boolean;
  severity: 'error' | 'warning' | 'ok';
  message: string;
  code: string; // z.B. 'UNDERSIZED_CABLE', 'MISSING_RCD'
};

/**
 * Ermittelt das Spannungsfall-Limit (in Volt) anhand der Kanten-Domäne.
 * Unbekannte Domänen fallen auf DC_12V zurück (konservativ).
 */
export function maxVoltageDropForDomain(edgeDomain: string | undefined): number {
  if (edgeDomain === 'AC_230V') return VDE_MAX_DROP_VOLTS_AC_230V; // 6.9V
  return VDE_MAX_DROP_VOLTS_DC_12V; // 1.2V
}

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
  currentA: number
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

  const crossSection = data.crossSection ?? 0;
  const length = data.length ?? 0;

  // 1. Mindest-Querschnitt
  if (crossSection < VDE_MIN_CROSS_SECTION) {
    return {
      isValid: false,
      severity: 'error',
      message: `Kabel-Querschnitt ${crossSection} mm² ist kleiner als das VDE-Minimum von ${VDE_MIN_CROSS_SECTION} mm².`,
      code: 'UNDERSIZED_CABLE',
    };
  }

  // 2. Spannungsabfall — domänensensibel (1.2V bei 12V DC, 6.9V bei 230V AC).
  const voltageDrop = calculateVoltageDrop(currentA, length, crossSection);
  const maxDrop = maxVoltageDropForDomain(data.edgeDomain);
  const dropFraction =
    data.edgeDomain === 'AC_230V' ? VDE_MAX_VOLTAGE_DROP_230V : VDE_MAX_VOLTAGE_DROP_12V;
  const systemVoltage = data.edgeDomain === 'AC_230V' ? 230 : 12;
  if (voltageDrop > maxDrop) {
    return {
      isValid: false,
      severity: 'warning',
      message: `Spannungsabfall ${voltageDrop.toFixed(2)}V überschreitet ${(dropFraction * 100).toFixed(0)}% von ${systemVoltage}V. Kabel evtl. zu schwach dimensioniert.`,
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

    let currentA = 0;
    if (sourceNode?.type === 'consumer') {
      currentA = ((sourceNode.data as { watts?: number }).watts || 0) / 12;
    } else if (targetNode?.type === 'consumer') {
      currentA = ((targetNode.data as { watts?: number }).watts || 0) / 12;
    } else if (sourceNode?.type === 'charger') {
      currentA = (sourceNode.data as { amps?: number }).amps || 0;
    } else if (targetNode?.type === 'charger') {
      currentA = (targetNode.data as { amps?: number }).amps || 0;
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
