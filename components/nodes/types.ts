export interface CommonNodeData {
  label?: string;
  watts?: number;
  concurrentDevices?: string[];
  continuousPower?: number;
  [key: string]: any;
}

import { ResizeDragEvent, type NodeProps } from 'reactflow';

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
export type PlannerNodeProps<TData = CommonNodeData> = Pick<NodeProps<TData>, 'id' | 'data'> &
  Partial<Omit<NodeProps<TData>, 'id' | 'data'>>;

/**
 * Resize-Callback der Dachplanung.
 *
 * React Flow reicht neben Größe auch Position und Zugrichtung durch; beides
 * ist optional, weil nur Breite und Höhe ausgewertet werden. Ohne diese
 * Felder ließ sich der Aufruf in Tests nicht typkorrekt nachstellen.
 */
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
  safeMargins?: {
    front?: number;
    rear?: number;
    left?: number;
    right?: number;
  };
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
  hours?: number;
}

export interface SolarNodeData extends CommonNodeData {
  voltage?: number;
  amps?: number;
}

export interface ChargerNodeData extends CommonNodeData {
  amps?: number;
  efficiency?: number;
}

export interface MpptControllerNodeData extends CommonNodeData {
  amps?: number;
  efficiency?: number;
}

export interface DcdcChargerNodeData extends CommonNodeData {
  amps?: number;
  efficiency?: number;
}

export interface AcBatteryChargerNodeData extends CommonNodeData {
  amps?: number;
  efficiency?: number;
}

export interface BusbarNodeData extends CommonNodeData {
  role?: 'positive' | 'negative';
}

export type PlannerNodeData =
  | RoofNodeData
  | BatteryNodeData
  | ConsumerNodeData
  | SolarNodeData
  | ChargerNodeData
  | MpptControllerNodeData
  | DcdcChargerNodeData
  | AcBatteryChargerNodeData
  | BusbarNodeData
  | CommonNodeData;
