export interface CommonNodeData {
  label?: string;
  watts?: number;
  concurrentDevices?: string[];
  continuousPower?: number;
  [key: string]: any;
}
