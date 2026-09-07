import { generateElkInteractiveOptions, generateElkLayoutOptions, type RoutingTokens } from '../tokens';
import type { Point } from '../geometry';

/**
 * WP-4 (#393): ELK-Graph-Aufbau und -Auswertung — pure Functions.
 *
 * Eingabe ist bewusst PLAIN DATA (kein React-Flow-Typ, ADR 0008): der Graph
 * muss den Worker-Vertrag (P-6) erfüllen — strukturiert klonbar, keine
 * Funktionen, keine Klasseninstanzen. `elkGraphIsCloneable` prüft das im Test.
 *
 * Alle Geometrie-Optionen kommen aus dem Token-Generator (WP-1) —
 * hier wird KEINE Option von Hand gepflegt.
 */

/** Anschluss (Handle) eines Knotens — Reihenfolge ist Teil des Vertrags. */
export type ElkPlanPort = {
  id: string;
  /** Seite der Node-Karte. */
  side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
  /**
   * Stabiler Ordnungsindex je Seite (FIXED_ORDER): Plus oben (0),
   * Minus unten (1), weitere danach.
   */
  index: number;
};

export type ElkPlanNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ports?: ElkPlanPort[];
};

export type ElkPlanEdge = {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  /** Sichtbarer Label-Text (ELK reserviert Platz, zentriert). */
  label?: string;
};

export type ElkPlan = {
  nodes: ElkPlanNode[];
  edges: ElkPlanEdge[];
  /** Nutzerplatzierungen respektieren (Spec §6.2)? */
  interactive?: boolean;
  /** Layout-Richtung; ohne Angabe bleibt ELKs Vorgabe bestehen. */
  direction?: 'LR' | 'TB';
};

/** Minimale strukturelle Sicht auf den elkjs-Graphen (kein Typ-Import nötig). */
export type ElkGraph = {
  id: string;
  layoutOptions: Record<string, string>;
  children: Array<{
    id: string;
    x?: number;
    y?: number;
    width: number;
    height: number;
    layoutOptions?: Record<string, string>;
    ports?: Array<{
      id: string;
      layoutOptions: Record<string, string>;
    }>;
  }>;
  edges: Array<{
    id: string;
    sources: string[];
    targets: string[];
    labels?: Array<{ text: string; width: number; height: number }>;
    sections?: Array<{
      startPoint: Point;
      endPoint: Point;
      bendPoints?: Point[];
    }>;
    junctionPoints?: Point[];
  }>;
};

/** Label-Boxmaße — identisch zur Kollisionsprüfung in pathUtils (M8-3). */
const LABEL_WIDTH = 88;
const LABEL_HEIGHT = 20;

/** Baut den elkjs-Eingabegraphen; Optionen ausschließlich aus den Tokens. */
export function buildElkGraph(plan: ElkPlan, tokens?: RoutingTokens): ElkGraph {
  const layoutOptions = plan.interactive
    ? generateElkInteractiveOptions(tokens, plan.direction)
    : generateElkLayoutOptions(tokens, plan.direction);
  return {
    id: 'root',
    layoutOptions,
    children: plan.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      ...(node.ports && node.ports.length > 0
        ? {
            layoutOptions: { 'elk.portConstraints': 'FIXED_ORDER' },
            ports: node.ports.map((port) => ({
              id: port.id,
              layoutOptions: {
                'elk.port.side': port.side,
                'elk.port.index': String(port.index),
              },
            })),
          }
        : {}),
    })),
    edges: plan.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourcePort ?? edge.source],
      targets: [edge.targetPort ?? edge.target],
      ...(edge.label ? { labels: [{ text: edge.label, width: LABEL_WIDTH, height: LABEL_HEIGHT }] } : {}),
    })),
  };
}

export type ElkLayoutResult = {
  /** Absolute Node-Positionen. */
  nodes: Map<string, { x: number; y: number }>;
  /** Absolute orthogonale Wegpunkte je Kante. */
  routes: Map<string, Point[]>;
  /** Junction Points (Busbar-Abzweige) je Kante, absolut. */
  junctions: Map<string, Point[]>;
};

/**
 * Wertet das elkjs-Ergebnis aus. elkjs liefert Child-Positionen und
 * Edge-Sections RELATIV zum Parent (hier: root) — `origin` verschiebt
 * alles in absolute Canvas-Koordinaten (Spec §6.3).
 */
export function parseElkResult(graph: ElkGraph, origin: Point = { x: 0, y: 0 }): ElkLayoutResult {
  const nodes = new Map<string, { x: number; y: number }>();
  for (const child of graph.children) {
    nodes.set(child.id, { x: (child.x ?? 0) + origin.x, y: (child.y ?? 0) + origin.y });
  }
  const routes = new Map<string, Point[]>();
  const junctions = new Map<string, Point[]>();
  for (const edge of graph.edges) {
    const points: Point[] = [];
    for (const section of edge.sections ?? []) {
      const sectionPoints = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
      for (const p of sectionPoints) {
        const abs = { x: p.x + origin.x, y: p.y + origin.y };
        const last = points[points.length - 1];
        if (!last || last.x !== abs.x || last.y !== abs.y) points.push(abs);
      }
    }
    routes.set(edge.id, points);
    junctions.set(
      edge.id,
      (edge.junctionPoints ?? []).map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }))
    );
  }
  return { nodes, routes, junctions };
}

/**
 * Worker-Vertrag (P-6): der Graph muss die Structured-Clone-Grenze
 * verlustfrei passieren (keine Funktionen/Instanzen/zyklische Referenzen).
 */
export function elkGraphIsCloneable(graph: ElkGraph): boolean {
  try {
    const cloned: unknown =
      typeof structuredClone === 'function'
        ? structuredClone(graph)
        : (JSON.parse(JSON.stringify(graph)) as unknown);
    return JSON.stringify(cloned) === JSON.stringify(graph);
  } catch {
    return false;
  }
}
