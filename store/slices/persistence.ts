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
export const PLANNER_STORAGE_VERSION = 1;

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

/** `data`-Block neutralisieren, wenn er kein plain object ist (String/Zahl aus Altdaten). */
function sanitizeNodeData<T extends Node>(node: T): T {
  if (!node.data || typeof node.data !== 'object') return { ...node, data: {} };
  return node;
}

function sanitizeEdgeData<T extends Edge>(edge: T): T {
  if (!edge.data || typeof edge.data !== 'object') return { ...edge, data: {} } as T;
  return edge;
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
  if (Array.isArray(p.nodes)) safe.nodes = p.nodes.filter(isNodeShape).map(sanitizeNodeData);
  if (Array.isArray(p.edges))
    safe.edges = p.edges.filter(isEdgeShape).map(sanitizeEdgeData) as Edge<CableEdgeData>[];
  if (Array.isArray(p.waterNodes))
    safe.waterNodes = p.waterNodes.filter(isNodeShape).map(sanitizeNodeData);
  if (Array.isArray(p.waterEdges))
    safe.waterEdges = p.waterEdges.filter(isEdgeShape).map(sanitizeEdgeData);

  // Version 0 → 1: keine Feldumbenennungen, nur Validierung.
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
