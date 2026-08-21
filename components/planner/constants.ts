import { Node, Edge } from 'reactflow';
import CableEdge, { CableEdgeData } from '../edges/CableEdge';
import { buildNodeTypes } from '../registry';

/**
 * Typ → React-Komponente für React Flow.
 *
 * Seit K4 aus der Bauteil-Registry abgeleitet (`components/registry`).
 * Ein neues Bauteil wird dort registriert und ist damit automatisch
 * darstellbar — diese Datei muss dafür nicht mehr angefasst werden.
 */
export const NODE_TYPES = buildNodeTypes();


export const EDGE_TYPES = { cableEdge: CableEdge };

export const PLANNER_MIN_ZOOM = 0.25;
export const PLANNER_MAX_ZOOM = 2;
export const PLANNER_FIT_PADDING = 0.2;
export const PLANNER_SNAP_GRID: [number, number] = [16, 16];
export const PLANNER_OVERVIEW_ZOOM = 0.5;
export const PLANNER_FULL_DETAIL_ZOOM = 1.5;

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
