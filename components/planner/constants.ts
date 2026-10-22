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
/** Initial fit is intentionally more legible than the later explicit overview. */
export const PLANNER_INITIAL_FIT_MIN_ZOOM = 0.4;
export const PLANNER_FIT_PADDING = 0.2;

/**
 * Zoom-Obergrenze beim Fokussieren eines Elements aus einer Warnung heraus.
 *
 * UI-AUDIT UX-FOCUS-001: Vorher standen dafür zwei verschiedene Magic Numbers
 * im Code — `1.15` für Bauteile und `1.05` für Leitungen, beide inline in
 * `FlowCanvas.handleFocusElement`. Derselbe Vorgang („zeige mir dieses
 * Element") bekam damit je nach Elementtyp eine andere Vergrößerung. Jetzt
 * gibt es eine benannte Grenze für beide; lange Leitungstrassen zoomen
 * darunter selbstständig heraus (`edgeFocusTarget`).
 */
export const PLANNER_FOCUS_MAX_ZOOM = 1.15;
export { PLANNER_SNAP_GRID } from './grid';

/**
 * Frames, die ein Bauteil-Zusatz auf eine messbare Plan-Pane wartet (≈0,5 s bei
 * 60 fps), bevor er auf das feste Raster fällt. Auf dem Handy ist der Katalog
 * ein eigener Tab: Beim Tippen auf eine Kachel ist die Plan-Spalte noch
 * `hidden`, der Tab-Wechsel folgt erst danach. Zwei Frames (der alte Wert)
 * reichten nicht, also landete dort jeder Zusatz auf dem Raster — teils
 * außerhalb der sichtbaren Fläche.
 */
export const PANE_WAIT_FRAMES = 30;

/**
 * Fußabdruck eines neu platzierten Bauteils. `placeAtCanvasCenter` zentriert
 * den Knoten mit der Hälfte davon auf den Pane-Mittelpunkt — die Zahl ist also
 * bereits im Versatz `initialPosition` enthalten und darf nicht auseinanderlaufen.
 */
export const NODE_FOOTPRINT = { width: 192, height: 120 } as const;

/**
 * Halbe Trefferfläche in Plan-Koordinaten: `app/globals.css` setzt den Handle
 * auf 60 × 60 Plan-Pixel. Die Prüfung unten multipliziert diesen Rand mit dem
 * aktuellen Zoom, bevor sie ihn in Bildschirm-Koordinaten umrechnet.
 */
export const NODE_TOUCH_MARGIN = 30;
