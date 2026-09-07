/**
 * lib/planner/vde/index.ts
 *
 * Canonical facade for typed VDE constants and validation. Route V2 and new
 * modules import VDE values from here. The legacy `lib/vde-standards.ts` is a
 * re-export of this module.
 */

export {
  VDE_CROSS_SECTIONS,
  VDE_CURRENT_CAPACITY,
  VDE_MIN_CROSS_SECTION,
  VDE_MAX_VOLTAGE_DROP_12V,
  VDE_MAX_VOLTAGE_DROP_230V,
  VDE_INVERTER_EFFICIENCY,
  VDE_INVERTER_MAX_LOAD_FRACTION,
  VDE_RCD_MAX_TRIP_CURRENT_MA,
  VDE_BATTERY_DOD,
  VDE_CONDUIT_INNER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
  VDE_CABLE_OUTER_DIAMETERS,
  VDE_230V_PERSON_PROTECTION_MA,
  VDE_COPPER_RESISTIVITY,
  VDE_STANDARD_FUSES,
  VDE_CONSERVATIVE_FUSES,
  calculateMinCrossSection,
  calculateVoltageDrop,
  calculateWire,
  roundUpToVDECrossSection,
  calculateConduitFillPercent,
  recommendConduitType,
} from './standards';

export type { VDECrossSection, VDEValidationResult } from './standards';

export {
  validateBatteryNode,
  validateCableEdge,
  validateInverterNode,
  validateSchematic,
  validateShorePowerNode,
} from './validation';
