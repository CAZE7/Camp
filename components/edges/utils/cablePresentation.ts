import type { CableFunction } from '../../../lib/planner/domain';

export const CABLE_COLOR_MAP: Record<CableFunction, string> = {
  positive: '#dc2626',
  negative: '#18181b',
  ground: '#10b981',
  solar: '#f59e0b',
  shore: '#3b82f6',
  inverter: '#a855f7',
  charging: '#ec4899',
  main: '#dc2626',
  secondary: '#6b7280',
  consumer: '#6b7280',
  busbar: '#dc2626',
};

export function buildCableLabelLines({
  length,
  crossSection,
  maxFuse,
  fuseSize,
  voltageDropWarning,
  cableFunction,
}: {
  length: number;
  crossSection: number;
  maxFuse: number;
  fuseSize?: number;
  voltageDropWarning: boolean;
  cableFunction: CableFunction;
}): string[] {
  const lines = [`${length.toFixed(2)} m`, `${crossSection} mm²`];
  if (maxFuse > 0) lines.push(`Max: ${maxFuse}A`);
  if (fuseSize) lines.push(`${fuseSize}A Sicherung`);
  if (voltageDropWarning) lines.push('⚠ VDE-Spannungsabfall');
  lines.push(cableFunction);
  return lines;
}

export function cableStroke({
  selected,
  voltageDropWarning,
  cableFunction,
}: {
  selected?: boolean;
  voltageDropWarning: boolean;
  cableFunction: CableFunction;
}): string {
  return selected
    ? '#f97316'
    : voltageDropWarning
      ? '#ef4444'
      : CABLE_COLOR_MAP[cableFunction] ?? CABLE_COLOR_MAP.secondary;
}
