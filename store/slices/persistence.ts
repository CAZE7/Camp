import { sanitizeNodeDataBySchema } from '../../lib/nodeSchema'; // DOM-003
import { LAYOUT_TOKENS } from '../../lib/planner/layout-engine/tokens';
import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { type Node, type Edge } from '@xyflow/react';
import { plannerDebouncedStorage } from '../storage';
import { type CableEdgeData } from '../../components/edges/CableEdge';
import type { PlannerState } from './types';

/**
 * Persistenz des Planner-Stores (M6-5 Slice; Historie: K1/Härtung aus #316).
 *
 * Alles, was localStorage-Formate versteht — Version, Migration, partialize —
 * lebt hier und NICHT im Store-Body. Der Speichername ist Teil des Contracts
 * mit bestehenden Planungen und darf nicht ohne Versionsschritt ändern.
 */
export const PLANNER_STORAGE_VERSION = 2;

/**
 * AUDIT PERSIST-001: Form-Prüfung mit echten Typchecks statt reiner
 * Schlüssel-Existenz. Vorher passierten `{ id, position: null }` oder
 * `{ id, source: 5, target: null }` die Migration — position null erzeugt
 * NaN-Geometrie im Rendering, nicht-stringliche Enden crashen die
 * Graphlogik. „Retten statt Verwerfen" bleibt: nur nachweisbar unbrauchbare
 * Elemente fliegen, kaputte `data` werden zu `{}` neutralisiert.
 */
function isNodeShape(value: unknown): value is Node {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id === '') return false;
  const pos = v.position;
  if (
    !pos ||
    typeof pos !== 'object' ||
    typeof (pos as Record<string, unknown>).x !== 'number' ||
    typeof (pos as Record<string, unknown>).y !== 'number' ||
    !Number.isFinite((pos as Record<string, unknown>).x as number) ||
    !Number.isFinite((pos as Record<string, unknown>).y as number)
  ) {
    return false;
  }
  if (v.data !== undefined && (typeof v.data !== 'object' || v.data === null)) return false;
  return true;
}

function isEdgeShape(value: unknown): value is Edge {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id === '') return false;
  if (typeof v.source !== 'string' || typeof v.target !== 'string') return false;
  if (v.source === '' || v.target === '') return false;
  if (v.data !== undefined && (typeof v.data !== 'object' || v.data === null)) return false;
  return true;
}

/**
 * `data`-Block neutralisieren, wenn er kein plain object ist (String/Zahl aus Altdaten).
 *
 * AUDIT DOM-003: Anschließend deklaratives Feld-Schema (lib/nodeSchema.ts) —
 * bekannte Felder mit falschem Laufzeit-Typ (watts: 'viel', hasRcd: 'ja', …)
 * werden ENTFERNT, statt still in Berechnungen zu laufen. Unbekannte Felder
 * bleiben erhalten (Forward-Kompatibilität).
 */
function sanitizeNodeData<T extends Node>(node: T): T {
  if (!node.data || typeof node.data !== 'object') return { ...node, data: {} };
  const { data } = sanitizeNodeDataBySchema(node.type, node.data as Record<string, unknown>);
  return { ...node, data: data as T['data'] };
}

function sanitizeEdgeData<T extends Edge>(edge: T): T {
  if (!edge.data || typeof edge.data !== 'object') return { ...edge, data: {} } as T;
  return edge;
}

/**
 * Version 1 → 2: Layout-Fallback-Maße entfernen.
 *
 * Der Layout-Adapter schrieb vor dem Positions-only-Fix die Engine-Boxen als
 * `width`/`height` auf die Knoten zurück — bei unvermessenen Knoten exakt die
 * 120×80-Fallbacks (`LAYOUT_TOKENS`). Diese Maße persistierten mit und hielten
 * alte Pläne dauerhaft im „ELK winzig“-Zustand. Echte Karten sind größer
 * (192×120+) oder vom Nutzer resiziert (Dach-Planer, eigene Maße); exakt das
 * Fallback-Paar kann daher nur aus dem alten Adapter stammen und wird
 * ersatzlos gestrichen — React Flow misst die Karten danach neu.
 */
function stripLayoutFallbackSize<T extends Node>(stored: T): T {
  // `stored`, nicht `node`: Persistierte Knoten tragen die flache Form
  // legitim (handleGeometry-Vertrag) — und hier sind AUSDRÜCKLICH die
  // gesetzten Maße gemeint, nicht die gemessenen.
  if (stored.width === LAYOUT_TOKENS.defaultNodeWidth && stored.height === LAYOUT_TOKENS.defaultNodeHeight) {
    const { width: _width, height: _height, ...rest } = stored;
    void _width;
    void _height;
    return rest as T;
  }
  return stored;
}

/**
 * Defensive Migration für den Planner-Store. Alte localStorage-Stände können
 * Felder in anderem Shape oder teilkorrupte Knoten/Kanten enthalten. Diese
 * Funktion normalisiert, bevor Zustand den Stand merged — so lösen veraltete
 * Stände keine Laufzeitfehler in Berechnungen aus.
 *
 * Semantik: RETTEN statt VERWERFEN. Ein einzelnes korruptes Element darf
 * nicht den ganzen Plan kosten — darum wird pro Element gefiltert, nicht
 * das ganze Array verworfen (Vertragstest: slices/persistence.test.ts).
 */
export function migratePlannerPersisted(persisted: unknown, version: number): Partial<PlannerState> {
  const p = (persisted ?? {}) as Partial<PlannerState>;
  const safe: Partial<PlannerState> = {};

  if (p.viewMode === 'electric' || p.viewMode === 'water') safe.viewMode = p.viewMode;
  if (p.season === 'summer' || p.season === 'winter') safe.season = p.season;
  if (typeof p.isSidebarOpen === 'boolean') safe.isSidebarOpen = p.isSidebarOpen;
  if (typeof p.isInspectorOpen === 'boolean') safe.isInspectorOpen = p.isInspectorOpen;
  if (typeof p.backboneGrouping === 'boolean') safe.backboneGrouping = p.backboneGrouping;
  if (Array.isArray(p.nodes))
    safe.nodes = p.nodes.filter(isNodeShape).map(sanitizeNodeData).map(stripLayoutFallbackSize);
  if (Array.isArray(p.edges))
    safe.edges = p.edges.filter(isEdgeShape).map(sanitizeEdgeData) as Edge<CableEdgeData>[];
  if (Array.isArray(p.waterNodes))
    safe.waterNodes = p.waterNodes.filter(isNodeShape).map(sanitizeNodeData).map(stripLayoutFallbackSize);
  if (Array.isArray(p.waterEdges)) safe.waterEdges = p.waterEdges.filter(isEdgeShape).map(sanitizeEdgeData);

  // Version 0 → 1: keine Feldumbenennungen, nur Validierung.
  // Version 1 → 2: Layout-Fallback-Maße (exakt 120×80) von Knoten streichen.
  void version;
  return safe;
}

export const persistOptions: PersistOptions<PlannerState, Partial<PlannerState>> = {
  name: 'werft-planner-v1',
  version: PLANNER_STORAGE_VERSION,
  storage: createJSONStorage(() => plannerDebouncedStorage),
  migrate: (persisted, version) => migratePlannerPersisted(persisted, version) as PlannerState,
  partialize: (state) => ({
    viewMode: state.viewMode,
    season: state.season,
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
    isSidebarOpen: state.isSidebarOpen,
    isInspectorOpen: state.isInspectorOpen,
    backboneGrouping: state.backboneGrouping,
  }),
};
