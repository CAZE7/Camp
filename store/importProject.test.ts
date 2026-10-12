/**
 * Store-Vertrag des Projekt-Imports: Der Import ersetzt den Planinhalt
 * atomar, ist über Undo rücknehmbar und bleibt bei fehlerhafter Datei ohne
 * Wirkung (die Prüfung passiert vor dem Aufruf in `parsePlannerProject`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { usePlannerStore } from './usePlannerStore';
import { parsePlannerProject, serializePlannerProject } from './projectFile';
import { TEMPLATE_MINIMALIST } from '../components/planner/templates';
import type { ImportedProjectPlan } from './slices/types';

function importedPlan(): ImportedProjectPlan {
  return {
    season: 'winter',
    nodes: [
      { id: 'battery-x', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Importierte Batterie' } },
      {
        id: 'cons-x',
        type: 'consumer',
        position: { x: 300, y: 0 },
        data: { label: 'Importierter Verbraucher', watts: 30 },
      },
    ] as ImportedProjectPlan['nodes'],
    edges: [],
    waterNodes: [],
    waterEdges: [],
  };
}

describe('importProject (Store)', () => {
  beforeEach(() => {
    act(() => {
      usePlannerStore.getState().clearPlan();
    });
    act(() => {
      usePlannerStore.getState().applyTemplate('minimalist');
    });
  });

  it('ersetzt den Planinhalt und die Jahreszeit', () => {
    expect(usePlannerStore.getState().nodes.length).toBeGreaterThan(0);
    let ok = false;
    act(() => {
      ok = usePlannerStore.getState().importProject(importedPlan());
    });
    const state = usePlannerStore.getState();
    expect(ok).toBe(true);
    expect(state.nodes.map((n) => n.id)).toEqual(['battery-x', 'cons-x']);
    expect(state.edges).toEqual([]);
    expect(state.season).toBe('winter');
  });

  it('ist über Undo vollständig zurücknehmbar', () => {
    const before = usePlannerStore.getState().nodes.map((n) => n.id);
    act(() => {
      usePlannerStore.getState().importProject(importedPlan());
    });
    act(() => {
      usePlannerStore.getState().undo();
    });
    expect(usePlannerStore.getState().nodes.map((n) => n.id)).toEqual(before);
  });

  it('eine geprüfte Datei kann exportiert und wieder importiert werden', () => {
    const text = serializePlannerProject({
      viewMode: 'electric',
      season: 'summer',
      nodes: TEMPLATE_MINIMALIST.nodes,
      edges: TEMPLATE_MINIMALIST.edges as never,
      waterNodes: [],
      waterEdges: [],
    });
    act(() => {
      usePlannerStore.getState().clearPlan();
    });
    const parsed = parsePlannerProject(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    act(() => {
      usePlannerStore.getState().importProject({
        season: parsed.plan.season,
        nodes: parsed.plan.nodes as ImportedProjectPlan['nodes'],
        edges: parsed.plan.edges as ImportedProjectPlan['edges'],
        waterNodes: parsed.plan.waterNodes as ImportedProjectPlan['waterNodes'],
        waterEdges: parsed.plan.waterEdges as ImportedProjectPlan['waterEdges'],
      });
    });
    const state = usePlannerStore.getState();
    expect(state.nodes.map((n) => n.id)).toEqual(TEMPLATE_MINIMALIST.nodes.map((n) => n.id));
    expect(state.edges.map((e) => e.id)).toEqual(TEMPLATE_MINIMALIST.edges.map((e) => e.id));
    expect(state.season).toBe('summer');
  });
});

describe('importProject — fest verdrahtete Leitungen', () => {
  it('lehnt den Import ab, solange eine fixierte Leitung im Plan liegt', () => {
    act(() => {
      usePlannerStore.getState().clearPlan();
      usePlannerStore.getState().applyTemplate('minimalist');
    });
    const firstEdge = usePlannerStore.getState().edges[0];
    expect(firstEdge).toBeDefined();
    act(() => {
      usePlannerStore.getState().setEdgeIntent(firstEdge!.id, 'locked', [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 80 },
      ]);
    });
    const before = usePlannerStore.getState().nodes.map((n) => n.id);
    let ok = true;
    act(() => {
      ok = usePlannerStore.getState().importProject(importedPlan());
    });
    expect(ok).toBe(false);
    expect(usePlannerStore.getState().nodes.map((n) => n.id)).toEqual(before);
  });
});
