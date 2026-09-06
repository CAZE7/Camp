/**
 * lib/planner/domainModel.ts
 *
 * PURE domain types for Routing V2.
 *
 * This module must not import React Flow, ELK, dagre, React or Next. UI-specific
 * fields (style, markerEnd, selected, draggable, ...) intentionally live on the
 * UI adapter side, never here.
 */

export type PlannerPosition = {
  readonly x: number;
  readonly y: number;
};

export type PlannerSize = {
  readonly width: number;
  readonly height: number;
};

export type HandleId = string;

/** Common electrical/plumbing node data. No index signature, no `any`. */
export type BaseNodeData = {
  readonly label?: string;
  readonly watts?: number;
  readonly hours?: number;
  readonly amps?: number;
  readonly efficiency?: number;
  readonly capacity?: number;
  readonly chemistry?: string;
  readonly rating?: number;
  readonly hasRcd?: boolean;
  readonly continuousPower?: number;
  readonly concurrentDevices?: readonly string[];
  readonly assignedEdges?: readonly string[];
  readonly voltage?: number;
  readonly isInvalid?: boolean;
};

export type BatteryNodeData = BaseNodeData & {
  readonly capacity?: number;
  readonly chemistry?: string;
};

export type FuseNodeData = BaseNodeData & {
  readonly rating?: number;
};

export type ConsumerNodeData = BaseNodeData & {
  readonly watts?: number;
  readonly hours?: number;
};

export type InverterNodeData = BaseNodeData & {
  readonly watts?: number;
  readonly continuousPower?: number;
  readonly concurrentDevices?: readonly string[];
  readonly efficiency?: number;
};

export type SolarNodeData = BaseNodeData & {
  readonly watts?: number;
};

export type ChargerNodeData = BaseNodeData & {
  readonly amps?: number;
};

export type ShorePowerNodeData = BaseNodeData & {
  readonly hasRcd?: boolean;
};

export type BusbarNodeData = BaseNodeData & {
  readonly rating?: number;
};

export type ShuntNodeData = BaseNodeData & {
  readonly rating?: number;
};

export type WaterNodeData = BaseNodeData & {
  readonly pipeType?: string;
  readonly diameter?: number;
};

export type PlannerNodeData =
  | BatteryNodeData
  | FuseNodeData
  | ConsumerNodeData
  | InverterNodeData
  | SolarNodeData
  | ChargerNodeData
  | ShorePowerNodeData
  | BusbarNodeData
  | ShuntNodeData
  | WaterNodeData;

export type PlannerNode<D extends PlannerNodeData = PlannerNodeData> = {
  readonly id: string;
  readonly type: string;
  readonly position: PlannerPosition;
  readonly data: Readonly<D>;
  readonly width?: number;
  readonly height?: number;
};

export type CableFunction =
  | 'positive'
  | 'negative'
  | 'ground'
  | 'solar'
  | 'main'
  | 'secondary'
  | 'shore'
  | 'inverter'
  | 'charging'
  | 'consumer'
  | 'busbar';

export type BaseEdgeData = {
  readonly kind?: 'cable' | 'waterPipe';
  readonly length?: number;
  readonly crossSection?: number;
  readonly fuseSize?: number;
  readonly cableFunction?: CableFunction;
};

export type CableEdgeData = BaseEdgeData & {
  readonly kind?: 'cable';
  readonly length?: number;
  readonly crossSection?: number;
  readonly fuseSize?: number;
  readonly cableFunction?: CableFunction;
};

export type WaterPipeEdgeData = BaseEdgeData & {
  readonly kind?: 'waterPipe';
  readonly pipeType?: string;
  readonly diameter?: number;
};

export type EdgeGeometry = {
  readonly points: readonly PlannerPosition[];
};

export type PlannerEdge<D extends BaseEdgeData = BaseEdgeData> = {
  readonly id: string;
  readonly kind?: 'cable' | 'waterPipe';
  readonly type?: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: HandleId;
  readonly targetHandle?: HandleId;
  readonly data?: Readonly<D>;
  readonly geometry?: EdgeGeometry;
};

export type CablePlannerEdge = PlannerEdge<CableEdgeData>;
export type WaterPlannerEdge = PlannerEdge<WaterPipeEdgeData>;

export type Point = {
  readonly x: number;
  readonly y: number;
};

export type BBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type Segment = {
  readonly from: Point;
  readonly to: Point;
};
