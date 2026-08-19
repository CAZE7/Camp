/**
 * lib/vde-standards.ts
 *
 * SINGLE SOURCE OF TRUTH für alle VDE-Normen, die im Elektroplanner verwendet werden.
 *
 * Warum diese Datei?
 * =================
 * Vorher waren die VDE-Werte an mehreren Stellen dupliziert:
 *   - store/usePlannerStore.ts (calculateWire)
 *   - components/edges/CableEdge.tsx (eigene VDE-Berechnung)
 *   - components/nodes/ConduitNode.tsx (CONDUIT_SIZES, CABLE_OUTER_DIAMETERS)
 *   - components/planner/hooks/useDashboardMetrics.ts (0.85 Inverter-Effizienz)
 *   - components/Inspector.tsx (RCD-Hinweise)
 *
 * Bei jedem Patch konnte eine Stelle aktualisiert und die andere vergessen werden,
 * was zu inkonsistenten Ergebnissen führte. Diese Datei ist die EINZIGE Stelle,
 * an der VDE-Werte definiert werden.
 *
 * Verwendete Normen (vereinfacht auf das Camper-Use-Case):
 * -------------------------------------------------------
 * - DIN VDE 0100-721: Errichten von Niederspannungsanlagen in Wohnmobilen
 * - DIN VDE 0100-520: Kabel- und Leitungsanlagen
 * - VDE 0298-4: Strombelastbarkeit von Kabeln
 *
 * WICHTIG: Diese Werte sind eine sichere Approximation und konservativ gewählt.
 * Für die finale Auslegung im Fahrzeug immer durch eine Elektrofachkraft prüfen.
 */

import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../components/edges/CableEdge';

// ============================================================================
// KABEL-QUERSCHNITTE (Normreihe nach DIN EN 60228)
// ============================================================================

/**
 * Standard-Kabelquerschnitte in mm².
 * Diese Werte sind in der EU genormt und sollten NIE geändert werden.
 * Wenn die Norm erweitert wird: hier hinzufügen, niemals inline überschreiben.
 */
export const VDE_CROSS_SECTIONS = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0, 120.0] as const;

/** Typ für einen validen Kabelquerschnitt */
export type VDECrossSection = typeof VDE_CROSS_SECTIONS[number];

// ============================================================================
// STROMBELASTBARKEIT (Ampere pro Querschnitt)
// ============================================================================

/**
 * Maximale Strombelastbarkeit pro Querschnitt nach VDE 0298-4
 * (Verlegeart C: Kabel im Leerrohr auf Holzwand, einadrig).
 * Werte sind konservativ mit ca. 20% Sicherheitsmarge.
 *
 * Diese Tabelle bestimmt:
 * - Welcher Querschnitt für einen gegebenen Strom gewählt werden MUSS (min.)
 * - Welche maximale Sicherung für einen gegebenen Querschnitt zulässig ist
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
 * Standard-Sicherungsgrößen (in A), die dem nächstgrößten Querschnitt entsprechen.
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
 * Diese sind die Standard-Empfehlungen im autoWireSystem.
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
// SPANNUNGSABFALL-BERECHNUNG
// ============================================================================

/**
 * Spezifischer Widerstand von Kupfer bei 20°C in Ω·mm²/m.
 * Wird für die Spannungsabfall-Berechnung benötigt.
 *
 * R [Ω] = (ρ · L) / A
 *   ρ = 0.0175 Ω·mm²/m (Kupfer)
 *   L = Länge in m
 *   A = Querschnitt in mm²
 *
 * Spannungsabfall ΔU = R · I = (ρ · L · I) / A
 *
 * In 12V-Camper-Netzen sind max 10% Spannungsabfall (also 1.2V) zulässig.
 * In 230V-Netzen max 3% (6.9V) gemäß VDE 0100-520.
 */
export const VDE_COPPER_RESISTIVITY = 0.0175; // Ω·mm²/m

/**
 * Maximal zulässiger Spannungsabfall als Bruchteil der Systemspannung.
 * VDE 0100-521 erlaubt max 3% in 230V-Netzen; bei 12V sind 10% branchenüblich.
 */
export const VDE_MAX_VOLTAGE_DROP_12V = 0.10; // 10% von 12V = 1.2V
export const VDE_MAX_VOLTAGE_DROP_230V = 0.03; // 3% von 230V = 6.9V

/**
 * Berechnet den erforderlichen Mindestquerschnitt in mm² für einen gegebenen Strom
 * und eine Kabellänge, sodass der Spannungsabfall den Maximalwert nicht überschreitet.
 *
 * @param currentA Strom in Ampere
 * @param lengthM Länge der Leitung in Metern (Hin- und Rückleiter, also 2x)
 * @param maxVoltageDropFraction Max. zulässiger Spannungsabfall als Bruchteil (default: 10%)
 * @param systemVoltage Systemspannung (default: 12V)
 * @returns Erforderlicher Mindestquerschnitt in mm²
 */
export function calculateMinCrossSection(
  currentA: number,
  lengthM: number,
  maxVoltageDropFraction: number = VDE_MAX_VOLTAGE_DROP_12V,
  systemVoltage: number = 12
): number {
  if (currentA <= 0 || lengthM <= 0) {
    return VDE_CROSS_SECTIONS[0]; // 1.5 mm² ist das absolute Minimum
  }

  // ΔU_max = maxDrop * systemVoltage
  // A_min = (ρ · L · 2 · I) / ΔU_max
  // Faktor 2 für Hin- und Rückleiter
  const maxVoltageDrop = maxVoltageDropFraction * systemVoltage;
  const minCrossSection = (VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / maxVoltageDrop;
  return minCrossSection;
}

/**
 * Rundet einen Querschnitt auf den nächstgrößeren normierten Querschnitt auf.
 *
 * @param minRequired Mindestquerschnitt in mm²
 * @returns Aufgeundeter normierter Querschnitt, oder 120 mm² wenn größer
 */
export function roundUpToVDECrossSection(minRequired: number): number {
  // Bei Cross-Sections > 120 mm² wird der größte verfügbare Wert zurückgegeben
  return VDE_CROSS_SECTIONS.find(size => size >= minRequired) ?? VDE_CROSS_SECTIONS[VDE_CROSS_SECTIONS.length - 1];
}

/**
 * Berechnet den tatsächlichen Spannungsabfall für einen gegebenen Strom,
 * eine Länge und einen Querschnitt.
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

// ============================================================================
// LEERROHR / KABELKANAL
// ============================================================================

/**
 * Standard-Leerrohr-Innendurchmesser nach DIN EN 61386 (EN 20 - EN 50).
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
 * @returns Füllgrad in Prozent (0-100+)
 */
export function calculateConduitFillPercent(
  conduitType: keyof typeof VDE_CONDUIT_INNER_DIAMETERS,
  cableCrossSections: number[]
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
 * Findet das kleinste Leerrohr, das die Kabel mit <= VDE_MAX_CONDUIT_FILL_PERCENT aufnehmen kann.
 *
 * @returns Empfohlener Leerrohr-Typ oder null wenn keiner passt
 */
export function recommendConduitType(cableCrossSections: number[]): string | null {
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
// WECHSELRICHTER
// ============================================================================

/**
 * Typischer Wirkungsgrad eines 12V→230V-Wechselrichters.
 * Hersteller-Angaben liegen meist bei 85-93%. 0.85 = 15% Verlust ist konservativ.
 */
export const VDE_INVERTER_EFFICIENCY = 0.85;

/**
 * Maximaler empfohlener Auslastungsgrad eines Wechselrichters
 * (dauerhafte Last sollte max 80% der Nennleistung betragen).
 */
export const VDE_INVERTER_MAX_LOAD_FRACTION = 0.80;

// ============================================================================
// RCD (FI-SCHUTZSCHALTER)
// ============================================================================

/**
 * Maximaler Auslösestrom eines RCD für Personenschutz nach VDE 0100-721.
 * Für Landstrom-Anschlüsse in Wohnmobilen ist ≤30mA vorgeschrieben.
 */
export const VDE_RCD_MAX_TRIP_CURRENT_MA = 30;

/**
 * Maximaler Bemessungsdifferenzstrom in mA für den 230V-Personenschutz.
 */
export const VDE_230V_PERSON_PROTECTION_MA = 30;

// ============================================================================
// BATTERIE
// ============================================================================

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
export const VDE_MIN_CROSS_SECTION = 1.5;

// ============================================================================
// HAUPTFUNKTION: Kabelberechnung
// ============================================================================

/**
 * Berechnet den passenden Kabelquerschnitt und die empfohlene Sicherung.
 *
 * @param currentA Strom in Ampere
 * @param lengthM Kabellänge in Metern (Hin- und Rückleiter wird intern berücksichtigt)
 * @returns Empfohlener Querschnitt (mm²) und Sicherungsgröße (A)
 */
export function calculateWire(
  currentA: number,
  lengthM: number
): { crossSection: number; fuseSize: number; length: number; minCrossSection: number } {
  const minCrossSection = calculateMinCrossSection(currentA, lengthM);
  // Der Endquerschnitt ist max(Mindestquerschnitt, absolutes Minimum)
  const minRequired = Math.max(VDE_MIN_CROSS_SECTION, minCrossSection);
  const crossSection = roundUpToVDECrossSection(minRequired);
  const fuseSize = VDE_CONSERVATIVE_FUSES[crossSection] ?? VDE_STANDARD_FUSES[crossSection] ?? 15;

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
 */
export function validateCableEdge(
  edge: Edge<CableEdgeData>,
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
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

  // 2. Spannungsabfall
  const voltageDrop = calculateVoltageDrop(currentA, length, crossSection);
  if (voltageDrop > VDE_MAX_VOLTAGE_DROP_12V * 12) {
    return {
      isValid: false,
      severity: 'warning',
      message: `Spannungsabfall ${voltageDrop.toFixed(2)}V überschreitet ${(VDE_MAX_VOLTAGE_DROP_12V * 100).toFixed(0)}% von 12V. Kabel evtl. zu schwach dimensioniert.`,
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
  if (!VDE_CROSS_SECTIONS.includes(crossSection as VDECrossSection)) {
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
  const data = node.data as any;
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
  const data = node.data as any;

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
  const data = node.data as any;
  const continuousPower = data?.continuousPower || 0;
  const concurrentDevices = data?.concurrentDevices || [];

  if (continuousPower <= 0) return results;

  const totalLoad = allNodes
    .filter(n => n.type === 'consumer230v' && concurrentDevices.includes(n.id))
    .reduce((acc, n) => acc + ((n.data as any)?.watts || 0), 0);

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
      message: `Wechselrichter-Auslastung ${totalLoad}W übersteigt empfohlene ${(VDE_INVERTER_MAX_LOAD_FRACTION * 100)}% der Nennleistung (${maxAllowed}W).`,
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
  edges: Edge<CableEdgeData>[]
): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // 1. Alle Edges prüfen
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    // Strom berechnen
    let currentA = 0;
    if (sourceNode?.type === 'consumer') {
      currentA = ((sourceNode.data as any).watts || 0) / 12;
    } else if (targetNode?.type === 'consumer') {
      currentA = ((targetNode.data as any).watts || 0) / 12;
    } else if (sourceNode?.type === 'charger') {
      currentA = (sourceNode.data as any).amps || 0;
    } else if (targetNode?.type === 'charger') {
      currentA = (targetNode.data as any).amps || 0;
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
