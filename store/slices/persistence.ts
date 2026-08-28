import { createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { type Node, type Edge } from 'reactflow';
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

function isNodeShape(value: unknown): value is Node {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'position' in value);
}

function isEdgeShape(value: unknown): value is Edge {
  return Boolean(
    value && typeof value === 'object' && 'id' in value && 'source' in value && 'target' in value
  );
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
  if (Array.isArray(p.nodes)) safe.nodes = p.nodes.filter(isNodeShape);
  if (Array.isArray(p.edges)) safe.edges = p.edges.filter(isEdgeShape) as Edge<CableEdgeData>[];
  if (Array.isArray(p.waterNodes)) safe.waterNodes = p.waterNodes.filter(isNodeShape);
  if (Array.isArray(p.waterEdges)) safe.waterEdges = p.waterEdges.filter(isEdgeShape);

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
