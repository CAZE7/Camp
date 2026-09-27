import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { usePlannerStore } from '../usePlannerStore';

/**
 * Statische Regression (2026-09-26, „object recreation“ / „onNodesChange“):
 * `applyNodeChanges`/`applyEdgeChanges` können ein neues Array zurückgeben,
 * auch wenn keine Änderung ein Element getroffen hat. Falls React Flow etwa
 * eine `dimensions`-Änderung für einen nur präsentationsseitigen Knoten meldet,
 * könnte der Planner-Store so eine folgenlose Referenzänderung übernehmen.
 * Das würde Store-Konsumenten und identitätsgebundene Caches unnötig
 * beschäftigen. Der Test sichert ab, dass dieser No-op keinen Store-Schreib-
 * vorgang auslöst; er ist kein Browser-Beleg für die gemeldete Oszillation.
 */

const nodeA: Node = { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {} };
const nodeB: Node = { id: 'b', type: 'consumer', position: { x: 400, y: 0 }, data: {} };

const seed = () => {
  usePlannerStore.setState({
    nodes: [nodeA, nodeB],
    edges: [{ id: 'e1', source: 'a', target: 'b', data: {} }],
    waterNodes: [{ id: 'w1', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} }],
    waterEdges: [{ id: 'we1', source: 'w1', target: 'w1', data: {} }],
    historyPast: [],
    historyFuture: [],
    canUndo: false,
    canRedo: false,
    // Auswahl gehört zum Startzustand: sonst schleppt ein Test die Marke des
    // vorherigen mit (deleteSelected würde dann wirklich löschen).
    selectedNodes: [],
    selectedEdges: [],
  });
};

const graph = () => {
  const state = usePlannerStore.getState();
  return {
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
    historyLength: state.historyPast.length,
  };
};

describe('Change-Handler ohne Treffer erzeugen keinen neuen Zustand', () => {
  beforeEach(seed);

  it('dimensions für eine unbekannte ID (Darstellungs-Rahmen) lässt alles unverändert', () => {
    const before = graph();
    const idsBefore = {
      nodes: before.nodes,
      edges: before.edges,
      waterNodes: before.waterNodes,
      waterEdges: before.waterEdges,
    };

    // Genau die Meldung, die React Flow für den Rahmen des Hauptstromkreises
    // absetzt: der Knoten existiert nur im Rendering, nicht im Store.
    usePlannerStore.getState().onNodesChange([
      {
        type: 'dimensions',
        id: '__planner-backbone-group',
        dimensions: { width: 844, height: 392 },
        setAttributes: true,
      },
    ]);

    const after = graph();
    expect(after.nodes).toBe(idsBefore.nodes);
    expect(after.edges).toBe(idsBefore.edges);
    expect(after.historyLength).toBe(before.historyLength);
  });

  it('select für eine unbekannte ID lässt alles unverändert', () => {
    const before = graph();
    usePlannerStore.getState().onNodesChange([{ type: 'select', id: 'ghost', selected: true }]);
    usePlannerStore.getState().onEdgesChange([{ type: 'select', id: 'ghost-edge', selected: true }]);
    usePlannerStore.getState().onWaterNodesChange([{ type: 'select', id: 'ghost', selected: true }]);
    usePlannerStore.getState().onWaterEdgesChange([{ type: 'select', id: 'ghost', selected: true }]);

    const after = graph();
    expect(after.nodes).toBe(before.nodes);
    expect(after.edges).toBe(before.edges);
    expect(after.waterNodes).toBe(before.waterNodes);
    expect(after.waterEdges).toBe(before.waterEdges);
  });

  it('Kontrollprobe: eine echte Messung schreibt weiterhin `measured` und `width/height`', () => {
    const beforeNodes = usePlannerStore.getState().nodes;

    usePlannerStore
      .getState()
      .onNodesChange([
        { type: 'dimensions', id: 'a', dimensions: { width: 240, height: 150 }, setAttributes: true },
      ]);

    const state = usePlannerStore.getState();
    expect(state.nodes).not.toBe(beforeNodes);
    expect(state.nodes[0]).toMatchObject({
      id: 'a',
      measured: { width: 240, height: 150 },
      width: 240,
      height: 150,
    });
    // Nicht betroffene Knoten bleiben identisch (React Flow braucht das).
    expect(state.nodes[1]).toBe(nodeB);
  });

  it('Kontrollprobe: Auswahl eines bekannten Knotens schreibt weiterhin', () => {
    usePlannerStore.getState().onNodesChange([{ type: 'select', id: 'a', selected: true }]);

    const state = usePlannerStore.getState();
    expect(state.nodes[0]?.selected).toBe(true);
    expect(state.nodes[1]).toBe(nodeB);
  });

  it('Kontrollprobe: `remove` einer unbekannten ID darf nicht als No-op gelten (Kanten-Aufräumen)', () => {
    // Ein verwaister Bezug ist der einzige Fall, in dem ein `remove` ohne
    // Store-Knoten überhaupt wirken kann.
    usePlannerStore.setState({
      nodes: [nodeA],
      edges: [
        { id: 'e1', source: 'a', target: 'b', data: {} },
        { id: 'e2', source: 'b', target: 'ghost', data: {} },
      ],
    });

    usePlannerStore.getState().onNodesChange([{ type: 'remove', id: 'ghost' }]);

    const state = usePlannerStore.getState();
    expect(state.nodes).toHaveLength(1);
    // Der Handler läuft wie zuvor durch den Struktur-Pfad.
    expect(state.historyPast.length).toBeGreaterThan(0);
  });

  it('Kontrollprobe: Position eines bekannten Knotens während des Ziehens schreibt weiterhin', () => {
    usePlannerStore
      .getState()
      .onNodesChange([{ type: 'position', id: 'a', position: { x: 40, y: 60 }, dragging: true }]);

    const state = usePlannerStore.getState();
    expect(state.nodes[0]?.position).toEqual({ x: 40, y: 60 });
    // Während des Ziehens entsteht KEIN Undo-Schritt (bestehendes Verhalten).
    expect(state.historyPast).toHaveLength(0);
  });
});

/**
 * Regel Q gilt auch für die Aktions-Pfade: `focusElement` (Knopf „Beheben“ in
 * der Warn-Zentrale) soll nur Elemente kopieren, deren Auswahl sich wirklich
 * ändert. Eine flächige Objektkopie kann React Flow zu Neuübernahmen und
 * Messungen veranlassen; ob sich dadurch geroutete Maße ändern, ist eine
 * Laufzeitfrage. Dieser Store-Test belegt den No-op-/Identitätsvertrag, nicht
 * die Ursache der gemeldeten Browser-Oszillation.
 */
describe('focusElement — nur die geänderte Auswahl erzeugt neue Objekte', () => {
  beforeEach(seed);

  it('wiederholtes Fokussieren desselben Knotens ist ein No-op', () => {
    usePlannerStore.getState().focusElement('a', 'node');
    const afterFirst = usePlannerStore.getState();
    expect(afterFirst.selectedNodes.map((node) => node.id)).toEqual(['a']);

    usePlannerStore.getState().focusElement('a', 'node');

    // Zustandsobjekt, Arrays und Elemente bleiben identisch.
    expect(usePlannerStore.getState()).toBe(afterFirst);
    expect(usePlannerStore.getState().nodes).toBe(afterFirst.nodes);
    expect(usePlannerStore.getState().edges).toBe(afterFirst.edges);
  });

  it('markiert nur den Ziel-Knoten, alles andere bleibt identisch', () => {
    const before = usePlannerStore.getState();

    usePlannerStore.getState().focusElement('a', 'node');

    const after = usePlannerStore.getState();
    expect(after.nodes).not.toBe(before.nodes);
    expect(after.nodes[0]?.selected).toBe(true);
    // Unbeteiligte Knoten (ohne `selected`-Feld) behalten ihre Identität …
    expect(after.nodes[1]).toBe(nodeB);
    // … ebenso Wasser-Graph und Kanten: keine Marke hat sich geändert.
    expect(after.waterNodes).toBe(before.waterNodes);
    expect(after.waterEdges).toBe(before.waterEdges);
    expect(after.edges).toBe(before.edges);
  });

  it('entfernt eine fremde Marke, ohne die übrigen Elemente zu ersetzen', () => {
    usePlannerStore.getState().onNodesChange([{ type: 'select', id: 'b', selected: true }]);
    const before = usePlannerStore.getState();
    const markedB = before.nodes[1]!;

    usePlannerStore.getState().focusElement('a', 'node');

    const after = usePlannerStore.getState();
    expect(after.nodes[1]).not.toBe(markedB);
    expect(after.nodes[1]?.selected).toBe(false);
    expect(after.nodes[0]?.selected).toBe(true);
    expect(after.edges).toBe(before.edges);
  });

  it('Kontrollprobe: eine markierte Leitung wird weiterhin fokussiert', () => {
    usePlannerStore.getState().focusElement('e1', 'edge');

    const state = usePlannerStore.getState();
    expect(state.selectedEdges.map((edge) => edge.id)).toEqual(['e1']);
    expect(state.edges[0]?.selected).toBe(true);
    expect(state.selectedNodes).toHaveLength(0);
    // Zweiter Aufruf: keine Änderung mehr.
    const second = usePlannerStore.getState();
    usePlannerStore.getState().focusElement('e1', 'edge');
    expect(usePlannerStore.getState()).toBe(second);
  });
});

/**
 * Rule Q für die Aktions-Pfade: Ein Aufruf **ohne Wirkung** darf weder einen
 * Undo-Schritt noch einen neuen Zustand erzeugen. Vorher entstand z. B. beim
 * Löschen ohne Auswahl ein Undo-Schritt, der nichts zurücknimmt, und eine
 * Daten-Aktion mit unbekannter ID schrieb einen Snapshot für eine Änderung,
 * die nie stattgefunden hat.
 */
describe('Aktionen ohne Wirkung erzeugen keinen Zustand', () => {
  beforeEach(seed);

  it('deleteSelected ohne Auswahl ist ein No-op (kein Undo-Schritt)', () => {
    usePlannerStore.setState({ selectedNodes: [], selectedEdges: [] });
    const before = usePlannerStore.getState();
    usePlannerStore.getState().deleteSelected();

    const after = usePlannerStore.getState();
    expect(after).toBe(before);
    expect(after.historyPast).toHaveLength(0);
    expect(after.canUndo).toBe(false);
  });

  it('updateNodeData mit unbekannter ID ist ein No-op', () => {
    const before = usePlannerStore.getState();
    usePlannerStore.getState().updateNodeData('ghost', { label: 'x' });

    expect(usePlannerStore.getState()).toBe(before);
    expect(usePlannerStore.getState().historyPast).toHaveLength(0);
  });

  it('handleChangeLength mit unbekannter Kanten-ID ist ein No-op', () => {
    const before = usePlannerStore.getState();
    usePlannerStore.getState().handleChangeLength('ghost-edge', 7);

    expect(usePlannerStore.getState()).toBe(before);
    expect(usePlannerStore.getState().historyPast).toHaveLength(0);
  });

  it('Kontrollprobe: eine bekannte ID schreibt weiterhin — mit Undo-Schritt', () => {
    usePlannerStore.getState().updateNodeData('a', { label: 'Batterie' });

    const state = usePlannerStore.getState();
    expect(state.nodes[0]?.data?.label).toBe('Batterie');
    expect(state.historyPast).toHaveLength(1);
    expect(state.canUndo).toBe(true);
    // Nicht betroffene Knoten bleiben identisch.
    expect(state.nodes[1]).toBe(nodeB);
  });

  it('Kontrollprobe: Löschen mit Auswahl bleibt strukturell (mit Undo-Schritt)', () => {
    usePlannerStore.setState({ selectedNodes: [nodeB], selectedEdges: [] });
    usePlannerStore.getState().deleteSelected();

    const state = usePlannerStore.getState();
    expect(state.nodes.map((node) => node.id)).toEqual(['a']);
    expect(state.historyPast.length).toBeGreaterThan(0);
  });
});
