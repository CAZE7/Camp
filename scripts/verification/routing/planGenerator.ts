/**
 * Deterministischer Plandgenerator für die Property-Prüfung (Stufe V4).
 *
 * Warum überhaupt ein Generator
 * =============================
 * Sechs Referenzpläne sind sechs Beispiele. Sie können nicht zeigen, dass eine
 * Eigenschaft *immer* gilt — nur, dass sie sechsmal gegolten hat. Ein Generator
 * erzeugt Pläne, die niemand ausgedacht hat: andere Abstände, andere
 * Verzweigungen, andere Ports.
 *
 * Drei Regeln, damit die Prüfung etwas wert ist:
 *
 *  1. **Kein `Math.random`.** Der Generator nimmt einen Zahlen-Seed und ist
 *     damit reproduzierbar. Ein fehlschlagender Fall ist immer nachstellbar —
 *     ohne dass in einer Akte ein Seed stehen muss (§7.1 der Spezifikation).
 *  2. **Gültige Pläne.** Der Generator erzeugt Eingaben, die ein Planer
 *     erzeugen könnte: getrennte Bauteile, benannte Anschlüsse, endliche
 *     Koordinaten. Ungültige Eingaben sind Sache des Fuzzers, nicht der
 *     Eigenschaftsprüfung — sonst prüft man zwei Dinge gleichzeitig.
 *  3. **Keine AutoWire-Abhängigkeit.** Der Generator liefert direkt die
 *     Eingabe des Routers (`RoutableNode`, `RouteEdgeRef`). Die elektrische
 *     Pipeline ist für die Geometrieprüfung irrelevant und würde nur Laufzeit
 *     kosten.
 */

import type { RouteEdgeRef } from '../../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../../components/edges/utils/nodeGeometry';
import type { Point } from '../../../lib/routing/geometry';

export type PortSide = 'left' | 'right' | 'top' | 'bottom';

export type GeneratedPlan = {
  seed: number;
  nodes: RoutableNode[];
  edges: RouteEdgeRef[];
  /** Anschluss-Weltkoordinaten je `edgeId` — die Erwartung für P6. */
  endpoints: Map<string, { source: Point; target: Point }>;
};

/** Kleiner, schneller, deterministischer PRNG (mulberry32). */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NODE_W = 192;
const NODE_H = 120;
const PORT_INSET = 56;

const SIDES: readonly PortSide[] = ['left', 'right', 'top', 'bottom'];

type HandleSpec = { id: string; x: number; y: number; position: PortSide };

/** Anschlüsse eines Bauteils: ein bis drei je Seite, auf der Kante verteilt. */
function handlesFor(random: () => number): HandleSpec[] {
  const handles: HandleSpec[] = [];
  for (const side of SIDES) {
    if (random() < 0.55) continue;
    const count = random() < 0.8 ? 1 : 2;
    for (let index = 0; index < count; index += 1) {
      const fraction = (index + 1) / (count + 1);
      handles.push({
        id: `${side}-${index}`,
        x: side === 'left' ? 0 : side === 'right' ? NODE_W : Math.round(fraction * NODE_W),
        y: side === 'top' ? 0 : side === 'bottom' ? NODE_H : Math.round(fraction * NODE_H),
        position: side,
      });
    }
  }
  // Jedes Bauteil braucht mindestens einen Anschluss — sonst ist es kein Bauteil.
  if (handles.length === 0) handles.push({ id: 'right-0', x: NODE_W, y: PORT_INSET, position: 'right' });
  return handles;
}

const handleBoundsOf = (handles: readonly HandleSpec[]): Record<PortSide, unknown[]> => {
  const bounds: Record<PortSide, unknown[]> = { left: [], right: [], top: [], bottom: [] };
  for (const handle of handles) {
    bounds[handle.position].push({
      id: handle.id,
      x: handle.x,
      y: handle.y,
      width: 8,
      height: 8,
      position: handle.position,
    });
  }
  return bounds;
};

/** Weltkoordinate eines Anschlusses (die Erwartung, gegen die P6 prüft). */
export function handlePoint(node: RoutableNode, handleId: string): Point | null {
  const bounds = (node as unknown as { handleBounds?: Record<PortSide, HandleSpec[]> }).handleBounds;
  if (!bounds) return null;
  for (const side of SIDES) {
    for (const handle of bounds[side] ?? []) {
      if (handle.id !== handleId) continue;
      return { x: node.position.x + handle.x, y: node.position.y + handle.y };
    }
  }
  return null;
}

/**
 * Erzeugt einen Plan mit `nodeCount` Bauteilen auf einem Raster.
 *
 * Das Raster erzwingt Mindestabstände (kein Bauteil überlappt ein anderes):
 * ein Plan, in dem Bauteile übereinanderliegen, ist kein sinnvoller
 * Routingtest, sondern ein Platzierungsfehler.
 */
export function generatePlan(
  seed: number,
  options: { nodeCount?: number; edgeCount?: number } = {}
): GeneratedPlan {
  const random = makeRandom(seed);
  const nodeCount = options.nodeCount ?? 2 + Math.floor(random() * 5);
  const columns = Math.ceil(Math.sqrt(nodeCount));
  const cell = 420;
  const jitter = 40;

  const nodes: RoutableNode[] = [];
  const handles = new Map<string, HandleSpec[]>();
  for (let index = 0; index < nodeCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 60 + column * cell + Math.round(random() * jitter);
    const y = 60 + row * cell + Math.round(random() * jitter);
    const spec = handlesFor(random);
    handles.set(`n${index}`, spec);
    const bounds = handleBoundsOf(spec);
    nodes.push({
      id: `n${index}`,
      type: 'component',
      position: { x, y },
      data: { label: `N${index}` },
      width: NODE_W,
      height: NODE_H,
      measured: { width: NODE_W, height: NODE_H },
      // React Flow 12 legt die Anschlussgeometrie unter `internals` ab. Beide
      // Orte werden gesetzt, damit der Generator nicht von einer Version des
      // Renderers abhängt — der Router liest, was er findet.
      handleBounds: bounds,
      internals: { positionAbsolute: { x, y }, handleBounds: bounds },
    } as unknown as RoutableNode);
  }

  const edgeCount = options.edgeCount ?? Math.min(nodeCount, 1 + Math.floor(random() * nodeCount));
  const edges: RouteEdgeRef[] = [];
  const endpoints = new Map<string, { source: Point; target: Point }>();
  for (let index = 0; index < edgeCount; index += 1) {
    const sourceIndex = Math.floor(random() * nodeCount);
    let targetIndex = Math.floor(random() * nodeCount);
    if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % nodeCount;
    const sourceNode = nodes[sourceIndex] as RoutableNode;
    const targetNode = nodes[targetIndex] as RoutableNode;
    const sourceHandles = handles.get(String(sourceNode.id)) ?? [];
    const targetHandles = handles.get(String(targetNode.id)) ?? [];
    const sourceHandle = sourceHandles[Math.floor(random() * sourceHandles.length)];
    const targetHandle = targetHandles[Math.floor(random() * targetHandles.length)];
    if (!sourceHandle || !targetHandle) continue;

    const id = `e${index}`;
    edges.push({
      id,
      source: String(sourceNode.id),
      target: String(targetNode.id),
      sourceHandle: sourceHandle.id,
      targetHandle: targetHandle.id,
    } as unknown as RouteEdgeRef);
    endpoints.set(id, {
      source: handlePoint(sourceNode, sourceHandle.id) as Point,
      target: handlePoint(targetNode, targetHandle.id) as Point,
    });
  }

  return { seed, nodes, edges, endpoints };
}

/** Verschiebt einen Plan — Grundlage der Translationsinvarianten (Metamorphik). */
export function translatePlan(plan: GeneratedPlan, dx: number, dy: number): GeneratedPlan {
  const nodes = plan.nodes.map((node) => {
    const internals = (node as unknown as { internals?: { positionAbsolute?: { x: number; y: number } } })
      .internals;
    return {
      ...node,
      position: { x: node.position.x + dx, y: node.position.y + dy },
      // `nodeOriginX/Y` liest zuerst `internals.positionAbsolute` — wer nur
      // `position` verschiebt, verschiebt den Plan für den Router nicht.
      internals: internals
        ? {
            ...internals,
            positionAbsolute: {
              x: (internals.positionAbsolute?.x ?? node.position.x) + dx,
              y: (internals.positionAbsolute?.y ?? node.position.y) + dy,
            },
          }
        : internals,
    };
  }) as RoutableNode[];
  const endpoints = new Map<string, { source: Point; target: Point }>();
  for (const [id, entry] of plan.endpoints) {
    endpoints.set(id, {
      source: { x: entry.source.x + dx, y: entry.source.y + dy },
      target: { x: entry.target.x + dx, y: entry.target.y + dy },
    });
  }
  return { seed: plan.seed, nodes, edges: plan.edges, endpoints };
}

/** Abstand eines Punkts zur nächsten Bauteilkante (Diagnose). */
export const nodeRectOf = (node: RoutableNode): { x: number; y: number; width: number; height: number } => ({
  x: node.position.x,
  y: node.position.y,
  width: Number(node.width ?? NODE_W),
  height: Number(node.height ?? NODE_H),
});
