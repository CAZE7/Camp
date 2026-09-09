import { describe, it, expect, beforeEach } from 'vitest';
import { usePlannerStore } from './usePlannerStore';
import type { Node, Edge } from '@xyflow/react';

/**
 * Change-Guards (`touchesKnownElement`): Präsentations-Elemente
 * (Backbone-Gruppe) leben nur in den React-Flow-Props, nicht im Store.
 * Ihre Change-Meldungen lösen kein set() aus — sonst antwortet React Flow
 * auf jedes frische Array mit neuem Measure, und der Kreislauf läuft mit
 * 60 Hz ewig (Persistenz-Debounce kommt nie zum Flushen, Render-Baum
 * dauerfeuert; gemessen: 120 setTimeout(200)/2 s nach Auto-Wire).
 */

const seedNodes: Node[] = [
  { id: 'battery', type: 'battery', position: { x: 100, y: 100 }, data: { label: 'Batterie' } },
  { id: 'consumer-1', type: 'consumer', position: { x: 700, y: 50 }, data: { watts: 60 } },
];
const seedEdges: Edge[] = [
  {
    id: 'e-battery-consumer',
    source: 'battery',
    target: 'consumer-1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: { length: 3, crossSection: 2.5 },
  },
];

describe('graphSlice Change-Guards', () => {
  beforeEach(() => {
    usePlannerStore.setState({
      nodes: seedNodes.map((node) => ({ ...node })),
      edges: seedEdges.map((edge) => ({ ...edge })),
      waterNodes: [],
      waterEdges: [],
      selectedNodes: [],
      selectedEdges: [],
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('onNodesChange: dimensions einer fremden ID (Backbone-Gruppe) lösen kein set() aus', () => {
    const before = usePlannerStore.getState().nodes;
    let notifications = 0;
    const unsub = usePlannerStore.subscribe(() => notifications++);
    try {
      usePlannerStore.getState().onNodesChange([
        {
          id: '__planner-backbone-group',
          type: 'dimensions',
          dimensions: { width: 500, height: 400 },
        },
      ]);
    } finally {
      unsub();
    }
    expect(notifications).toBe(0);
    expect(usePlannerStore.getState().nodes).toBe(before);
  });

  it('onNodesChange: echte Positionsänderung wird weiterhin angewendet', () => {
    usePlannerStore
      .getState()
      .onNodesChange([{ id: 'battery', type: 'position', position: { x: 150, y: 120 } }]);
    const battery = usePlannerStore.getState().nodes.find((node) => node.id === 'battery');
    expect(battery?.position).toEqual({ x: 150, y: 120 });
  });

  it('onNodesChange: gemischter Batch (fremd + bekannt) wendet den bekannten Teil an', () => {
    usePlannerStore.getState().onNodesChange([
      {
        id: '__planner-backbone-group',
        type: 'dimensions',
        dimensions: { width: 500, height: 400 },
      },
      { id: 'battery', type: 'position', position: { x: 11, y: 22 } },
    ]);
    const state = usePlannerStore.getState();
    expect(state.nodes.find((node) => node.id === 'battery')?.position).toEqual({ x: 11, y: 22 });
    expect(state.nodes.some((node) => node.id === '__planner-backbone-group')).toBe(false);
  });

  it('onNodesChange: leeres Change-Array löst kein set() aus', () => {
    const before = usePlannerStore.getState().nodes;
    let notifications = 0;
    const unsub = usePlannerStore.subscribe(() => notifications++);
    try {
      usePlannerStore.getState().onNodesChange([]);
    } finally {
      unsub();
    }
    expect(notifications).toBe(0);
    expect(usePlannerStore.getState().nodes).toBe(before);
  });

  it('onEdgesChange: Meldung einer fremden Kanten-ID bleibt still', () => {
    const before = usePlannerStore.getState().edges;
    let notifications = 0;
    const unsub = usePlannerStore.subscribe(() => notifications++);
    try {
      usePlannerStore.getState().onEdgesChange([{ id: 'ghost-edge', type: 'select', selected: true }]);
    } finally {
      unsub();
    }
    expect(notifications).toBe(0);
    expect(usePlannerStore.getState().edges).toBe(before);
  });

  it('onEdgesChange: echte Selektion wird weiterhin angewendet', () => {
    usePlannerStore.getState().onEdgesChange([{ id: 'e-battery-consumer', type: 'select', selected: true }]);
    expect(usePlannerStore.getState().edges.find((edge) => edge.id === 'e-battery-consumer')?.selected).toBe(
      true
    );
  });

  it('onEdgesChange: add-Change (trägt keine ID) passiert den Filter', () => {
    const item = {
      id: 'e-new',
      source: 'battery',
      target: 'consumer-1',
      type: 'cableEdge',
      data: { length: 1, crossSection: 2.5 },
    };
    usePlannerStore.getState().onEdgesChange([{ type: 'add', item }]);
    expect(usePlannerStore.getState().edges.some((edge) => edge.id === 'e-new')).toBe(true);
  });

  it('onWaterNodesChange/onWaterEdgesChange: fremde IDs bleiben still', () => {
    const beforeNodes = usePlannerStore.getState().waterNodes;
    const beforeEdges = usePlannerStore.getState().waterEdges;
    let notifications = 0;
    const unsub = usePlannerStore.subscribe(() => notifications++);
    try {
      usePlannerStore
        .getState()
        .onWaterNodesChange([{ id: 'ghost', type: 'dimensions', dimensions: { width: 1, height: 1 } }]);
      usePlannerStore.getState().onWaterEdgesChange([{ id: 'ghost', type: 'select', selected: true }]);
    } finally {
      unsub();
    }
    expect(notifications).toBe(0);
    expect(usePlannerStore.getState().waterNodes).toBe(beforeNodes);
    expect(usePlannerStore.getState().waterEdges).toBe(beforeEdges);
  });
});
