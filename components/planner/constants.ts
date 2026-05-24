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

export const initialNodes: Node[] = [
  {
    id: 'battery',
    type: 'battery',
    position: { x: 100, y: 100 },
    data: { capacity: 100, chemistry: 'LiFePO4' },
  },
  {
    id: 'fuse-box',
    type: 'default',
    position: { x: 400, y: 100 },
    data: { label: 'Sicherungskasten' },
    style: { border: '1px solid #777', padding: 10, borderRadius: 5, background: '#fff' }
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
    type: 'cableEdge',
    data: {
      length: 3,
      crossSection: 6,
    },
  },
  {
    id: 'e-fuse-consumer',
    source: 'fuse-box',
    target: 'consumer-1',
    type: 'cableEdge',
    data: {
      length: 5,
      crossSection: 2.5,
    },
  },
  {
    id: 'e-mppt-battery',
    source: 'mppt-1',
    target: 'battery',
    type: 'cableEdge',
    data: {
      length: 2,
      crossSection: 10,
    },
  },
];
