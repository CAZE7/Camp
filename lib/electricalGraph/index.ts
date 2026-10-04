/**
 * lib/electricalGraph/index.ts — ÖFFENTLICHE API DER ELEKTRISCHEN EBENE.
 *
 * Diese Ebene ist die *elektrische Wahrheit* des Planers. Sie steht
 * ausdrücklich ÜBER der Darstellung und UNTER der Dimensionierung:
 *
 * ```text
 * Electrical Graph        ← hier
 *   ↓
 * Topology / Verification (lib/verify)
 *   ↓
 * Auto-Wire Proposal      (lib/autoWire)
 *   ↓
 * Physical Layout         (lib/planner/layout-engine, lib/autoWire/placement)
 *   ↓
 * Routing                 (components/edges/utils/routeAll)
 *   ↓
 * Final Validation        (lib/routing/finalValidation)
 *   ↓
 * Rendering / UX          (components/)
 * ```
 *
 * Verbote dieser Ebene:
 *  1. **Keine Geometrie.** Kein `x`, `y`, `width`, `waypoints`.
 *  2. **Kein Raten.** Mehrdeutigkeiten werden zu `questions`, nicht zu
 *     Annahmen (Regel M: kein stiller Fallback).
 *  3. **Keine UI-Importe** (ARCH-001/ADR 0008).
 *  4. **Keine zweite Stromquelle.** Ströme bleiben `calculateEdgeCurrent`
 *     (DC) bzw. `acCurrentA` (AC); hier werden nur GRENZEN verwaltet.
 *
 * Siehe `docs/electrical-graph.md` und `docs/electrical-architecture.md`.
 */

export {
  EDGE_INTENTS,
  EDGE_INTENT_PRIORITY,
  compareIntentPriority,
  edgeIntentOf,
  isEdgeIntent,
  isIntentPinned,
  isRouteLocked,
  mayOverride,
  strongerIntent,
  type EdgeIntent,
  type IntentCarrier,
} from './intent';

export {
  COMPONENT_CONSTRAINT_DEFAULTS,
  CONSTRAINT_FIELD_MAP,
  componentCurrentLimit,
  resolveComponentConstraints,
  type ComponentConstraints,
  type ConstraintNode,
  type RequiredProtection,
} from './constraints';

export {
  SYSTEM_VOLTAGE_CLASSES,
  SYSTEM_VOLTAGE_WINDOWS,
  checkVoltageCompatibility,
  classifySystemVoltage,
  nominalVoltageOfClass,
  scaleToClass,
  type SystemVoltageClass,
  type VoltageCompatibility,
  type VoltageMismatchReason,
  type VoltageWindow,
} from './powerSystem';

export {
  DECLARABLE_BANK_TOPOLOGIES,
  deriveBatteryBanks,
  isBankTopology,
  primaryHouseBank,
  type BankRole,
  type BankTopology,
  type BatteryBank,
  type BatteryBankModel,
  type BatteryBankQuestion,
} from './batteryBank';

export {
  CURRENT_LIMIT_LABEL,
  CURRENT_LIMIT_PRECEDENCE,
  LOAD_HEADROOM_FRACTION,
  computeCurrentBudget,
  evaluateLoadFeasibility,
  type CurrentBudget,
  type CurrentLimitSource,
  type CurrentLimits,
  type LoadFeasibility,
} from './currentBudget';

export {
  acEndpointRole,
  buildAcSystem,
  resolveAcSourceForLoad,
  type AcAssignmentConflict,
  type AcCircuit,
  type AcLoad,
  type AcSource,
  type AcSourceKind,
  type AcSystemModel,
} from './acSystem';

export {
  buildElectricalGraph,
  electricalGraphHash,
  fnv1a,
  systemVoltageOf,
  type ElectricalCircuit,
  type ElectricalConnection,
  type ElectricalGraph,
  type ElectricalNode,
  type ElectricalPort,
  type ElectricalQuestion,
  type PowerSystem,
} from './graph';
