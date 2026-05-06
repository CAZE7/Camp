export interface CommonNodeData {
  label?: string;
  watts?: number;
  concurrentDevices?: string[];
  continuousPower?: number;
  [key: string]: any;
}

export type OnNodeResize = (
  event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
  params: { id: string; width: number; height: number }
) => void;

export interface RoofNodeData extends CommonNodeData {
  width: number;
  height: number;
  onNodeResize?: OnNodeResize;
  isInvalid?: boolean;
  safeMargins?: {
    front: number;
    rear: number;
    left: number;
    right: number;
  };
}
