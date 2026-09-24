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
 *
 * M8-1: Zoom-Stufen (`PLANNER_OVERVIEW_ZOOM` / `PLANNER_FULL_DETAIL_ZOOM`)
 * gibt es nicht mehr. Darstellung ist von minZoom bis maxZoom identisch.
 */
export const NODE_TYPES = buildNodeTypes();

export const EDGE_TYPES = { cableEdge: CableEdge };

export const PLANNER_MIN_ZOOM = 0.25;
export const PLANNER_MAX_ZOOM = 2;
export const PLANNER_FIT_PADDING = 0.2;
export const PLANNER_SNAP_GRID: [number, number] = [16, 16];

/**
 * Frames, die ein Bauteil-Zusatz auf eine messbare Plan-Pane wartet (≈0,5 s bei
 * 60 fps), bevor er auf das feste Raster fällt. Auf dem Handy ist der Katalog
 * ein eigener Tab: Beim Tippen auf eine Kachel ist die Plan-Spalte noch
 * `hidden`, der Tab-Wechsel folgt erst danach. Zwei Frames (der alte Wert)
 * reichten nicht, also landete dort jeder Zusatz auf dem Raster — teils
 * außerhalb der sichtbaren Fläche.
 */
export const PANE_WAIT_FRAMES = 30;
