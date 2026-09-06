import {
  VDE_CURRENT_CAPACITY,
  VDE_MAX_VOLTAGE_DROP_12V,
  VDE_MIN_CROSS_SECTION,
  calculateMinCrossSection,
  calculateVoltageDrop,
  roundUpToVDECrossSection,
} from '../vde-standards';
import type { CableFunction, CablePlannerEdge, PlannerNode } from './domain';
import {
  inferCableCurrentA,
  inferCableFunction,
  strokeWidthForCrossSection,
} from './cableCurrent';

export type CableAnalysis = {
  length: number;
  crossSection: number;
  maxFuse: number;
  strokeWidth: number;
  animationDuration: number;
  voltageDropWarning: boolean;
  cableFunction: CableFunction;
};

export function analyzeCableEdge(
  nodes: PlannerNode[],
  edge: Pick<CablePlannerEdge, 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'data'>
): CableAnalysis {
  const length = edge.data?.length || 3;
  const currentA = inferCableCurrentA(nodes, edge);
  const minRequired = calculateMinCrossSection(currentA, length);
  const crossSection =
    edge.data?.crossSection ??
    roundUpToVDECrossSection(Math.max(VDE_MIN_CROSS_SECTION, minRequired));
  const maxFuse = VDE_CURRENT_CAPACITY[crossSection] ?? 0;
  const voltageDrop = calculateVoltageDrop(currentA, length, crossSection);
  const voltageDropWarning = voltageDrop > VDE_MAX_VOLTAGE_DROP_12V * 12;
  const cableFunction = inferCableFunction(nodes, edge, currentA);

  return {
    length,
    crossSection,
    maxFuse,
    strokeWidth: strokeWidthForCrossSection(crossSection),
    animationDuration: Math.max(0.5, 5 - currentA / 10),
    voltageDropWarning,
    cableFunction,
  };
}
