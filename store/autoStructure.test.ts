import { beforeEach, describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { usePlannerStore } from './usePlannerStore';
import { TEMPLATE_AUTARK } from '../components/planner/templates';
import type { CableEdgeData } from '../components/edges/CableEdge';

/**
 * Wunsch 2026-09-28: „Automatisch verbinden" strukturiert den Plan nach ELK.
 *
 * Vertrag dieses Schritts (siehe `structureAutoWiring` in graphSlice.ts):
 *
 * 1. `autoWireSystem` fordert die Struktur nur AN (`autoStructurePending`) —
 *    den Lauf startet der Canvas, sobald alle Kartenboxen gemessen sind
 *    (ungemessene Knoten ⇒ ELK rechnet mit 120 × 80 und legt Karten
 *    übereinander, gemessen: I1 = 49).
 * 2. Der Lauf schreibt Positionen und räumt das Flag ab.
 * 3. Er legt KEINEN eigenen Undo-Schritt an: `historyPast` trägt schon den
 *    Stand vor dem Verbinden — ein Undo nimmt Verbinden UND Strukturieren
 *    zusammen zurück.
 */

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const templateNodes = () => clone(TEMPLATE_AUTARK.nodes) as Node[];
const templateEdges = () => clone(TEMPLATE_AUTARK.edges) as Edge<CableEdgeData>[];

beforeEach(() => {
  usePlannerStore.setState({
    viewMode: 'electric',
    nodes: templateNodes(),
    edges: templateEdges(),
    waterNodes: [],
    waterEdges: [],
    selectedNodes: [],
    selectedEdges: [],
    historyPast: [],
    historyFuture: [],
    canUndo: false,
    canRedo: false,
    autoStructurePending: false,
    isLayoutPending: false,
  });
});

describe('Auto-Wire → ELK-Strukturierung', () => {
  it('fordert nach dem Verbinden eine Struktur an', () => {
    usePlannerStore.getState().autoWireSystem();

    const state = usePlannerStore.getState();
    expect(state.autoStructurePending).toBe(true);
    // Verbinden selbst bleibt der eine Undo-Schritt dieser Aktion.
    expect(state.historyPast.length).toBe(1);
  });

  it('strukturiert ohne Anforderung nichts', async () => {
    const before = usePlannerStore.getState().nodes;

    await usePlannerStore.getState().structureAutoWiring();

    const state = usePlannerStore.getState();
    expect(state.nodes).toBe(before);
    expect(state.autoStructurePending).toBe(false);
  });

  it('ordnet den verbundenen Plan per ELK — ohne zweiten Undo-Schritt', async () => {
    usePlannerStore.getState().autoWireSystem();
    const wired = usePlannerStore.getState();
    const historyAfterWiring = wired.historyPast.length;
    const positionsBefore = new Map(wired.nodes.map((node) => [node.id, { ...node.position }]));

    await usePlannerStore.getState().structureAutoWiring();

    const after = usePlannerStore.getState();
    expect(after.autoStructurePending).toBe(false);
    expect(after.isLayoutPending).toBe(false);
    // Kein zweiter History-Schritt (siehe Vertrag oben).
    expect(after.historyPast.length).toBe(historyAfterWiring);
    // Beide Domänen-Arrays bleiben konsistent (Kanten unverändert).
    expect(after.edges.length).toBe(wired.edges.length);
    // ELK hat den Plan strukturiert: mindestens ein Knoten liegt anders.
    const moved = after.nodes.filter((node) => {
      const before = positionsBefore.get(node.id);
      return !before || before.x !== node.position.x || before.y !== node.position.y;
    });
    expect(moved.length).toBeGreaterThan(0);
    // Ein Undo führt auf den Stand VOR dem Verbinden (14 Vorlagen-Knoten).
    usePlannerStore.getState().undo();
    expect(usePlannerStore.getState().nodes.length).toBe(templateNodes().length);
    expect(usePlannerStore.getState().autoStructurePending).toBe(false);
  }, 30_000);

  it('verwirft die offene Struktur, wenn der Nutzer zurückgeht', () => {
    usePlannerStore.getState().autoWireSystem();
    expect(usePlannerStore.getState().autoStructurePending).toBe(true);

    usePlannerStore.getState().undo();

    expect(usePlannerStore.getState().autoStructurePending).toBe(false);
  });
});
