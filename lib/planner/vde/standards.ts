/**
 * lib/planner/vde/standards.ts
 *
 * Typed VDE constants and calculation functions. This is the canonical VDE
 * module for Routing V2. The legacy `lib/vde-standards.ts` is only a re-export.
 */

export const VDE_CROSS_SECTIONS = [
  1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0, 120.0,
] as const;

export type VDECrossSection = (typeof VDE_CROSS_SECTIONS)[number];

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

export const VDE_COPPER_RESISTIVITY = 0.0175;
export const VDE_MAX_VOLTAGE_DROP_12V = 0.1;
export const VDE_MAX_VOLTAGE_DROP_230V = 0.03;

export function calculateMinCrossSection(
  currentA: number,
  lengthM: number,
  maxVoltageDropFraction: number = VDE_MAX_VOLTAGE_DROP_12V,
  systemVoltage: number = 12
): number {
  if (currentA <= 0 || lengthM <= 0) {
    return VDE_CROSS_SECTIONS[0];
  }
  const maxVoltageDrop = maxVoltageDropFraction * systemVoltage;
  const minCrossSection = (VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / maxVoltageDrop;
  return minCrossSection;
}

export function roundUpToVDECrossSection(minRequired: number): number {
  return (
    VDE_CROSS_SECTIONS.find((size) => size >= minRequired) ??
    VDE_CROSS_SECTIONS[VDE_CROSS_SECTIONS.length - 1]!
  );
}

export function calculateVoltageDrop(
  currentA: number,
  lengthM: number,
  crossSection: number,
  systemVoltage: number = 12
): number {
  void systemVoltage;
  if (crossSection <= 0) return Infinity;
  return (VDE_COPPER_RESISTIVITY * lengthM * 2 * currentA) / crossSection;
}

export const VDE_CONDUIT_INNER_DIAMETERS: Record<string, number> = {
  'EN 20': 16.9,
  'EN 25': 21.4,
  'EN 32': 28.1,
  'EN 40': 37.7,
  'EN 50': 47.2,
};

export const VDE_MAX_CONDUIT_FILL_PERCENT = 60;

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

export function calculateConduitFillPercent(
  conduitType: keyof typeof VDE_CONDUIT_INNER_DIAMETERS,
  cableCrossSections: readonly number[]
): number {
  const innerDiameter = VDE_CONDUIT_INNER_DIAMETERS[conduitType];
  if (!innerDiameter) return 0;
  const innerArea = Math.PI * Math.pow(innerDiameter / 2, 2);
  const totalCableArea = cableCrossSections.reduce((acc, cs) => {
    const outerDiam = VDE_CABLE_OUTER_DIAMETERS[cs] ?? VDE_CABLE_OUTER_DIAMETERS[2.5]!;
    return acc + Math.PI * Math.pow(outerDiam / 2, 2);
  }, 0);
  return (totalCableArea / innerArea) * 100;
}

export function recommendConduitType(cableCrossSections: readonly number[]): string | null {
  for (const [type, diameter] of Object.entries(VDE_CONDUIT_INNER_DIAMETERS)) {
    const innerArea = Math.PI * Math.pow(diameter / 2, 2);
    const totalCableArea = cableCrossSections.reduce((acc, cs) => {
      const outerDiam = VDE_CABLE_OUTER_DIAMETERS[cs] ?? VDE_CABLE_OUTER_DIAMETERS[2.5]!;
      return acc + Math.PI * Math.pow(outerDiam / 2, 2);
    }, 0);
    if ((totalCableArea / innerArea) * 100 <= VDE_MAX_CONDUIT_FILL_PERCENT) {
      return type;
    }
  }
  return null;
}

export const VDE_INVERTER_EFFICIENCY = 0.85;
export const VDE_INVERTER_MAX_LOAD_FRACTION = 0.8;
export const VDE_RCD_MAX_TRIP_CURRENT_MA = 30;
export const VDE_230V_PERSON_PROTECTION_MA = 30;

export const VDE_BATTERY_DOD: Record<string, number> = {
  LiFePO4: 0.9,
  AGM: 0.5,
  Gel: 0.5,
  Blei: 0.3,
};

export const VDE_MIN_CROSS_SECTION = 1.5;

export function calculateWire(
  currentA: number,
  lengthM: number
): { crossSection: number; fuseSize: number; length: number; minCrossSection: number } {
  const minCrossSection = calculateMinCrossSection(currentA, lengthM);
  const minRequired = Math.max(VDE_MIN_CROSS_SECTION, minCrossSection);
  const crossSection = roundUpToVDECrossSection(minRequired);
  const fuseSize = VDE_CONSERVATIVE_FUSES[crossSection] ?? VDE_STANDARD_FUSES[crossSection] ?? 15;
  return { crossSection, fuseSize, length: lengthM, minCrossSection };
}

export type VDEValidationResult = {
  isValid: boolean;
  severity: 'error' | 'warning' | 'ok';
  message: string;
  code: string;
};
