import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from 'reactflow';
import { CanvasContextMenu } from './CanvasContextMenu';

const store = vi.hoisted(() => ({
  nodes: [] as Node[],
  waterNodes: [] as Node[],
  onNodesChange: vi.fn(),
  onWaterNodesChange: vi.fn(),
  focusElement: vi.fn(),
  setSelectedNodes: vi.fn(),
  setSelectedEdges: vi.fn(),
  deleteSelected: vi.fn(),
}));

vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: { getState: () => store },
}));

describe('CanvasContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.nodes = [
      { id: 'battery-1', type: 'battery', position: { x: 32, y: 48 }, data: { label: 'Batterie' } },
    ];
    store.waterNodes = [];
  });

  it('offers an undoable, one-tap nudge alternative to dragging a node', () => {
    render(
      <CanvasContextMenu
        state={{ x: 100, y: 100, targetType: 'node', targetId: 'battery-1', label: 'Batterie' }}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Batterie nach rechts verschieben' }));

    expect(store.onNodesChange).toHaveBeenCalledWith([
      {
        type: 'position',
        id: 'battery-1',
        position: { x: 48, y: 48 },
        dragging: false,
      },
    ]);
  });

  it('routes a water node nudge through the water graph slice', () => {
    store.nodes = [];
    store.waterNodes = [{ id: 'pump-1', type: 'pump', position: { x: 64, y: 64 }, data: { label: 'Pumpe' } }];
    render(
      <CanvasContextMenu
        state={{ x: 100, y: 100, targetType: 'node', targetId: 'pump-1', label: 'Pumpe' }}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pumpe nach unten verschieben' }));

    expect(store.onWaterNodesChange).toHaveBeenCalledWith([
      {
        type: 'position',
        id: 'pump-1',
        position: { x: 64, y: 80 },
        dragging: false,
      },
    ]);
  });
});
