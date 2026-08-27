import { ResizeDragEvent, type Node, type NodeProps } from 'reactflow';

/**
 * Typmodell der Planer-Nodes (AGENTS.md M6-3).
 *
 * Drei Schichten:
 *  1. `CommonNodeData` — Felder, die jedes Bauteil haben darf; bewusst OHNE
 *     `any`-Index-Signatur. Unbekannte Felder sind `unknown` und müssen erst
 *     deklariert oder explizit gecastet werden (kein stilles any-Durchsickern).
 *  2. Pro Bauteil-Typ eine präzise Schnittstelle (BatteryNodeData, …).
 *  3. `NodeDataRegistry` + `PlannerNode` als diskriminierte Union: Das
 *     Node-Feld `type` wählt die Datenform — `TypedNode<'battery'>.data`
 *     ist `BatteryNodeData`, nicht `any`.
 *
 * Warum das `data`-Objekt selbst keinen `type`-Tag trägt: React Flow hält den
 * Typ auf dem Node (`node.type`), nicht in `node.data`; ein Duplikat in der
 * Datenform würde die Persistenz (localStorage) aufblähen und driften können.
 */

/** JSON-sicherer Feldwert, wie er in Persistenz und Auto-Wire-Patches vorkommt. */
export type NodeDataValue = string | number | boolean | string[] | undefined | null;

/** Partieller Schreibsatz für `updateNodeData` / Inspector-Updates. */
export type NodeDataPatch = Record<string, NodeDataValue>;

/**
 * Basis aller Node-Daten. Der Index auf `unknown` ist die Persistenzgrenze:
 * importierte/ältere Pläne können beliebigere Keys enthalten; Zugriff auf ein
 * nicht deklariertes Feld liefert `unknown` und zwingt zur bewussten Engstelle.
 */
export interface CommonNodeData {
  /** Anzeigename auf der Karte. */
  label?: string;
  /** Leistung in Watt (Verbraucher, Solarmodul, Wechselrichter…). */
  watts?: number;
  /** 230-V-Verbraucher, die dauerhaft gleichzeitig laufen (Inverter-Auslastung). */
  concurrentDevices?: string[];
  /** Dauerleistung des Wechselrichters in W. */
  continuousPower?: number;
  [key: string]: unknown;
}

export interface BatteryNodeData extends CommonNodeData {
  capacity?: number;
  chemistry?: string;
  nominalVoltage?: number;
  hasInternalBms?: boolean;
  hasExternalBms?: boolean;
  bmsContinuousDischarge?: number;
  bmsPeakDischarge?: number;
  bmsContinuousCharge?: number;
}

export interface ConsumerNodeData extends CommonNodeData {
  /** Nutzung in Stunden pro Tag. */
  hours?: number;
}

export interface Consumer230VNodeData extends CommonNodeData {
  hours?: number;
}

export interface SolarNodeData extends CommonNodeData {
  voltage?: number;
  amps?: number;
}

export interface ChargerNodeData extends CommonNodeData {
  amps?: number;
  /** Wirkungsgrad in Prozent. */
  efficiency?: number;
}

export type MpptControllerNodeData = ChargerNodeData;
export type DcdcChargerNodeData = ChargerNodeData;
export type AcBatteryChargerNodeData = ChargerNodeData;

export interface BusbarNodeData extends CommonNodeData {
  role?: 'positive' | 'negative';
  /** Nennstrom der Schiene in A. */
  rating?: number;
}

export interface FuseNodeData extends CommonNodeData {
  /** Auslösestrom der Sicherung in A. */
  rating?: number;
}

// Batteriemonitor/Massepunkt/Wechselrichter führen keine über die Basis
// hinaus deklarierten Felder; eigene Aliase halten die Registry explizit.
export type ShuntNodeData = CommonNodeData;
export type GroundNodeData = CommonNodeData;
export type InverterNodeData = CommonNodeData;

export interface ShorePowerNodeData extends CommonNodeData {
  /** Vorhandensein eines 30-mA-RCD (DIN VDE 0100-721). */
  hasRcd?: boolean;
  /** Absicherung/Anschlusswert der Landstromdose in A (ELEC-003). */
  rating?: number;
  /** Modellierter AC-Verbrauch in A; sonst aus der Last abgeleitet. */
  acCurrentA?: number;
}

export interface ConduitNodeData extends CommonNodeData {
  conduitType?: string;
  assignedEdges?: string[];
}

/** Wasser-Bauteile (Frisch-/Abwassertank, Pumpe, Entnahmestellen …). */
export interface WaterNodeData extends CommonNodeData {
  /** Farbkodierung: Frisch- vs. Grauwasser. */
  kind?: 'fresh' | 'gray';
}

/** Resize-Callback der Dachplanung. */
export type OnNodeResize = (
  event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent | ResizeDragEvent,
  params: {
    id: string;
    width: number;
    height: number;
    x?: number;
    y?: number;
    direction?: number[];
  }
) => void;

export interface RoofNodeData extends CommonNodeData {
  width?: number;
  height?: number;
  onNodeResize?: OnNodeResize;
  isInvalid?: boolean;
  isOverlapping?: boolean;
  /** Anzahl der Module in der Reihen (Serienschaltung, strings). */
  rows?: number;
  safeMargins?: {
    front?: number;
    rear?: number;
    left?: number;
    right?: number;
  };
}

/**
 * Registry: Node-Typ → Datenform. Sie ist die einzige Stelle, an der
 * `node.type`-Strings und Daten-Schnittstellen verknüpft werden. Neue
 * Bauteile (components/registry) tragen hier ihren Shape ein.
 */
export interface NodeDataRegistry {
  battery: BatteryNodeData;
  busbar: BusbarNodeData;
  charger: ChargerNodeData;
  conduit: ConduitNodeData;
  consumer: ConsumerNodeData;
  consumer230v: Consumer230VNodeData;
  dcdcCharger: DcdcChargerNodeData;
  acBatteryCharger: AcBatteryChargerNodeData;
  mpptController: MpptControllerNodeData;
  fuse: FuseNodeData;
  ground: GroundNodeData;
  inverter: InverterNodeData;
  shorePower: ShorePowerNodeData;
  shunt: ShuntNodeData;
  solar: SolarNodeData;
  roofSolar: RoofNodeData;
  roofWindow: RoofNodeData;
  roofBackground: RoofNodeData;
  freshWaterTank: WaterNodeData;
  grayWaterTank: WaterNodeData;
  pump: WaterNodeData;
  accumulator: WaterNodeData;
  preFilter: WaterNodeData;
  sink: WaterNodeData;
  shower: WaterNodeData;
}

export type PlannerNodeType = keyof NodeDataRegistry;

/** Datenunion aller registrierten Bauteile. */
export type PlannerNodeData = NodeDataRegistry[PlannerNodeType];

/**
 * Diskriminierte Union: `type` wählt die Datenform.
 * `Omit<Node, 'data'>` hält die React-Flow-Standardfelder bereit.
 */
export type PlannerNode = {
  [K in PlannerNodeType]: Omit<Node, 'data'> & { type: K; data: NodeDataRegistry[K] };
}[PlannerNodeType];

/** Aus der Union auf einen (oder mehrere) Typen herausgeschnittener Node. */
export type TypedNode<K extends PlannerNodeType> = Extract<PlannerNode, { type: K }>;

/**
 * Props einer Planer-Node-Komponente.
 *
 * React Flow reicht `NodeProps` vollständig durch, unsere Komponenten nutzen
 * davon aber nur `id`, `data` und gelegentlich `selected`/`isConnectable`.
 * Dieser Typ sagt genau das: Pflicht ist, was gebraucht wird, der Rest ist
 * optional. Zwei Vorteile:
 *
 *   1. Die Signatur beschreibt die tatsächliche Abhängigkeit.
 *   2. Tests können eine Node mit `id` und `data` rendern, ohne acht
 *      irrelevante React-Flow-Felder zu erfinden — und werden dadurch
 *      überhaupt erst typprüfbar (siehe tsconfig.tests.json).
 */
export type PlannerNodeProps<TData = CommonNodeData> = Pick<NodeProps, 'id' | 'data'> &
  Partial<Omit<NodeProps, 'id' | 'data'>> & {
    /** Präzise Datenform des registrierten Bauteils statt reactflow-Default. */
    data: TData;
  };
