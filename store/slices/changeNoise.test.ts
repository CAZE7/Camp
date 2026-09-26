import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { usePlannerStore } from '../usePlannerStore';

/**
 * Regression (Bug 2026-09-26, „object recreation“ / „onNodesChange“):
 * `applyNodeChanges`/`applyEdgeChanges` geben IMMER ein neues Array zurück —
 * auch wenn keine Änderung ein Element getroffen hat. Genau das passiert im
 * Betrieb: React Flows ResizeObserver meldet `dimensions` für **jeden**
 * gemounteten Knoten, also auch für den Darstellungs-Rahmen des
 * Hauptstromkreises, den der Planner-Store nicht kennt. Die Änderung lief
 * durch `onNodesChange`, fand kein Element — und hinterließ trotzdem eine neue
 * Array-Referenz.
 *
 * Folge: jeder `state.nodes`-Konsument rendert neu (u. a. jede `CableEdge`),
 * die identitätsgebundenen WeakMap-Caches des Graphen und der
 * Routing-Nachbarschaft bauen sich neu auf, und React Flow übernimmt die
 * Knoten erneut. Deshalb schreiben die Handler ohne echte Änderung nicht mehr.
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
