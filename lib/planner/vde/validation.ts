/**
 * lib/planner/vde/validation.ts
 *
 * Typed VDE validation for Routing V2.
 *
 * The structural node/edge types below accept both the legacy planner types and
 * the strict domainModel types, without casting to `any`.
 */

import type {
  VDECrossSection,
  VDEValidationResult,
} from './standards';
import {
  VDE_BATTERY_DOD,
  VDE_CROSS_SECTIONS,
  VDE_CURRENT_CAPACITY,
  VDE_INVERTER_MAX_LOAD_FRACTION,
  VDE_MAX_VOLTAGE_DROP_12V,
  VDE_MIN_CROSS_SECTION,
  VDE_RCD_MAX_TRIP_CURRENT_MA,
  calculateVoltageDrop,
  roundUpToVDECrossSection,
} from './standards';

export type {
  VDEValidationResult,
};

type VdeNodeData = {
  readonly label?: string;
  readonly watts?: number;
  readonly hours?: number;
  readonly amps?: number;
  readonly capacity?: number;
  readonly chemistry?: string;
  readonly hasRcd?: boolean;
  readonly continuousPower?: number;
  readonly concurrentDevices?: readonly string[];
};

type VdePlannerNode = {
  readonly id: string;
  readonly type?: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly data: VdeNodeData;
  readonly width?: number | null;
  readonly height?: number | null;
};

type VdeCableEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
  readonly data?: {
    readonly length?: number;
    readonly crossSection?: number;
    readonly fuseSize?: number;
  };
};

export function validateCableEdge(
  edge: VdeCableEdge,
  sourceNode: VdePlannerNode | undefined,
  targetNode: VdePlannerNode | undefined,
  currentA: number,
): VDEValidationResult {
  void sourceNode;
  void targetNode;

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
      message: `Spannungsabfall ${voltageDrop.toFixed(2)}V überschreitet ${(VDE_MAX_VOLTAGE_DROP_12V * 100).toFixed(0)}% von 12V.`,
      code: 'HIGH_VOLTAGE_DROP',
    };
  }

  if (data.fuseSize !== undefined) {
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

export function validateBatteryNode(node: VdePlannerNode): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const chemistry = isBatteryNode(node)
    ? (node.data.chemistry ?? 'LiFePO4')
    : 'LiFePO4';

  if (!VDE_BATTERY_DOD[chemistry]) {
    results.push({
      isValid: false,
      severity: 'warning',
      message: `Unbekannte Batterie-Chemie "${chemistry}".`,
      code: 'UNKNOWN_CHEMISTRY',
    });
  }

  return results;
}

export function validateShorePowerNode(node: VdePlannerNode): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const hasRcd = isShorePowerNode(node) ? Boolean(node.data.hasRcd) : false;

  if (!hasRcd) {
    results.push({
      isValid: false,
      severity: 'error',
      message: `Landstromanschluss "${labelOf(node)}" hat keinen RCD (FI-Schalter ≤${VDE_RCD_MAX_TRIP_CURRENT_MA}mA). Nach DIN VDE 0100-721 vorgeschrieben!`,
      code: 'MISSING_RCD',
    });
  }

  return results;
}

export function validateInverterNode(
  node: VdePlannerNode,
  allNodes: readonly VdePlannerNode[],
): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  if (!isInverterNode(node)) return results;

  const continuousPower = node.data.continuousPower ?? 0;
  if (continuousPower <= 0) return results;

  const concurrentDevices = node.data.concurrentDevices ?? [];
  const totalLoad = allNodes
    .filter(
      (candidate) =>
        candidate.type === 'consumer230v' &&
        concurrentDevices.includes(candidate.id),
    )
    .reduce((sum, candidate) => sum + (candidate.data.watts ?? 0), 0);

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

export function validateSchematic(
  nodes: readonly VdePlannerNode[],
  edges: readonly VdeCableEdge[],
): VDEValidationResult[] {
  const results: VDEValidationResult[] = [];
  const nodeMap = new Map<string, VdePlannerNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const currentA = inferCurrentA(nodes, edge, false);
    const result = validateCableEdge(edge, sourceNode, targetNode, currentA);
    if (result.severity !== 'ok') results.push(result);
  }

  for (const node of nodes) {
    if (isBatteryNode(node)) results.push(...validateBatteryNode(node));
    else if (isShorePowerNode(node)) results.push(...validateShorePowerNode(node));
    else if (isInverterNode(node)) results.push(...validateInverterNode(node, nodes));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isBatteryNode(node: VdePlannerNode): boolean {
  return node.type === 'battery';
}

function isShorePowerNode(node: VdePlannerNode): boolean {
  return node.type === 'shorePower';
}

function isInverterNode(node: VdePlannerNode): boolean {
  return node.type === 'inverter';
}

function labelOf(node: VdePlannerNode): string {
  return typeof node.data?.label === 'string' ? node.data.label : '';
}

function inferCurrentA(
  nodes: readonly VdePlannerNode[],
  edge: Pick<VdeCableEdge, 'source' | 'target'>,
  fallbackToTotalConsumers: boolean,
): number {
  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);

  if (sourceNode?.type === 'consumer') {
    return (Number(sourceNode.data.watts) || 0) / 12;
  }
  if (targetNode?.type === 'consumer') {
    return (Number(targetNode.data.watts) || 0) / 12;
  }
  if (sourceNode?.type === 'charger') {
    return Number(sourceNode.data.amps) || 0;
  }
  if (targetNode?.type === 'charger') {
    return Number(targetNode.data.amps) || 0;
  }

  if (!fallbackToTotalConsumers) return 0;

  return nodes
    .filter((node) => node.type === 'consumer')
    .reduce((sum, node) => sum + (Number(node.data.watts) || 0) / 12, 0);
}
