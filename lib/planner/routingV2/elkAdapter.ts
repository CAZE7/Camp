/**
 * lib/planner/routingV2/elkAdapter.ts
 *
 * ELK-Adapter — das geplante Layout-/Routing-Backend von Routing V2.
 *
 * Problem (vorher):
 * ---------------
 * Das Layout lief direkt über `dagre` in `lib/planner/layout.ts`. ELK
 * (Eclipse Layout Kernel) war als leistungsfähigere, orthogonalere Engine
 * geplant, fehlte aber vollständig (kein ELK/elkjs in package.json).
 *
 * Dieser Adapter kapselt ELK hinter einer sauberen `LayoutEngine`-Schnittstelle:
 *   - `ElkLayoutEngine`  → echtes ELK (elkjs), lazy geladen (SSR-sicher)
 *   - `DagreLayoutEngine`→ Fallback, falls ELK nicht verfügbar ist
 *
 * Damit ist die Laufzeit nie von ELK abhängig: Wenn ELK fehlt oder scheitert,
 * wird ohne Abbruch auf dagre zurückgefallen.
 */

import dagre from 'dagre';
import type { PlannerEdge, PlannerNode } from '../domain';
import { GEOMETRY, roundToLaneGrid } from '../geometry';

/** Ein Knoten-Eingabe für das Layout. */
export type LayoutNode = {
  id: string;
  width: number;
  height: number;
};

/** Eine Kante-Eingabe für das Layout. */
export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
};

/** Ergebnis des Layouts: Position je Knoten (bereits auf das Raster gerundet). */
export type LayoutResult = {
  positions: Map<string, { x: number; y: number }>;
};

/** Gemeinsame Schnittstelle aller Layout-Engines von Routing V2. */
export interface LayoutEngine {
  readonly name: string;
  layout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options?: { direction?: 'LR' | 'TB' }
  ): Promise<LayoutResult>;
}

/** Bequemer Konverter von Planner-Knoten auf Layout-Knoten. */
export function toLayoutNodes(nodes: PlannerNode[]): LayoutNode[] {
  return nodes.map((n) => ({
    id: n.id,
    width: n.width ?? 200,
    height: n.height ?? 100,
  }));
}

/** Bequemer Konverter von Planner-Kanten auf Layout-Kanten. */
export function toLayoutEdges(edges: PlannerEdge[]): LayoutEdge[] {
  return edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
}

/** Rungegeht ein Layout-Ergebnis auf das Grundraster. */
export function snapLayoutToGrid(result: LayoutResult): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of Array.from(result.positions.entries())) {
    positions.set(id, {
      x: roundToLaneGrid(pos.x, GEOMETRY.laneGrid * 2),
      y: roundToLaneGrid(pos.y, GEOMETRY.laneGrid * 2),
    });
  }
  return { positions };
}

/**
 * ELK-Layout-Engine (elkjs).
 *
 * Wird lazy geladen, damit eine fehlende oder SSR-blockierte ELK-Instanz das
 * Bundling bzw. die Server-Renderung der App nicht bricht.
 */
export class ElkLayoutEngine implements LayoutEngine {
  readonly name = 'elk';
  private elkPromise: Promise<unknown> | null = null;

  async getElk(): Promise<unknown> {
    if (!this.elkPromise) {
      // Lazy: nur beim ersten echten Aufruf laden, nie top-level.
      this.elkPromise = import('elkjs/lib/elk.bundled.js').then((m: any) => m.default ?? m);
    }
    return this.elkPromise;
  }

  async layout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: { direction?: 'LR' | 'TB' } = {}
  ): Promise<LayoutResult> {
    const Elk = await this.getElk() as any;
    const elk = new Elk();

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': options.direction ?? 'RIGHT',
        'nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.spacing.nodeNode': String(GEOMETRY.bendRadius * 4),
        'elk.spacing.edgeNode': String(GEOMETRY.cableClearance * 2),
      },
      children: nodes.map((n) => ({
        id: n.id,
        width: n.width,
        height: n.height,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    } as any;

    const result = await elk.layout(graph);

    const positions = new Map<string, { x: number; y: number }>();
    for (const child of (result.children ?? []) as any[]) {
      if (typeof child.x !== 'number' || typeof child.y !== 'number') continue;
      positions.set(String(child.id), { x: child.x, y: child.y });
    }

    return snapLayoutToGrid({ positions });
  }
}

/**
 * Dagre-Layout-Engine als Fallback, damit Routing V2 auch ohne ELK läuft.
 */
export class DagreLayoutEngine implements LayoutEngine {
  readonly name = 'dagre';

  async layout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: { direction?: 'LR' | 'TB' } = {}
  ): Promise<LayoutResult> {
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: options.direction ?? 'LR' });

    for (const n of nodes) graph.setNode(n.id, { width: n.width, height: n.height });
    for (const e of edges) graph.setEdge(e.source, e.target);

    dagre.layout(graph);

    const positions = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      const node = graph.node(n.id);
      positions.set(n.id, {
        x: node.x - n.width / 2,
        y: node.y - n.height / 2,
      });
    }

    return snapLayoutToGrid({ positions });
  }
}

/**
 * Liefert eine Layout-Engine. ELK zuerst; bei Fehlern/Fehlen läuft sie auf
 * dagre weiter. So bleibt die App jederzeit funktionsfähig.
 */
export async function createLayoutEngine(): Promise<LayoutEngine> {
  try {
    const engine = new ElkLayoutEngine();
    // Probelauf: falls ELK nicht ladbar ist, fällt der catch unten durch.
    await engine.getElk();
    return engine;
  } catch {
    return new DagreLayoutEngine();
  }
}
