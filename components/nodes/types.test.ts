import { expectTypeOf, describe, it } from 'vitest';
import type {
  CommonNodeData,
  RoofNodeData,
  BatteryNodeData,
  ConsumerNodeData,
  SolarNodeData,
  ChargerNodeData,
  MpptControllerNodeData,
  DcdcChargerNodeData,
  AcBatteryChargerNodeData,
  BusbarNodeData,
  PlannerNodeData,
  OnNodeResize,
} from './types';
import type { ResizeDragEvent } from 'reactflow';
import type React from 'react';

describe('components/nodes/types', () => {
  it('CommonNodeData should have expected structure', () => {
    type ExpectedCommonNodeData = {
      label?: string;
      watts?: number;
      concurrentDevices?: string[];
      continuousPower?: number;
      [key: string]: unknown;
    };
    expectTypeOf<CommonNodeData>().toMatchTypeOf<ExpectedCommonNodeData>();
    expectTypeOf<ExpectedCommonNodeData>().toMatchTypeOf<CommonNodeData>();
  });

  it('OnNodeResize should have expected signature', () => {
    type ExpectedOnNodeResize = (
      event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent | ResizeDragEvent,
      params: { id: string; width: number; height: number }
    ) => void;
    expectTypeOf<OnNodeResize>().toMatchTypeOf<ExpectedOnNodeResize>();
    expectTypeOf<ExpectedOnNodeResize>().toMatchTypeOf<OnNodeResize>();
  });

  it('RoofNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedRoofNodeData = CommonNodeData & {
      width?: number;
      height?: number;
      onNodeResize?: OnNodeResize;
      isInvalid?: boolean;
      safeMargins?: {
        front?: number;
        rear?: number;
        left?: number;
        right?: number;
      };
    };
    expectTypeOf<RoofNodeData>().toMatchTypeOf<ExpectedRoofNodeData>();
    expectTypeOf<ExpectedRoofNodeData>().toMatchTypeOf<RoofNodeData>();
  });

  it('BatteryNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedBatteryNodeData = CommonNodeData & {
      capacity?: number;
      chemistry?: string;
      nominalVoltage?: number;
      hasInternalBms?: boolean;
      hasExternalBms?: boolean;
      bmsContinuousDischarge?: number;
      bmsPeakDischarge?: number;
      bmsContinuousCharge?: number;
    };
    expectTypeOf<BatteryNodeData>().toMatchTypeOf<ExpectedBatteryNodeData>();
    expectTypeOf<ExpectedBatteryNodeData>().toMatchTypeOf<BatteryNodeData>();
  });

  it('ConsumerNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedConsumerNodeData = CommonNodeData & {
      hours?: number;
    };
    expectTypeOf<ConsumerNodeData>().toMatchTypeOf<ExpectedConsumerNodeData>();
    expectTypeOf<ExpectedConsumerNodeData>().toMatchTypeOf<ConsumerNodeData>();
  });

  it('SolarNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedSolarNodeData = CommonNodeData & {
      voltage?: number;
      amps?: number;
    };
    expectTypeOf<SolarNodeData>().toMatchTypeOf<ExpectedSolarNodeData>();
    expectTypeOf<ExpectedSolarNodeData>().toMatchTypeOf<SolarNodeData>();
  });

  it('ChargerNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedChargerNodeData = CommonNodeData & {
      amps?: number;
      efficiency?: number;
    };
    expectTypeOf<ChargerNodeData>().toMatchTypeOf<ExpectedChargerNodeData>();
    expectTypeOf<ExpectedChargerNodeData>().toMatchTypeOf<ChargerNodeData>();
  });

  it('MpptControllerNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedMpptControllerNodeData = CommonNodeData & {
      amps?: number;
      efficiency?: number;
    };
    expectTypeOf<MpptControllerNodeData>().toMatchTypeOf<ExpectedMpptControllerNodeData>();
    expectTypeOf<ExpectedMpptControllerNodeData>().toMatchTypeOf<MpptControllerNodeData>();
  });

  it('DcdcChargerNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedDcdcChargerNodeData = CommonNodeData & {
      amps?: number;
      efficiency?: number;
    };
    expectTypeOf<DcdcChargerNodeData>().toMatchTypeOf<ExpectedDcdcChargerNodeData>();
    expectTypeOf<ExpectedDcdcChargerNodeData>().toMatchTypeOf<DcdcChargerNodeData>();
  });

  it('AcBatteryChargerNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedAcBatteryChargerNodeData = CommonNodeData & {
      amps?: number;
      efficiency?: number;
    };
    expectTypeOf<AcBatteryChargerNodeData>().toMatchTypeOf<ExpectedAcBatteryChargerNodeData>();
    expectTypeOf<ExpectedAcBatteryChargerNodeData>().toMatchTypeOf<AcBatteryChargerNodeData>();
  });

  it('BusbarNodeData should extend CommonNodeData with expected properties', () => {
    type ExpectedBusbarNodeData = CommonNodeData & {
      role?: 'positive' | 'negative';
    };
    expectTypeOf<BusbarNodeData>().toMatchTypeOf<ExpectedBusbarNodeData>();
    expectTypeOf<ExpectedBusbarNodeData>().toMatchTypeOf<BusbarNodeData>();
  });

  it('PlannerNodeData should be a union of node types', () => {
    type ExpectedPlannerNodeData =
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
    expectTypeOf<PlannerNodeData>().toMatchTypeOf<ExpectedPlannerNodeData>();
    expectTypeOf<ExpectedPlannerNodeData>().toMatchTypeOf<PlannerNodeData>();
  });
});
