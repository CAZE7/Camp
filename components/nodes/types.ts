export interface CommonNodeData {
  label?: string;
  watts?: number;
  concurrentDevices?: string[];
  continuousPower?: number;
  [key: string]: any;
}

import { ResizeDragEvent } from 'reactflow';

export type OnNodeResize = (
  event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent | ResizeDragEvent,
  params: { id: string; width: number; height: number }
) => void;

export interface RoofNodeData extends CommonNodeData {
  width?: number;
  height?: number;
  onNodeResize?: OnNodeResize;
  isInvalid?: boolean;
  overlapWith?: boolean;
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
