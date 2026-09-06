/**
 * lib/planner/domainModel.ts
 *
 * ECHTES fachliches Domain-Modell für den Elektroplanner.
 *
 * Problem (vorher):
 * ---------------
 * Der Domain-`PlannerNodeData` war mit `[key: string]: any` ein
 * generisches React-Flow-artiges Node-Modell. Typen wie `Battery`,
 * `Consumer`, `Fuse`, `Busbar` oder eine fachliche `Connection` existierten
 * nicht. Dieses Modul ergänzt diese echten fachlichen Typen als
 * Single Source of Truth für die Domäne — unabhängig von React Flow.
 *
 * Hinweis zur Kompatibilität:
 * --------------------------
 * `lib/planner/domain.ts` bleibt für den UI-Adapter erhalten (weil React Flow
 * dort strukturell kompatibel sein muss). Dieses Modul beschreibt die
 * fachliche Ebene: Jede Komponente hat ein eigenes, präzises Datenprofil.
 */

import type { PlannerNode, PlannerNodeData } from './domain';

/** Alle bekannten fachlichen Knotenarten des Elektroplanners. */
export type PlannerNodeKind =
  | 'battery'
  | 'consumer'
  | 'consumer230v'
  | 'charger'
  | 'fuse'
  | 'busbar'
  | 'shunt'
  | 'solar'
  | 'roofsolar'
  | 'inverter'
  | 'shorePower'
  | 'conduit'
  | 'ground'
  // Wasser-Domäne
  | 'waterTank'
  | 'pump'
  | 'sink'
  | 'grayWaterTank'
  | 'accumulator';

/** Polung einer elektrischen Verbindung. */
export type Polarity = 'plus' | 'minus' | 'ground';

/** Batterie-Chemie. */
export type BatteryChemistry = 'LiFePO4' | 'AGM' | 'Gel' | 'Blei';

/** Fachliche Daten einer Batterie. */
export type BatteryData = {
  label?: string;
  capacity: number; // Ah
  chemistry: BatteryChemistry;
  doD?: number; // Depth of Discharge (abgeleitet aus der Chemie)
  voltage?: number;
};

/** Fachliche Daten eines 12V-Verbrauchers. */
export type ConsumerData = {
  label?: string;
  watts: number;
  hours?: number;
  amps?: number;
  voltage?: number;
};

/** Fachliche Daten eines 230V-Verbrauchers. */
export type Consumer230VData = {
  label?: string;
  watts: number;
  hours?: number;
  amps?: number;
  voltage?: number;
};

/** Fachliche Daten eines Ladegeräts / Ladereglers. */
export type ChargerData = {
  label?: string;
  amps: number;
  voltage?: number;
  efficiency?: number;
};

/** Fachliche Daten einer Sicherung. */
export type FuseData = {
  label?: string;
  rating: number; // A
  poles?: number;
  rcd?: boolean;
};

/** Fachliche Daten einer Sammelschiene (Busbar). */
export type BusbarData = {
  label?: string;
  rating?: number;
  maxAmps?: number;
};

/** Fachliche Daten eines Smart Shunt. */
export type ShuntData = {
  label?: string;
  rating?: number;
};

/** Fachliche Daten eines Solarmoduls. */
export type SolarData = {
  label?: string;
  watts: number;
  voltage: number;
  amps: number;
  orientation?: string;
};

/** Fachliche Daten eines Wechselrichters. */
export type InverterData = {
  label?: string;
  continuousPower: number;
  concurrentDevices?: string[];
  efficiency?: number;
};

/** Fachliche Daten eines Landstromanschlusses. */
export type ShorePowerData = {
  label?: string;
  hasRcd: boolean;
  rcdTripCurrentMa?: number;
  maxAmps?: number;
};

/** Fachliche Daten eines Leerrohrs / Kabelkanals. */
export type ConduitData = {
  label?: string;
  conduitType?: string;
  fillPercent?: number;
};

/** Fachliche Daten eines Erdungspunkts. */
export type GroundData = {
  label?: string;
};

/** Fachliche Daten eines Wassertanks. */
export type WaterTankData = {
  label?: string;
  volumeLiters?: number;
};

/** Fachliche Daten einer Pumpe. */
export type PumpData = {
  label?: string;
  status?: 'normal' | 'warning';
};

/** Fachliche Daten eines Waschbeckens. */
export type SinkData = {
  label?: string;
};

/** Fachliche Daten eines Grauwassertanks. */
export type GrayWaterTankData = {
  label?: string;
  volumeLiters?: number;
};

/** Fachliche Daten eines Accumulators. */
export type AccumulatorData = {
  label?: string;
  volumeLiters?: number;
};

/**
 * Mapping von Knotenart auf ihr fachliches Datenprofil.
 * Jede bekannte Knotenart hat ein präzises, nicht-generisches Datenprofil.
 */
export interface PlannerNodeDataMap {
  battery: BatteryData;
  consumer: ConsumerData;
  consumer230v: Consumer230VData;
  charger: ChargerData;
  fuse: FuseData;
  busbar: BusbarData;
  shunt: ShuntData;
  solar: SolarData;
  roofsolar: SolarData;
  inverter: InverterData;
  shorePower: ShorePowerData;
  conduit: ConduitData;
  ground: GroundData;
  waterTank: WaterTankData;
  pump: PumpData;
  sink: SinkData;
  grayWaterTank: GrayWaterTankData;
  accumulator: AccumulatorData;
}

/** Datenprofil einer beliebigen fachlichen Knotenart. */
export type PlannerNodeDataOf<K extends PlannerNodeKind> = PlannerNodeDataMap[K];

/**
 * Ein fachlich typisierter Knoten: Disjunkte Union aus Knotenart + Datenprofil.
 * Im Gegensatz zum generischen `PlannerNode` ist die `data`-Form hier exakt.
 */
export type PlannerDomainNode<Kind extends PlannerNodeKind = PlannerNodeKind> =
  PlannerNode<PlannerNodeDataOf<Kind>> & { type: Kind };

/**
 * Ein fachlicher Verbindungspunkt: ein Knoten, ein Handle und eine Polung.
 */
export type ConnectionEndpoint = {
  nodeId: string;
  handleId: string;
  polarity: Polarity;
};

/**
 * Die fachliche elektrische Verbindung (Connection).
 *
 * Unterscheidet sich bewusst von `PlannerConnection` (dem React-Flow-Connect-
 * Payload): Hier ist die Polung, die Kabelfunktion und die Dimensionierung
 * Teil der Domäne, nicht des UI-Adapters.
 */
export type Connection = {
  id: string;
  from: ConnectionEndpoint;
  to: ConnectionEndpoint;
  cableFunction: import('./domain').CableFunction;
  currentA: number;
  lengthM: number;
  crossSection?: number;
  fuseSize?: number;
};

/**
 * Baut das standardmäßige fachliche Datenprofil für eine gegebene Knotenart.
 * Deckungsgleich mit `getDefaultNodeData` aus nodeFactory, aber typisiert.
 */
export function defaultDataForKind<K extends PlannerNodeKind>(
  kind: K
): PlannerNodeDataOf<K> {
  switch (kind) {
    case 'battery':
      return { capacity: 100, chemistry: 'LiFePO4' } as PlannerNodeDataOf<K>;
    case 'consumer':
      return { watts: 50, hours: 2 } as PlannerNodeDataOf<K>;
    case 'consumer230v':
      return { watts: 1000, hours: 0.5 } as PlannerNodeDataOf<K>;
    case 'charger':
      return { amps: 10 } as PlannerNodeDataOf<K>;
    case 'fuse':
      return { rating: 30 } as PlannerNodeDataOf<K>;
    case 'busbar':
      return { rating: 100 } as PlannerNodeDataOf<K>;
    case 'shunt':
      return { rating: 100 } as PlannerNodeDataOf<K>;
    case 'solar':
    case 'roofsolar':
      return { watts: 100, voltage: 18, amps: 5 } as PlannerNodeDataOf<K>;
    case 'inverter':
      return { continuousPower: 1000 } as PlannerNodeDataOf<K>;
    case 'shorePower':
      return { hasRcd: false } as PlannerNodeDataOf<K>;
    case 'waterTank':
    case 'grayWaterTank':
      return { volumeLiters: 100 } as PlannerNodeDataOf<K>;
    case 'pump':
      return { status: 'normal' } as PlannerNodeDataOf<K>;
    case 'sink':
    case 'ground':
    case 'accumulator':
    case 'conduit':
      return {} as PlannerNodeDataOf<K>;
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/** Prüft, ob ein Knoten eine fachliche Domänen-Knotenart besitzt. */
export function isDomainNode(node: PlannerNode): boolean {
  return node.type !== undefined && node.type !== null;
}

export function isBatteryNode(node: PlannerNode): node is PlannerDomainNode<'battery'> {
  return node.type === 'battery';
}
export function isConsumerNode(node: PlannerNode): node is PlannerDomainNode<'consumer'> {
  return node.type === 'consumer';
}
export function isConsumer230VNode(node: PlannerNode): node is PlannerDomainNode<'consumer230v'> {
  return node.type === 'consumer230v';
}
export function isChargerNode(node: PlannerNode): node is PlannerDomainNode<'charger'> {
  return node.type === 'charger';
}
export function isFuseNode(node: PlannerNode): node is PlannerDomainNode<'fuse'> {
  return node.type === 'fuse';
}
export function isBusbarNode(node: PlannerNode): node is PlannerDomainNode<'busbar'> {
  return node.type === 'busbar';
}
export function isShuntNode(node: PlannerNode): node is PlannerDomainNode<'shunt'> {
  return node.type === 'shunt';
}
export function isSolarNode(node: PlannerNode): node is PlannerDomainNode<'solar'> {
  return node.type === 'solar' || node.type === 'roofsolar';
}
export function isInverterNode(node: PlannerNode): node is PlannerDomainNode<'inverter'> {
  return node.type === 'inverter';
}
export function isShorePowerNode(node: PlannerNode): node is PlannerDomainNode<'shorePower'> {
  return node.type === 'shorePower';
}
export function isWaterNode(node: PlannerNode): boolean {
  return (
    node.type === 'waterTank' ||
    node.type === 'pump' ||
    node.type === 'sink' ||
    node.type === 'grayWaterTank' ||
    node.type === 'accumulator'
  );
}

/** Liefert die DoD zur Batterie-Chemie (zentral, nicht mehr verteilt). */
export function batteryDoD(chemistry: BatteryChemistry): number {
  const map: Record<BatteryChemistry, number> = {
    LiFePO4: 0.9,
    AGM: 0.5,
    Gel: 0.5,
    Blei: 0.3,
  };
  return map[chemistry];
}
