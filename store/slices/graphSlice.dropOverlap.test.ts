import { describe, it, expect, beforeEach } from 'vitest';
import { usePlannerStore } from '../usePlannerStore';
import { batteryDesignator } from '../../components/nodes/batteryDesignator';

/**
 * QA B-03 (Regression): Ein Drop auf eine belegte Fläche legt das neue Bauteil
 * nicht darüber, und jede Batterie bekommt eine eigene Bezeichnung.
 */
describe('graphSlice · Drop ohne Überlappung (B-03)', () => {
  beforeEach(() => {
    usePlannerStore.setState({ viewMode: 'electric', nodes: [], edges: [] } as never);
  });

  it('weicht bei einem Drop auf einen belegten Platz aus', () => {
    const { addNode } = usePlannerStore.getState();
    addNode('battery', 'Batterie', { x: 0, y: 0 });
    const existing = usePlannerStore.getState().nodes[0];
    if (!existing) throw new Error('Batterie wurde nicht angelegt');

    const dropAt = (x: number, y: number) =>
      usePlannerStore.getState().onCustomDrop(
        new CustomEvent('planner-drop', {
          detail: { clientX: 0, clientY: 0, type: 'battery', label: 'Batterie' },
        }),
        () => ({ x, y })
      );
    // Drop genau auf die bestehende Batterie.
    dropAt(existing.position.x + 10, existing.position.y + 10);

    const nodes = usePlannerStore.getState().nodes;
    expect(nodes).toHaveLength(2);
    const added = nodes[1];
    if (!added) throw new Error('Drop hat keinen Knoten angelegt');
    const overlaps =
      Math.abs(added.position.x - existing.position.x) < 192 &&
      Math.abs(added.position.y - existing.position.y) < 120;
    expect(overlaps).toBe(false);
  });
});

describe('graphSlice · Wasser-Drop ohne Überlappung (B-13)', () => {
  it('legt einen Wasser-Drop nicht auf ein bestehendes Wasserbauteil', () => {
    usePlannerStore.setState({
      viewMode: 'water',
      waterNodes: [{ id: 'tank-1', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} }],
      waterEdges: [],
    } as never);
    usePlannerStore.getState().onCustomDrop(
      new CustomEvent('planner-drop', {
        detail: { clientX: 0, clientY: 0, type: 'pump', label: 'Pumpe' },
      }),
      () => ({ x: 10, y: 10 })
    );
    const waterNodes = usePlannerStore.getState().waterNodes;
    expect(waterNodes).toHaveLength(2);
    const added = waterNodes[1];
    if (!added) throw new Error('Drop hat keinen Wasserknoten angelegt');
    expect(added.position).not.toEqual({ x: 10, y: 10 });
  });
});

describe('Batterie-Bezeichnung (B-03)', () => {
  it('vergibt jeder Batterie eine eigene Bezeichnung', () => {
    const labels = [0, 1, 2].map(batteryDesignator);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[0]).toBe('G1');
  });
});
