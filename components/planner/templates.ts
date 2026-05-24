import { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';

export const TEMPLATE_MINIMALIST = {
  nodes: [
    { id: 'battery-1', type: 'battery', position: { x: 100, y: 300 }, data: { label: '12V Batterie', capacity: 100, chemistry: 'AGM' } },
    { id: 'fusebox-1', type: 'fuse', position: { x: 400, y: 300 }, data: { label: 'Sicherungskasten' } },
    { id: 'cons-light', type: 'consumer', position: { x: 700, y: 200 }, data: { label: 'LED-Beleuchtung', watts: 20 } },
    { id: 'cons-usb', type: 'consumer', position: { x: 700, y: 300 }, data: { label: 'USB Steckdosen', watts: 36 } },
    { id: 'cons-cool', type: 'consumer', position: { x: 700, y: 400 }, data: { label: 'Kühlbox', watts: 45 } },
    { id: 'ground-1', type: 'ground', position: { x: 100, y: 500 }, data: { label: 'Massepunkt' } },
  ] as Node[],
  edges: [
    { id: 'e-batt-fuse', source: 'battery-1', sourceHandle: 'plus', target: 'fusebox-1', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 10 } },
    { id: 'e-batt-gnd', source: 'battery-1', sourceHandle: 'minus', target: 'ground-1', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 10 } },
    { id: 'e-fuse-light', source: 'fusebox-1', sourceHandle: 'out1', target: 'cons-light', targetHandle: 'plus', type: 'cableEdge', data: { length: 5, crossSection: 2.5 } },
    { id: 'e-fuse-usb', source: 'fusebox-1', sourceHandle: 'out2', target: 'cons-usb', targetHandle: 'plus', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } },
    { id: 'e-fuse-cool', source: 'fusebox-1', sourceHandle: 'out3', target: 'cons-cool', targetHandle: 'plus', type: 'cableEdge', data: { length: 2, crossSection: 4 } },
  ] as Edge<CableEdgeData>[],
};

export const TEMPLATE_ALLROUNDER = {
  nodes: [
    { id: 'battery-1', type: 'battery', position: { x: 100, y: 400 }, data: { label: '100Ah Lithium', capacity: 100, chemistry: 'LiFePO4' } },
    { id: 'busbar-plus', type: 'busbar', position: { x: 300, y: 300 }, data: { label: 'Plus Busbar' } },
    { id: 'busbar-minus', type: 'busbar', position: { x: 300, y: 500 }, data: { label: 'Minus Busbar' } },
    { id: 'fusebox-1', type: 'fuse', position: { x: 500, y: 200 }, data: { label: 'Sicherungskasten' } },
    { id: 'solar-1', type: 'solar', position: { x: 100, y: 100 }, data: { label: '150W Solar', watts: 150 } },
    { id: 'charger-1', type: 'mpptController', position: { x: 300, y: 100 }, data: { label: 'MPPT Solarregler', amps: 30 } },
    { id: 'charger-2', type: 'dcdcCharger', position: { x: 300, y: 200 }, data: { label: 'DC-DC Ladebooster', amps: 30 } },
    { id: 'starter-1', type: 'battery', position: { x: 100, y: 200 }, data: { label: 'Starterbatterie', capacity: 90, chemistry: 'AGM' } },
    { id: 'inverter-1', type: 'inverter', position: { x: 500, y: 400 }, data: { label: '500W Inverter', watts: 500 } },
    { id: 'cons-fridge', type: 'consumer', position: { x: 700, y: 100 }, data: { label: 'Kompressorkühlschrank', watts: 60 } },
    { id: 'cons-pump', type: 'consumer', position: { x: 700, y: 200 }, data: { label: 'Wasserpumpe', watts: 40 } },
    { id: 'cons-light', type: 'consumer', position: { x: 700, y: 300 }, data: { label: 'LED-Beleuchtung', watts: 20 } },
    { id: 'cons-230v', type: 'consumer230v', position: { x: 800, y: 400 }, data: { label: '230V Steckdose', watts: 300 } },
  ] as Node[],
  edges: [
    { id: 'e-batt-plus', source: 'battery-1', sourceHandle: 'plus', target: 'busbar-plus', targetHandle: 'in', type: 'cableEdge', data: { length: 0.5, crossSection: 35, fuseSize: 100 } },
    { id: 'e-batt-minus', source: 'battery-1', sourceHandle: 'minus', target: 'busbar-minus', targetHandle: 'in', type: 'cableEdge', data: { length: 0.5, crossSection: 35 } },
    { id: 'e-solar-charger', source: 'solar-1', sourceHandle: 'plus', target: 'charger-1', targetHandle: 'in-solar', type: 'cableEdge', data: { length: 3, crossSection: 6 } },
    { id: 'e-charger-busbar', source: 'charger-1', sourceHandle: 'out-plus', target: 'busbar-plus', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 10, fuseSize: 40 } },
    { id: 'e-starter-dcdc', source: 'starter-1', sourceHandle: 'plus', target: 'charger-2', targetHandle: 'in-starter', type: 'cableEdge', data: { length: 5, crossSection: 16, fuseSize: 60 } },
    { id: 'e-dcdc-busbar', source: 'charger-2', sourceHandle: 'out-plus', target: 'busbar-plus', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 16, fuseSize: 50 } },
    { id: 'e-busbar-fuse', source: 'busbar-plus', sourceHandle: 'out1', target: 'fusebox-1', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 16 } },
    { id: 'e-fuse-fridge', source: 'fusebox-1', sourceHandle: 'out1', target: 'cons-fridge', targetHandle: 'plus', type: 'cableEdge', data: { length: 3, crossSection: 4 } },
    { id: 'e-fuse-pump', source: 'fusebox-1', sourceHandle: 'out2', target: 'cons-pump', targetHandle: 'plus', type: 'cableEdge', data: { length: 4, crossSection: 2.5 } },
    { id: 'e-fuse-light', source: 'fusebox-1', sourceHandle: 'out3', target: 'cons-light', targetHandle: 'plus', type: 'cableEdge', data: { length: 5, crossSection: 1.5 } },
    { id: 'e-busbar-inv-plus', source: 'busbar-plus', sourceHandle: 'out2', target: 'inverter-1', targetHandle: 'in-plus', type: 'cableEdge', data: { length: 1, crossSection: 25, fuseSize: 60 } },
    { id: 'e-busbar-inv-minus', source: 'inverter-1', sourceHandle: 'out-minus', target: 'busbar-minus', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 25 } },
    { id: 'e-inv-230', source: 'inverter-1', sourceHandle: 'out', target: 'cons-230v', targetHandle: 'in', type: 'cableEdge', data: { length: 2, crossSection: 2.5 } },
  ] as Edge<CableEdgeData>[],
};

export const TEMPLATE_AUTARK = {
  nodes: [
    { id: 'battery-1', type: 'battery', position: { x: 100, y: 500 }, data: { label: '200Ah Lithium', capacity: 200, chemistry: 'LiFePO4' } },
    { id: 'busbar-plus', type: 'busbar', position: { x: 300, y: 400 }, data: { label: 'Plus Busbar' } },
    { id: 'busbar-minus', type: 'busbar', position: { x: 300, y: 600 }, data: { label: 'Minus Busbar' } },
    { id: 'fusebox-1', type: 'fuse', position: { x: 500, y: 200 }, data: { label: 'Sicherungskasten' } },
    { id: 'solar-1', type: 'solar', position: { x: 100, y: 100 }, data: { label: '400W Solar', watts: 400 } },
    { id: 'charger-1', type: 'mpptController', position: { x: 300, y: 100 }, data: { label: 'MPPT Solarregler', amps: 30 } },
    { id: 'charger-2', type: 'dcdcCharger', position: { x: 300, y: 200 }, data: { label: 'DC-DC Ladebooster', amps: 30 } },
    { id: 'starter-1', type: 'battery', position: { x: 100, y: 200 }, data: { label: 'Starterbatterie', capacity: 90, chemistry: 'AGM' } },
    { id: 'shore-1', type: 'shorePower', position: { x: 100, y: 300 }, data: { label: 'Landstrom' } },
    { id: 'inverter-1', type: 'inverter', position: { x: 500, y: 500 }, data: { label: '2000W Inverter', watts: 2000 } },
    { id: 'cons-fridge', type: 'consumer', position: { x: 700, y: 100 }, data: { label: 'Kompressorkühlschrank', watts: 60 } },
    { id: 'cons-heat', type: 'consumer', position: { x: 700, y: 200 }, data: { label: 'Standheizung', watts: 40 } },
    { id: 'cons-fan', type: 'consumer', position: { x: 700, y: 300 }, data: { label: 'MaxxFan', watts: 40 } },
    { id: 'cons-induct', type: 'consumer230v', position: { x: 800, y: 500 }, data: { label: 'Induktionskochfeld', watts: 1500 } },
  ] as Node[],
  edges: [
    { id: 'e-batt-plus', source: 'battery-1', sourceHandle: 'plus', target: 'busbar-plus', targetHandle: 'in', type: 'cableEdge', data: { length: 0.5, crossSection: 50, fuseSize: 200 } },
    { id: 'e-batt-minus', source: 'battery-1', sourceHandle: 'minus', target: 'busbar-minus', targetHandle: 'in', type: 'cableEdge', data: { length: 0.5, crossSection: 50 } },
    { id: 'e-solar-charger', source: 'solar-1', sourceHandle: 'plus', target: 'charger-1', targetHandle: 'in-solar', type: 'cableEdge', data: { length: 4, crossSection: 6 } },
    { id: 'e-charger-busbar', source: 'charger-1', sourceHandle: 'out-plus', target: 'busbar-plus', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 10, fuseSize: 40 } },
    { id: 'e-starter-dcdc', source: 'starter-1', sourceHandle: 'plus', target: 'charger-2', targetHandle: 'in-starter', type: 'cableEdge', data: { length: 5, crossSection: 16, fuseSize: 60 } },
    { id: 'e-dcdc-busbar', source: 'charger-2', sourceHandle: 'out-plus', target: 'busbar-plus', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 16, fuseSize: 50 } },
    { id: 'e-busbar-fuse', source: 'busbar-plus', sourceHandle: 'out1', target: 'fusebox-1', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 16 } },
    { id: 'e-fuse-fridge', source: 'fusebox-1', sourceHandle: 'out1', target: 'cons-fridge', targetHandle: 'plus', type: 'cableEdge', data: { length: 3, crossSection: 4 } },
    { id: 'e-fuse-heat', source: 'fusebox-1', sourceHandle: 'out2', target: 'cons-heat', targetHandle: 'plus', type: 'cableEdge', data: { length: 4, crossSection: 4 } },
    { id: 'e-fuse-fan', source: 'fusebox-1', sourceHandle: 'out3', target: 'cons-fan', targetHandle: 'plus', type: 'cableEdge', data: { length: 5, crossSection: 2.5 } },
    { id: 'e-busbar-inv-plus', source: 'busbar-plus', sourceHandle: 'out2', target: 'inverter-1', targetHandle: 'in-plus', type: 'cableEdge', data: { length: 1, crossSection: 50, fuseSize: 200 } },
    { id: 'e-busbar-inv-minus', source: 'inverter-1', sourceHandle: 'out-minus', target: 'busbar-minus', targetHandle: 'in', type: 'cableEdge', data: { length: 1, crossSection: 50 } },
    { id: 'e-inv-induct', source: 'inverter-1', sourceHandle: 'out', target: 'cons-induct', targetHandle: 'in', type: 'cableEdge', data: { length: 2, crossSection: 2.5 } },
  ] as Edge<CableEdgeData>[],
};

export const TEMPLATES_DICT: Record<string, { nodes: Node[], edges: Edge<CableEdgeData>[] }> = {
  minimalist: TEMPLATE_MINIMALIST,
  allrounder: TEMPLATE_ALLROUNDER,
  autark: TEMPLATE_AUTARK,
};
