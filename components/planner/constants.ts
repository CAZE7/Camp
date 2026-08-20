import { Node, Edge } from 'reactflow';
import CableEdge, { CableEdgeData } from '../edges/CableEdge';
import BatteryNode from '../nodes/BatteryNode';
import ConsumerNode from '../nodes/ConsumerNode';
import ChargerNode from '../nodes/ChargerNode';
import FuseNode from '../nodes/FuseNode';
import ShorePowerNode from '../nodes/ShorePowerNode';
import Consumer230VNode from '../nodes/Consumer230VNode';
import InverterNode from '../nodes/InverterNode';
import SolarNode from '../nodes/SolarNode';
import GroundNode from '../nodes/GroundNode';
import ConduitNode from '../nodes/ConduitNode';
import BusbarNode from '../nodes/BusbarNode';
import ShuntNode from '../nodes/ShuntNode';
import WaterNode from '../nodes/WaterNode';

export const NODE_TYPES = {
  battery: BatteryNode,
  consumer: ConsumerNode,
  charger: ChargerNode, // kept for backwards compatibility
  mpptController: ChargerNode,
  dcdcCharger: ChargerNode,
  acBatteryCharger: ChargerNode,
  fuse: FuseNode,
  shorePower: ShorePowerNode,
  consumer230v: Consumer230VNode,
  inverter: InverterNode,
  solar: SolarNode,
  ground: GroundNode,
  conduit: ConduitNode,
  busbar: BusbarNode,
  shunt: ShuntNode,
  freshWaterTank: WaterNode,
  grayWaterTank: WaterNode,
  pump: WaterNode,
  accumulator: WaterNode,
  preFilter: WaterNode,
  sink: WaterNode,
  shower: WaterNode,
};

export const EDGE_TYPES = { cableEdge: CableEdge };

export const PLANNER_MIN_ZOOM = 0.25;
export const PLANNER_MAX_ZOOM = 2;
export const PLANNER_FIT_PADDING = 0.2;
export const PLANNER_SNAP_GRID: [number, number] = [16, 16];
export const PLANNER_OVERVIEW_ZOOM = 0.7;

export const initialNodes: Node[] = [
  {
    id: 'battery',
    type: 'battery',
    position: { x: 100, y: 100 },
    data: { capacity: 100, chemistry: 'LiFePO4' },
  },
  {
    id: 'fuse-box',
    type: 'fuse',
    position: { x: 400, y: 100 },
    data: { label: 'Sicherungskasten', rating: 100 },
  },
  {
    id: 'consumer-1',
    type: 'consumer',
    position: { x: 700, y: 50 },
    data: { watts: 60, hours: 12 },
  },
  {
    id: 'mppt-1',
    type: 'mpptController',
    position: { x: 100, y: 300 },
    data: { amps: 30 },
  },
];

export const initialEdges: Edge<CableEdgeData>[] = [
  {
    id: 'e-battery-fuse',
    source: 'battery',
    target: 'fuse-box',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: {
      length: 0.2, // Hauptsicherung direkt an der Batterie (max. 20 cm)
      crossSection: 6,
      fuseSize: 5,
    },
  },
  {
    id: 'e-fuse-consumer',
    source: 'fuse-box',
    target: 'consumer-1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: {
      length: 3,
      crossSection: 2.5,
      fuseSize: 5,
    },
  },
  {
    id: 'e-mppt-battery',
    source: 'mppt-1',
    target: 'battery',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: {
      length: 2,
      crossSection: 10,
      fuseSize: 50,
    },
  },
];
