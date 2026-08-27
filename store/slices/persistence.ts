import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';
import { plannerDebouncedStorage } from '../storage';
import { CableEdgeData } from '../../components/edges/CableEdge';
import type { PlannerState } from './types';

/**
 * Persistenz des Planner-Stores (M6-5 Slice; Historie: K1/Härtung aus #316).
 *
 * Alles, was localStorage-Formate versteht — Version, Migration, partialize —
 * lebt hier und NICHT im Store-Body. Der Speichername ist Teil des Contracts
 * mit bestehenden Planungen und darf nicht ohne Versionsschritt ändern.
 */
export const PLANNER_STORAGE_VERSION = 1;

function isNodeArray(value: unknown): value is Node[] {
  return (
    Array.isArray(value) && value.every((n) => n && typeof n === 'object' && 'id' in n && 'position' in n)
  );
}

function isEdgeArray(value: unknown): value is Edge[] {
  return (
    Array.isArray(value) &&
    value.every((e) => e && typeof e === 'object' && 'id' in e && 'source' in e && 'target' in e)
  );
}

/**
 * Defensive Migration für den Planner-Store. Alte localStorage-Stände können
 * Felder in anderem Shape oder teilkorrupte Knoten/Kanten enthalten. Diese
 * Funktion normalisiert, bevor Zustand den Stand merged — so lösen veraltete
 * Stände keine Laufzeitfehler in Berechnungen aus.
 */
export function migratePlannerPersisted(persisted: unknown, version: number): Partial<PlannerState> {
  const p = (persisted ?? {}) as Partial<PlannerState>;
  const safe: Partial<PlannerState> = {};

  if (p.viewMode === 'electric' || p.viewMode === 'water') safe.viewMode = p.viewMode;
  if (p.season === 'summer' || p.season === 'winter') safe.season = p.season;
  if (typeof p.isSidebarOpen === 'boolean') safe.isSidebarOpen = p.isSidebarOpen;
  if (typeof p.isInspectorOpen === 'boolean') safe.isInspectorOpen = p.isInspectorOpen;
  if (typeof p.backboneGrouping === 'boolean') safe.backboneGrouping = p.backboneGrouping;
  if (isNodeArray(p.nodes)) safe.nodes = p.nodes;
  if (isEdgeArray(p.edges)) safe.edges = p.edges as Edge<CableEdgeData>[];
  if (isNodeArray(p.waterNodes)) safe.waterNodes = p.waterNodes;
  if (isEdgeArray(p.waterEdges)) safe.waterEdges = p.waterEdges;

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
