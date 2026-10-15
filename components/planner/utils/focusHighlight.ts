import { withClassFlag } from './classFlags';

export type FocusableNode = { id: string; className?: string };
export type FocusableEdge = { id: string; source: string; target: string; className?: string };

const ACTIVE = 'planner-focus-active';
const DIM = 'planner-focus-dim';

/**
 * Fokus-Marken laufen über `withClassFlag` (identitätsstabil + idempotent,
 * Begründung im Modul). Vorher entstand hier bei **jedem** Hover und jedem
 * Drag-Frame für jedes Element ein neues Objekt — React Flow baute daraufhin
 * alle internen Knoten neu auf und maß sie neu.
 */
const withFlag = withClassFlag;

/**
 * When a single node is selected, keep it and its neighbours readable and dim the rest.
 * Pure presentation — does not mutate store records in place.
 */
export function applyNeighborhoodFocus<N extends FocusableNode, E extends FocusableEdge>(
  nodes: N[],
  edges: E[],
  focusedNodeId: string | null | undefined
): { nodes: N[]; edges: E[] } {
  return applyFocusHighlight(nodes, edges, focusedNodeId ? [focusedNodeId] : null);
}

/**
 * Generalisierte Fokus-Hervorhebung für einen oder mehrere Seed-Nodes
 * (Selektion oder Hover). Alle Kanten, die einen Seed-Node berühren, bleiben
 * aktiv; alles andere wird gedimmt. Pure Darstellung ohne Store-Mutation.
 */
export function applyFocusHighlight<N extends FocusableNode, E extends FocusableEdge>(
  nodes: N[],
  edges: E[],
  seedNodeIds: string[] | null | undefined
): { nodes: N[]; edges: E[] } {
  if (!seedNodeIds || seedNodeIds.length === 0) return { nodes, edges };

  const seeds = new Set<string>(seedNodeIds);
  const keep = new Set<string>(seeds);
  for (const edge of edges) {
    if (seeds.has(edge.source) || seeds.has(edge.target)) {
      keep.add(edge.source);
      keep.add(edge.target);
    }
  }

  return {
    nodes: nodes.map((node) => withFlag(node, keep.has(node.id) ? ACTIVE : DIM)),
    edges: edges.map((edge) =>
      withFlag(edge, seeds.has(edge.source) || seeds.has(edge.target) ? ACTIVE : DIM)
    ),
  };
}

/* ------------------------------------------------------------------------- *
 * UI-AUDIT 2026-10-13 — Befund UX-FOCUS-001: Fokus auf die echte Trasse
 * ------------------------------------------------------------------------- */

/** Achsenparalleles Rechteck in Flow-Koordinaten. */
export interface FocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Kamera-Ziel: Mittelpunkt in Flow-Koordinaten plus Zoomstufe. */
export interface EdgeFocusTarget {
  x: number;
  y: number;
  zoom: number;
}

/** Sichtfläche, wenn sie nicht gemessen werden konnte (SSR, Tests, Fehler). */
export const NOMINAL_FOCUS_VIEWPORT = { width: 1024, height: 640 } as const;

/** Anteil der Sichtfläche, den die Trasse nach dem Fokussieren einnimmt. */
const FOCUS_FILL_RATIO = 0.6;

const centerOf = (rect: FocusRect): { x: number; y: number } => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/**
 * Kamera-Ziel für eine Leitung.
 *
 * **Vorher** stand in `FlowCanvas.handleFocusElement` der Mittelpunkt der
 * beiden Bauteile plus fester Offsets `+100/+60`. Zwei messbare Folgen:
 *
 *   1. Eine orthogonal verlegte Leitung mit weitem Umweg wurde „fokussiert",
 *      ohne dass die Regelverletzung im Bild war — der Mittelpunkt der
 *      Bauteile liegt bei einer U-Trasse mitten im leeren Bereich.
 *   2. Die Offsets waren Magic Numbers, die weder zu den Bauteilmaßen noch zu
 *      einer Routing-Größe gehören (AGENTS.md: keine verstreuten Zahlen).
 *
 * **Jetzt** ist die veröffentlichte Trasse die Quelle — dieselbe Geometrie,
 * die `CableEdge` zeichnet (ADR 0014: eine Quelle für Kabelgeometrie). Ist
 * keine Trasse veröffentlicht, gilt der frühere Bauteil-Mittelpunkt als
 * ausdrücklicher, benannter Fallback statt einer stillen Näherung.
 *
 * Reine Funktion: keine DOM-, keine Store-Zugriffe, damit der Fall direkt
 * testbar ist.
 */
export function edgeFocusTarget(input: {
  /** Wegpunkte der veröffentlichten Trasse (Flow-Koordinaten). */
  waypoints: readonly { x: number; y: number }[] | undefined;
  /** Rechtecke der beiden Bauteile — Fallback ohne veröffentlichte Trasse. */
  source: FocusRect;
  target: FocusRect;
  /** Gemessene Sichtfläche; fehlt sie, gilt `NOMINAL_FOCUS_VIEWPORT`. */
  viewport?: { width: number; height: number } | undefined;
  /** Zoom-Obergrenze (Detailansicht) — Default 1.15 wie zuvor. */
  maxZoom?: number;
  /** Zoom-Untergrenze — Default `PLANNER_MIN_ZOOM` des Aufrufers. */
  minZoom?: number;
}): EdgeFocusTarget {
  const maxZoom = input.maxZoom ?? 1.15;
  const minZoom = input.minZoom ?? 0.1;
  const viewportWidth =
    input.viewport && Number.isFinite(input.viewport.width) && input.viewport.width > 0
      ? input.viewport.width
      : NOMINAL_FOCUS_VIEWPORT.width;
  const viewportHeight =
    input.viewport && Number.isFinite(input.viewport.height) && input.viewport.height > 0
      ? input.viewport.height
      : NOMINAL_FOCUS_VIEWPORT.height;

  const points = input.waypoints ?? [];
  if (points.length === 0) {
    // Benannter Fallback: Mitte zwischen den Bauteil-Mittelpunkten.
    const a = centerOf(input.source);
    const b = centerOf(input.target);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: maxZoom };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    const a = centerOf(input.source);
    const b = centerOf(input.target);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: maxZoom };
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  // Ein Punkt (oder eine rein horizontale/vertikale Trasse) hat keine
  // Ausdehnung; ein Mindestmaß verhindert eine Division durch null und hält
  // den Zoom auf der Obergrenze.
  const span = Math.max(width, height, 1);
  const zoom = Math.min(
    maxZoom,
    Math.max(minZoom, (Math.min(viewportWidth, viewportHeight) * FOCUS_FILL_RATIO) / span)
  );

  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
}
