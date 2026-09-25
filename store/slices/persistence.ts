import { sanitizeNodeDataBySchema } from '../../lib/nodeSchema'; // DOM-003
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

/**
 * S5 (AUDIT): `__proto__`, `constructor` und `prototype` sind aus
 * persistierten Ständen zu entfernen, bevor sie in Zustands-Objekte gemerged
 * werden. `JSON.parse` legt `__proto__` als eigenes Datenfeld an — solange nur
 * gespreadet wird, ist das harmlos; sobald irgendwo `Object.assign` oder eine
 * Merge-Bibliothek ins Spiel kommt, wird daraus eine echte Prototyp-
 * verseuchung (jeder neue `{}` erbt dann Attacker-Felder).
 *
 * Die Kopie wird deshalb mit `Object.defineProperty` aufgebaut: eine Zuweisung
 * `out['__proto__'] = …` würde den Setter auslösen (genau der Angriff), ein
 * Datenfeld ist ungefährlich. Tiefenlimit 8 genügt für echte Plan-Daten
 * (Knoten → data → Punkte → Punkt) und beendet Zyklen.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function stripDangerousKeys<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => stripDangerousKeys(entry, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    Object.defineProperty(out, key, {
      value: stripDangerousKeys(entry, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out as T;
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
  if (typeof p.guidedMode === 'boolean') safe.guidedMode = p.guidedMode;
  if (p.detailLevel === 'overview' || p.detailLevel === 'detail') safe.detailLevel = p.detailLevel;
  if (Array.isArray(p.nodes)) safe.nodes = p.nodes.filter(isNodeShape).map(sanitizeNodeData);
  if (Array.isArray(p.edges))
    safe.edges = p.edges.filter(isEdgeShape).map(sanitizeEdgeData) as Edge<CableEdgeData>[];
  if (Array.isArray(p.waterNodes)) safe.waterNodes = p.waterNodes.filter(isNodeShape).map(sanitizeNodeData);
  if (Array.isArray(p.waterEdges)) safe.waterEdges = p.waterEdges.filter(isEdgeShape).map(sanitizeEdgeData);

  // Version 0 → 1: keine Feldumbenennungen, nur Validierung.
  void version;
  // S5 (AUDIT): Erst ganz zum Schluss — danach hat kein Fremdfeld mehr die
  // Chance, über einen Merge in den Prototypen zu gelangen.
  return stripDangerousKeys(safe);
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
    guidedMode: state.guidedMode,
    detailLevel: state.detailLevel,
  }),
};
