import type { CablePlannerEdge, PlannerNode } from './domain';

export const initialNodes: PlannerNode[] = [
  {
    id: 'battery',
    type: 'battery',
    position: { x: 100, y: 100 },
    data: { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4' },
  },
  {
    id: 'fuse-box',
    type: 'fuse',
    position: { x: 400, y: 100 },
    data: { label: 'Sicherungskasten', rating: 30 },
  },
  {
    id: 'consumer-1',
    type: 'consumer',
    position: { x: 700, y: 50 },
    data: { label: 'Verbraucher', watts: 60, hours: 12 },
  },
  {
    id: 'charger-1',
    type: 'charger',
    position: { x: 100, y: 300 },
    data: { label: 'Ladegerät', amps: 30 },
  },
];

export const initialEdges: CablePlannerEdge[] = [
  {
    id: 'e-battery-fuse-plus',
    source: 'battery',
    target: 'fuse-box',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: {
      length: 3,
      crossSection: 6,
      fuseSize: 30,
    },
  },
  {
    id: 'e-battery-fuse-minus',
    source: 'battery',
    target: 'fuse-box',
    sourceHandle: 'minus',
    targetHandle: 'minus',
    type: 'cableEdge',
    data: {
      length: 3,
      crossSection: 6,
    },
  },
  {
    id: 'e-fuse-consumer-plus',
    source: 'fuse-box',
    target: 'consumer-1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: {
      length: 5,
      crossSection: 2.5,
      fuseSize: 16,
    },
  },
  {
    id: 'e-fuse-consumer-minus',
    source: 'fuse-box',
    target: 'consumer-1',
    sourceHandle: 'minus',
    targetHandle: 'minus',
    type: 'cableEdge',
    data: {
      length: 5,
      crossSection: 2.5,
    },
  },
  {
    id: 'e-charger-battery-plus',
    source: 'charger-1',
    target: 'battery',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: {
      length: 2,
      crossSection: 10,
      fuseSize: 60,
    },
  },
  {
    id: 'e-charger-battery-minus',
    source: 'charger-1',
    target: 'battery',
    sourceHandle: 'minus',
    targetHandle: 'minus',
    type: 'cableEdge',
    data: {
      length: 2,
      crossSection: 10,
    },
  },
];
