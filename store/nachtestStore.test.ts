import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from './usePlannerStore';
import { collidingNodeIds } from '../components/planner/utils/collision';
import type { Node } from '@xyflow/react';

/**
 * Nachtest 2026-10-16:
 *  - N1 (kritisch): Auto-verbinden im Wasser-Tab verkabelte den
 *    Elektroplan um.
 *  - „Überlappung neuer Teile“: Ein Drop auf ein vorhandenes Bauteil
 *    legte das neue exakt darüber.
 */
function resetStore() {
  usePlannerStore.setState({
    viewMode: 'electric',
    nodes: [
      {
        id: 'batt-1',
        type: 'battery',
        position: { x: 0, y: 0 },
        data: { label: 'Batterie', capacity: 100 },
      },
      {
        id: 'cons-1',
        type: 'consumer',
        position: { x: 320, y: 0 },
        data: { label: 'Licht', watts: 20, hours: 4 },
      },
    ] as Node[],
    edges: [],
    waterNodes: [
      { id: 'tank-1', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: { label: 'Tank' } },
    ] as Node[],
    waterEdges: [],
    autoWirePreview: null,
    historyPast: [],
    historyFuture: [],
    canUndo: false,
    canRedo: false,
  });
}

describe('Auto-verbinden im Wasser-Tab (N1)', () => {
  beforeEach(resetStore);

  it('erzeugt keinen Elektro-Vorschlag und ändert nichts am Elektroplan', () => {
    usePlannerStore.setState({ viewMode: 'water' });
    const before = usePlannerStore.getState();
    const nodesBefore = before.nodes;
    const edgesBefore = before.edges;

    usePlannerStore.getState().autoWireSystem();

    const after = usePlannerStore.getState();
    expect(after.autoWirePreview).toBeNull();
    expect(after.nodes).toBe(nodesBefore);
    expect(after.edges).toBe(edgesBefore);
    expect(after.waterEdges).toHaveLength(0);
  });

  it('im Elektrik-Tab entsteht weiterhin nur eine Vorschau (kein Direkt-Eingriff)', () => {
    const edgesBefore = usePlannerStore.getState().edges;
    usePlannerStore.getState().autoWireSystem();
    const after = usePlannerStore.getState();
    // Vorschau liegt bereit, der echte Graph ist unberührt, bis der
    // Nutzer „Vorschlag anwenden“ bestätigt.
    expect(after.edges).toBe(edgesBefore);
    expect(after.autoWirePreview).not.toBeNull();
  });
});

describe('addNode weicht Überlappungen aus (Nachtest)', () => {
  beforeEach(resetStore);

  it('legt ein neues Bauteil nicht auf ein vorhandenes (Elektrik)', () => {
    usePlannerStore.getState().addNode('consumer', 'Neues Licht', { x: 0, y: 0 });
    const nodes = usePlannerStore.getState().nodes as Node[];
    const added = nodes.at(-1)!;
    expect(added.position).not.toEqual({ x: 0, y: 0 });
    expect(
      collidingNodeIds(
        added,
        nodes.filter((node) => node.id !== added.id)
      )
    ).toHaveLength(0);
  });

  it('legt ein neues Wasserteil nicht auf ein vorhandenes (Wasser)', () => {
    usePlannerStore.setState({ viewMode: 'water' });
    usePlannerStore.getState().addNode('pump', 'Pumpe', { x: 0, y: 0 });
    const waterNodes = usePlannerStore.getState().waterNodes as Node[];
    const added = waterNodes.at(-1)!;
    expect(added.position).not.toEqual({ x: 0, y: 0 });
  });

  it('lässt einen freien Drop exakt an seiner Position', () => {
    usePlannerStore.getState().addNode('consumer', 'Frei', { x: 900, y: 600 });
    const added = (usePlannerStore.getState().nodes as Node[]).at(-1)!;
    expect(added.position).toEqual({ x: 900, y: 600 });
  });

  it('leitet den Solar-Arbeitsstrom aus der Vorlagen-Leistung ab', () => {
    usePlannerStore.getState().addNode('solar', 'Solarmodul 200 W', { x: 900, y: 0 }, 200);
    const added = (usePlannerStore.getState().nodes as Node[]).at(-1)!;
    const data = added.data as { voltage: number; amps: number; watts: number };
    expect(data.watts).toBe(200);
    expect(data.voltage).toBeGreaterThan(0);
    expect(data.amps).toBeCloseTo(200 / data.voltage, 0);
  });
});
