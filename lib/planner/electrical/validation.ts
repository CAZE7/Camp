/**
 * lib/planner/electrical/validation.ts
 *
 * VDE-Validierung einzelner Komponenten und des kompletten Schaltplans.
 */

import type { CablePlannerEdge, PlannerNode } from '../domain';
import { inferCableCurrentA } from '../cableCurrent';
import { maxSustainedCurrent } from './ampacity';
import { roundUpToVDECrossSection, calculateVoltageDrop, VDE_MAX_VOLTAGE_DROP_12V } from './voltageDrop';
import {
  VDE_CROSS_SECTIONS,
  VDE_MIN_CROSS_SECTION,
  VDE_BATTERY_DOD,
  VDE_INVERTER_MAX_LOAD_FRACTION,
  VDE_RCD_MAX_TRIP_CURRENT_MA,
  type VDECrossSection,
} from './standards';

/** Ergebnis einer VDE-Validierung. */
export type VDEValidationResult = {
  isValid: boolean;
  severity: 'error' | 'warning' | 'ok';
  message: string;
  code: string; // z.B. 'UNDERSIZED_CABLE', 'MISSING_RCD'
};

/** Validiert eine einzelne Kabel-Edge gegen die VDE-Norm. */
export function validateCableEdge(
  edge: CablePlannerEdge,
  sourceNode: PlannerNode | undefined,
  targetNode: PlannerNode | undefined,
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

  if (crossSection < VDE_MIN_CROSS_SECTION) {
    return {
      isValid: false,
      severity: 'error',
      message: `Kabel-Querschnitt ${crossSection} mm² ist kleiner als das VDE-Minimum von ${VDE_MIN_CROSS_SECTION} mm².`,
      code: 'UNDERSIZED_CABLE',
    };
  }

  const voltageDrop = calculateVoltageDrop(currentA, length, crossSection);
  if (voltageDrop > VDE_MAX_VOLTAGE_DROP_12V * 12) {
    return {
      isValid: false,
      severity: 'warning',
      message: `Spannungsabfall ${voltageDrop.toFixed(2)}V überschreitet ${(VDE_MAX_VOLTAGE_DROP_12V * 100).toFixed(0)}% von 12V. Kabel evtl. zu schwach dimensioniert.`,
      code: 'HIGH_VOLTAGE_DROP',
    };
  }

  if (data.fuseSize) {
    const maxFuse = maxSustainedCurrent(crossSection);
    if (data.fuseSize > maxFuse) {
      return {
        isValid: false,
        severity: 'error',
        message: `Sicherung ${data.fuseSize}A ist zu groß für ${crossSection} mm² Kabel (max ${maxFuse}A). Brandgefahr!`,
        code: 'OVERSIZED_FUSE',
      };
    }
  }

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

/** Validiert, ob eine Batterie-Komponente korrekt konfiguriert ist. */
export function validateBatteryNode(node: PlannerNode): VDEValidationResult[] {
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

/** Validiert, ob ein Landstrom-Anschluss einen RCD hat (VDE 0100-721 Pflicht). */
export function validateShorePowerNode(node: PlannerNode): VDEValidationResult[] {
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

/** Validiert, ob ein Wechselrichter überlastet ist. */
export function validateInverterNode(node: PlannerNode, allNodes: PlannerNode[]): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const data = node.data as any;
  const continuousPower = data?.continuousPower || 0;
  const concurrentDevices = data?.concurrentDevices || [];

  if (continuousPower <= 0) return results;

  const totalLoad = allNodes
    .filter((n) => n.type === 'consumer230v' && concurrentDevices.includes(n.id))
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

/** Validiert einen kompletten Schaltplan und gibt alle Verstöße zurück. */
export function validateSchematic(
  nodes: PlannerNode[],
  edges: CablePlannerEdge[]
): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const nodeMap = new Map<string, PlannerNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    const currentA = inferCableCurrentA(nodes, edge, false);

    const result = validateCableEdge(edge, sourceNode, targetNode, currentA);
    if (result.severity !== 'ok') {
      results.push(result);
    }
  }

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
