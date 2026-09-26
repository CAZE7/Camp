import type { Node } from '@xyflow/react';

/**
 * Interaktions-Zustand eines Knotens als **stabile** Objektvariante.
 *
 * ## Warum das nicht inline im Render passiert (Bug 2026-09-26)
 *
 * React Flow 12 übernimmt eine Node unverändert in seinen internen Bestand,
 * wenn das Objekt identisch geblieben ist (`adoptUserNodes`, `checkEquality`).
 * Ein `nodes.map((node) => ({ ...node, className }))` erzeugt bei jedem
 * Aufruf neue Objekte — React Flow baut dann für **jeden** Knoten den
 * internen Knoten neu auf (`internals.userNode`, Position, zIndex). Auf
 * Touch-Geräten betraf das wegen `dragHandle` jeden Knoten, und der
 * Neuaufbau ist der Auslöser der Re-Mess-/Routing-Schleife.
 *
 * Der Cache hier macht aus „gleicher Knoten + gleiche Flags“ wieder
 * „dasselbe Objekt“. Er hängt an der Objekt-Identität des Eingangs
 * (`WeakMap`), nicht an der ID: Wird der Basis-Knoten ersetzt, entsteht
 * genau einmal eine neue Variante — und veraltete Einträge verschwinden mit
 * dem alten Objekt.
 *
 * Die erzeugten `className`-Werte sind bewusst Zeichen für Zeichen dieselben
 * wie zuvor (`planner-node-collision`, `node-drag-armed`), damit sich am
 * Aussehen nichts ändert.
 */

export const COLLISION_CLASS = 'planner-node-collision';
export const DRAG_ARMED_CLASS = 'node-drag-armed';

export type NodeInteractionState =
  /** Feiner Zeiger ohne Griff: nur die Kollisionsmarkierung kann greifen. */
  | { collision: boolean; dragHandle: 'inherit' }
  /** Touch: langes Drücken hat den Knoten für freies Ziehen freigegeben. */
  | { collision: boolean; dragHandle: 'armed' }
  /** Touch: ziehbar ausschließlich am Griff (44 px). */
  | { collision: boolean; dragHandle: 'handle'; handleSelector: string };

let cache = new WeakMap<Node, Map<string, Node>>();

/** Cache verwerfen — nur für Tests (eine WeakMap lässt sich nicht leeren). */
export function resetNodeInteractionStateCache(): void {
  cache = new WeakMap();
}

function cacheKey(state: NodeInteractionState): string {
  return `${state.dragHandle}|${state.collision ? 1 : 0}|${
    state.dragHandle === 'handle' ? state.handleSelector : ''
  }`;
}

function wrap(node: Node, state: NodeInteractionState): Node {
  const base = node.className || '';
  if (state.dragHandle === 'inherit') {
    return { ...node, className: `${base} ${COLLISION_CLASS}`.trim() };
  }
  const collision = state.collision ? COLLISION_CLASS : '';
  return {
    ...node,
    // `armed` setzt den Griff bewusst auf `undefined`: Der ganze Knoten ist
    // in diesem Zustand ziehbar, nicht nur die Griffleiste.
    dragHandle: state.dragHandle === 'handle' ? state.handleSelector : undefined,
    className:
      state.dragHandle === 'armed'
        ? `${base} ${DRAG_ARMED_CLASS} ${collision}`.trim()
        : `${base} ${collision}`.trim(),
  };
}

/**
 * Liefert den Knoten mit Interaktions-Flags — und **dasselbe Objekt**, wenn
 * es für diese Kombination schon eines gibt. Ohne Flags bleibt der Eingang
 * unverändert (keine Kopie).
 */
export function withNodeInteractionState(node: Node, state: NodeInteractionState): Node {
  if (state.dragHandle === 'inherit' && !state.collision) return node;

  const perNode = cache.get(node);
  const key = cacheKey(state);
  const existing = perNode?.get(key);
  if (existing) return existing;

  const wrapped = wrap(node, state);
  if (perNode) perNode.set(key, wrapped);
  else cache.set(node, new Map([[key, wrapped]]));
  return wrapped;
}
