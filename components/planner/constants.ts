import CableEdge from '../edges/CableEdge';
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

export { initialEdges, initialNodes } from '../../lib/planner/initialGraph';

export const NODE_TYPES = {
  battery: BatteryNode,
  consumer: ConsumerNode,
  charger: ChargerNode,
  fuse: FuseNode,
  shorePower: ShorePowerNode,
  consumer230v: Consumer230VNode,
  inverter: InverterNode,
  solar: SolarNode,
  ground: GroundNode,
  conduit: ConduitNode,
  busbar: BusbarNode,
  shunt: ShuntNode,
};

export const EDGE_TYPES = { cableEdge: CableEdge };
