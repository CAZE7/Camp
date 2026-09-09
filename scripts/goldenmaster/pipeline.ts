import type { Node, Edge } from '@xyflow/react';
import { performAutoWiring } from '../../lib/autoWire';
import { getSystemVoltage, calculateEdgeCurrent } from '../../lib/vde-standards';
import { relevantCumulativeDrop } from '../../lib/autoWire/sizing';
import type { CableEdge } from '../../lib/autoWire/primitives';
import { routePlan, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import type { GoldenPlanInput } from './plans';

/**
 * WP-0b (#402): Golden-Master-Pipeline.
 *
 * Führt für einen Eingabeplan exakt die Kette des heutigen Systems aus —
 *
 *   Input → AutoWire-Result → Electrical-Result → Routing-Result
 *
 * — und liefert ein deterministisches, JSON-serialisierbares Abbild jeder
 * Stufe. V2 darf intern völlig anders arbeiten, aber dieses Abbild muss
 * identisch bleiben oder **bewusst besser** werden (mit Begründung im PR und
 * im Change Ledger `docs/ARCHITECTURE-CHANGES.md`).
 *
 * Determinismus: Die einzige Zufallsquelle der Pipeline sind die IDs
 * automatisch erzeugter Knoten (`newEntityId()`); sie werden hier auf stabile
 * Namen (`auto:<index>:<label-slug>`) normalisiert, in Erzeugungsreihenfolge.
 * Auto-Kanten-IDs (`e-auto-<n>`) sind bereits deterministisch.
 */

export type GoldenNode = {
  id: string;
  type: string | undefined;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type GoldenEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  data: Record<string, unknown>;
};

export type GoldenElectrical = {
  systemVoltage: number;
  /** pro Kante: berechneter Strom (A), 2 Nachkommastellen */
  edgeCurrents: Record<string, number>;
  /** pro Knoten: relevanter kumulierter Spannungsfall (V), 3 Nachkommastellen */
  cumulativeDrops: Record<string, number>;
};

export type GoldenRoute = {
  waypoints: { x: number; y: number }[];
  length: number;
  bends: number;
  crossings: number;
  usedSearch: 'catalog' | 'astar' | 'fallback';
};

export type GoldenMaster = {
  /** Format-Version des Fixtures — bei Strukturänderung erhöhen + Ledger-Eintrag. */
  fixtureVersion: 1;
  input: { nodes: GoldenNode[]; edges: GoldenEdge[] };
  autoWire: { nodes: GoldenNode[]; edges: GoldenEdge[] };
  electrical: GoldenElectrical;
  routing: Record<string, GoldenRoute>;
};

const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

const slug = (value: unknown): string =>
  String(value ?? 'node')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Ersetzt zufällige IDs auto-erzeugter Knoten durch stabile Namen. */
function normalizeAutoIds(
  inputNodeIds: Set<string>,
  nodes: Node[],
  edges: CableEdge[]
): { nodes: Node[]; edges: CableEdge[] } {
  const remap = new Map<string, string>();
  let index = 0;
  for (const node of nodes) {
    if (!inputNodeIds.has(node.id)) {
      remap.set(node.id, `auto:${index++}:${slug(node.data?.label ?? node.type)}`);
    }
  }
  if (remap.size === 0) return { nodes, edges };
  const mapId = (id: string): string => remap.get(id) ?? id;
  return {
    nodes: nodes.map((n) => (remap.has(n.id) ? { ...n, id: mapId(n.id) } : n)),
    edges: edges.map((e) => ({ ...e, source: mapId(e.source), target: mapId(e.target) })),
  };
}

const toGoldenNode = (n: Node): GoldenNode => ({
  id: n.id,
  type: n.type,
  position: { x: round(n.position.x, 2), y: round(n.position.y, 2) },
  data: (n.data ?? {}) as Record<string, unknown>,
});

const toGoldenEdge = (e: Edge | CableEdge): GoldenEdge => ({
  id: e.id,
  source: e.source,
  target: e.target,
  sourceHandle: e.sourceHandle ?? null,
  targetHandle: e.targetHandle ?? null,
  data: (e.data ?? {}) as Record<string, unknown>,
});

const byId = <T extends { id: string }>(arr: T[]): T[] => [...arr].sort((a, b) => a.id.localeCompare(b.id));

/** Führt die volle Alt-System-Pipeline aus und friert jede Stufe ein. */
export function captureGoldenMaster(input: GoldenPlanInput): GoldenMaster {
  // Stufe 1: AutoWire (arbeitet auf Kopien; Rückgabe sind neue Arrays)
  const wired = performAutoWiring(input.nodes, input.edges as CableEdge[]);
  if (!wired) {
    throw new Error('performAutoWiring lieferte null — Plan ohne Batterie?');
  }
  const inputIds = new Set(input.nodes.map((n) => n.id));
  const { nodes, edges } = normalizeAutoIds(inputIds, wired.nodes, wired.edges);

  // Stufe 2: Electrical (Systemspannung, Kantenströme, Spannungsfälle)
  const sysVoltage = getSystemVoltage(nodes);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeCurrents: Record<string, number> = {};
  for (const e of byId(edges)) {
    edgeCurrents[e.id] = round(
      calculateEdgeCurrent(nodeMap.get(e.source), nodeMap.get(e.target), nodes, sysVoltage, edges), // ELE-005
      2
    );
  }
  const cumulativeDrops: Record<string, number> = {};
  for (const n of byId(nodes)) {
    cumulativeDrops[n.id] = round(relevantCumulativeDrop(n.id, nodeMap, edges, nodes, sysVoltage), 3);
  }

  // Stufe 3: Routing (globaler Pass des Ist-Systems, ohne gemessene Handles —
  // resolveHandlePoint fällt deterministisch auf die Flussrichtungs-Seite zurück)
  const routes = routePlan(nodes, edges as RouteEdgeRef[]).routes;
  const routing: Record<string, GoldenRoute> = {};
  for (const e of byId(edges)) {
    const r = routes.get(e.id);
    if (!r) continue;
    routing[e.id] = {
      waypoints: r.waypoints.map((p) => ({ x: round(p.x, 2), y: round(p.y, 2) })),
      length: round(r.length, 2),
      bends: r.bends,
      crossings: r.crossings,
      usedSearch: r.usedSearch,
    };
  }

  return {
    fixtureVersion: 1,
    input: {
      nodes: byId(input.nodes.map(toGoldenNode)),
      edges: byId(input.edges.map(toGoldenEdge)),
    },
    autoWire: {
      nodes: byId(nodes.map(toGoldenNode)),
      edges: byId(edges.map(toGoldenEdge)),
    },
    electrical: { systemVoltage: sysVoltage, edgeCurrents, cumulativeDrops },
    routing,
  };
}

/** JSON mit sortierten Schlüsseln — byte-stabil über Läufe und Node-Versionen. */
export function stableStringify(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        out[key] = sortKeys((v as Record<string, unknown>)[key]);
      }
      return out;
    }
    return v;
  };
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
