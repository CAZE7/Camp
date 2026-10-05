import { beforeEach, describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { CableEdgeData } from '../lib/domain/cableEdgeData';
import { usePlannerStore } from './usePlannerStore';

const snapshot = [
  { x: 192, y: 60 },
  { x: 300, y: 60 },
  { x: 300, y: 160 },
];

const nodes: Node[] = [
  { id: 'battery', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } },
  { id: 'load', type: 'consumer', position: { x: 400, y: 100 }, data: { label: 'Last' } },
];

const edge: Edge<CableEdgeData> = {
  id: 'locked-cable',
  source: 'battery',
  sourceHandle: 'plus',
  target: 'load',
  targetHandle: 'plus',
  data: { intent: 'locked', locked: true, lockedWaypoints: snapshot, crossSection: 6 },
};

function resetStore() {
  usePlannerStore.setState({
    nodes: structuredClone(nodes),
    edges: [structuredClone(edge)],
    selectedNodes: [],
    selectedEdges: [],
    historyPast: [],
    historyFuture: [],
    canUndo: false,
    canRedo: false,
    plannerErrors: [],
    viewMode: 'electric',
    autoStructurePending: false,
  });
}

describe('fixierte Leitungen im Plan-Store', () => {
  beforeEach(resetStore);

  it('blockiert das Verschieben eines Endpunkts und meldet den konkreten Kabelkonflikt', () => {
    usePlannerStore
      .getState()
      .onNodesChange([{ type: 'position', id: 'battery', position: { x: 120, y: 40 }, dragging: false }]);

    expect(usePlannerStore.getState().nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(usePlannerStore.getState().edges[0]?.data?.lockedWaypoints).toEqual(snapshot);
    expect(usePlannerStore.getState().plannerErrors).toContainEqual(
      expect.objectContaining({ code: 'ROUTING_LOCKED_MUTATION', edgeIds: ['locked-cable'] })
    );
    expect(usePlannerStore.getState().lockedMutationErrors).toContainEqual(
      expect.objectContaining({ code: 'ROUTING_LOCKED_MUTATION', edgeIds: ['locked-cable'] })
    );
  });

  it('blockiert Löschen eines Endpunkts sowie direktes Entfernen der gesperrten Kante', () => {
    const state = usePlannerStore.getState();
    state.onNodesChange([{ type: 'remove', id: 'battery' }]);
    state.onEdgesChange([{ type: 'remove', id: 'locked-cable' }]);

    expect(usePlannerStore.getState().nodes.map((node) => node.id)).toContain('battery');
    expect(usePlannerStore.getState().edges.map((candidate) => candidate.id)).toContain('locked-cable');
    expect(
      usePlannerStore.getState().plannerErrors.some((error) => error.code === 'ROUTING_LOCKED_MUTATION')
    ).toBe(true);
  });

  it('blockiert Setzen, Planwechsel und Layout, solange eine Leitung gesperrt ist', async () => {
    const state = usePlannerStore.getState();
    state.setEdges([]);
    state.clearPlan();
    state.applyTemplate('allrounder');
    const layout = await state.onLayoutV2();

    expect(layout).toEqual({ applied: false, reason: 'locked-edge' });
    expect(usePlannerStore.getState().nodes.map((node) => node.id)).toEqual(['battery', 'load']);
    expect(usePlannerStore.getState().edges.map((candidate) => candidate.id)).toEqual(['locked-cable']);
    expect(
      usePlannerStore.getState().plannerErrors.some((error) => error.code === 'ROUTING_LOCKED_MUTATION')
    ).toBe(true);
  });

  it('lässt Löschen nach explizitem Entsperren zu und entfernt alte Lock-Mutationswarnungen', () => {
    const state = usePlannerStore.getState();
    state.onNodesChange([{ type: 'position', id: 'battery', position: { x: 50, y: 0 }, dragging: false }]);
    usePlannerStore.getState().setEdgeIntent('locked-cable', 'user');
    expect(usePlannerStore.getState().lockedMutationErrors).toEqual([]);
    usePlannerStore.getState().setSelectedEdges([usePlannerStore.getState().edges[0]!]);
    usePlannerStore.getState().deleteSelected();

    expect(usePlannerStore.getState().edges).toEqual([]);
    expect(usePlannerStore.getState().plannerErrors).toEqual([]);
  });
});
