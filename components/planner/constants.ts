import CableEdge from '../edges/CableEdge';
import { buildNodeTypes } from '../registry';

/**
 * Typ → React-Komponente für React Flow.
 *
 * Seit K4 aus der Bauteil-Registry abgeleitet (`components/registry`).
 * Ein neues Bauteil wird dort registriert und ist damit automatisch
 * darstellbar — diese Datei muss dafür nicht mehr angefasst werden.
 *
 * Mission 4: Die früheren `initialNodes`/`initialEdges` (Demo-Fixtures) waren
 * toter Code — der Plan startet leer bzw. über Templates/Onboarding.
 */
export const NODE_TYPES = buildNodeTypes();

export const EDGE_TYPES = { cableEdge: CableEdge };

export const PLANNER_MIN_ZOOM = 0.25;
export const PLANNER_MAX_ZOOM = 2;
export const PLANNER_FIT_PADDING = 0.2;
export const PLANNER_SNAP_GRID: [number, number] = [16, 16];
export const PLANNER_OVERVIEW_ZOOM = 0.5;
export const PLANNER_FULL_DETAIL_ZOOM = 1.5;
