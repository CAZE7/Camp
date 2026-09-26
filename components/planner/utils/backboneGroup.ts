import type { Node } from '@xyflow/react';
import { getNodeLayoutSize } from './layout';
import { PRESENTATION_GROUP_TYPE, PRESENTATION_ONLY_FLAG } from '../../edges/utils/routableNodes';

export const BACKBONE_GROUP_ID = '__planner-backbone-group';
const CORE_TYPES = new Set(['battery', 'shunt', 'busbar', 'fuse']);
const PADDING_X = 44;
const PADDING_TOP = 56;
const PADDING_BOTTOM = 36;

/**
 * Adds a presentation-only React Flow node behind the main circuit.
 *
 * ## Warum hier zwischengespeichert wird (Bug 2026-09-26)
 *
 * React Flow 12 übernimmt eine Node nur dann unverändert in seinen internen
 * Bestand, wenn das Objekt **identisch** geblieben ist
 * (`adoptUserNodes`, `checkEquality`). Bei einem neuen Objekt baut React Flow
 * den internen Knoten neu auf und setzt dabei `measured` auf den Wert des
 * neuen Objekts — also auf `undefined`, denn der Rahmen wird nie in den
 * Planner-Store zurückgeschrieben (seine `dimensions`-Change läuft ins Leere).
 * Der ResizeObserver misst danach erneut. Für das Routing war das ein
 * Zustandswechsel von „Rahmen 844 × 392“ zu „Rahmen nicht gemessen“.
 *
 * Ein bei jedem Render neu erzeugtes Rahmen-Objekt (früher: bei jeder
 * Änderung von `displayedNodes`, also bei jedem Store-Schreibvorgang) löste
 * damit genau dieses Pendeln aus. Der Cache hält den Rahmen über Aufrufe
 * hinweg am Leben, solange seine Geometrie gleich bleibt: gleiche Geometrie ⇒
 * **dasselbe Objekt** ⇒ React Flow misst nicht neu ⇒ keine überflüssigen
 * Routing-Läufe.
 *
 * Der Rahmen trägt zusätzlich `width`/`height` (die beabsichtigte Größe aus
 * der Geometrie der Kern-Bauteile) — so hängt seine Box nicht länger an einer
 * DOM-Messung, und ein Neuaufbau wäre nicht mehr gleichbedeutend mit „keine
 * Größe“.
 */

type CachedGroup = { key: string; node: Node };

/** Letzter Rahmen und die Geometrie, für die er gilt (eine Zeile Zustand). */
let cached: CachedGroup | null = null;

/** Cache verwerfen — nur für Tests und den Fall „Rahmen ausgeschaltet“. */
export function resetBackboneGroupCache(): void {
  cached = null;
}

export function withBackboneGroup(nodes: Node[], enabled: boolean): Node[] {
  if (!enabled) {
    resetBackboneGroupCache();
    return nodes;
  }
  const core = nodes.filter((node) => node.type && CORE_TYPES.has(node.type));
  if (core.length < 2) {
    resetBackboneGroupCache();
    return nodes;
  }

  const left = Math.min(...core.map((node) => node.position.x));
  const top = Math.min(...core.map((node) => node.position.y));
  const right = Math.max(...core.map((node) => node.position.x + getNodeLayoutSize(node).width));
  const bottom = Math.max(...core.map((node) => node.position.y + getNodeLayoutSize(node).height));
  const x = left - PADDING_X;
  const y = top - PADDING_TOP;
  const width = right - left + PADDING_X * 2;
  const height = bottom - top + PADDING_TOP + PADDING_BOTTOM;

  const key = `${x}:${y}:${width}:${height}`;
  if (cached && cached.key === key) return [cached.node, ...nodes];

  const group: Node = {
    id: BACKBONE_GROUP_ID,
    type: PRESENTATION_GROUP_TYPE,
    position: { x, y },
    data: { label: 'Hauptstromkreis', [PRESENTATION_ONLY_FLAG]: true },
    // Beabsichtigte Größe (nicht gemessen): identisch zu `style`, aber auch
    // für Leser sichtbar, die nur `node.width/height` auswerten.
    width,
    height,
    style: {
      width,
      height,
    },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false,
    deletable: false,
    zIndex: -10,
    className: 'planner-backbone-group-node',
  };
  cached = { key, node: group };
  return [group, ...nodes];
}
