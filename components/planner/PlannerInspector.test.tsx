import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlannerInspector } from './PlannerInspector';

// Mock usePlannerStore
const mockToggleInspector = vi.fn();
const mockPlannerStoreState = {
  nodes: [
    { id: 'node-1', data: { label: 'Node 1' } },
    { id: 'node-2', data: { label: 'Node 2' } },
  ],
  waterNodes: [],
  edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
  season: 'summer',
  selectedNodes: [{ id: 'node-1' }],
  selectedEdges: [],
  handleChangeLength: vi.fn(),
  deleteSelected: vi.fn(),
  updateNodeData: vi.fn(),
  isInspectorOpen: true,
  toggleInspector: mockToggleInspector,
};

vi.mock('../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn((selector) => selector(mockPlannerStoreState)),
}));

// Mock useAppStore
const mockAppStoreState = {
  calculatedSolarWatts: 500,
};

vi.mock('../../lib/store', () => ({
  useAppStore: vi.fn((selector) => selector(mockAppStoreState)),
}));

// Mock useDashboardMetrics
vi.mock('./hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: vi.fn(() => ({
    chargingTimeStr: '5h 30m',
  })),
}));

// Mock Inspector component
vi.mock('../Inspector', () => ({
  default: (props: any) => (
    <div data-testid="inspector-mock">
      <span data-testid="prop-selectedNodeId">{props.selectedNode?.id || 'none'}</span>
      <span data-testid="prop-selectedEdgeId">{props.selectedEdge?.id || 'none'}</span>
      <span data-testid="prop-chargingTimeStr">{props.chargingTimeStr}</span>
      <span data-testid="prop-calculatedSolarWatts">{props.calculatedSolarWatts}</span>
      <span data-testid="prop-nodesLength">{props.nodes?.length || 0}</span>
      <span data-testid="prop-edgesLength">{props.edges?.length || 0}</span>
    </div>
  ),
}));

describe('PlannerInspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly initially with sidebar open', () => {
    render(<PlannerInspector />);

    // Check if toggle button is rendered and has the correct title for "open" state
    const toggleButton = screen.getByTitle('Inspector einklappen');
    expect(toggleButton).toBeInTheDocument();

    // Inspector mock should be in the document
    expect(screen.getByTestId('inspector-mock')).toBeInTheDocument();
  });

  it('toggles sidebar state when button is clicked', () => {
    render(<PlannerInspector />);

    const toggleButton = screen.getByRole('button');

    // Initially open (isInspectorOpen=true in mock)
    expect(toggleButton).toHaveAttribute('title', 'Inspector einklappen');

    // Click should call store toggleInspector
    fireEvent.click(toggleButton);
    expect(mockToggleInspector).toHaveBeenCalledTimes(1);
  });

  it('passes the correct props to the Inspector component', () => {
    render(<PlannerInspector />);

    // We defined mockPlannerStoreState with selectedNodes: [{ id: 'node-1' }]
    // and no selectedEdges.
    expect(screen.getByTestId('prop-selectedNodeId')).toHaveTextContent('node-1');
    expect(screen.getByTestId('prop-selectedEdgeId')).toHaveTextContent('none');

    // We defined mockAppStoreState with calculatedSolarWatts: 500
    expect(screen.getByTestId('prop-calculatedSolarWatts')).toHaveTextContent('500');

    // We defined mock useDashboardMetrics with chargingTimeStr: '5h 30m'
    expect(screen.getByTestId('prop-chargingTimeStr')).toHaveTextContent('5h 30m');

    // We defined mockPlannerStoreState with 2 nodes and 1 edge
    expect(screen.getByTestId('prop-nodesLength')).toHaveTextContent('2');
    expect(screen.getByTestId('prop-edgesLength')).toHaveTextContent('1');
  });

  it('updates selectedEdge prop when store changes', async () => {
    // Update the store state for this specific test
    const { usePlannerStore } = await import('../../store/usePlannerStore');
    vi.mocked(usePlannerStore).mockImplementation((selector: any) => {
      return selector({
        ...mockPlannerStoreState,
        selectedNodes: [],
        selectedEdges: [{ id: 'edge-1' }],
      });
    });

    render(<PlannerInspector />);

    // Now selectedNode should be none, and selectedEdge should be edge-1
    expect(screen.getByTestId('prop-selectedNodeId')).toHaveTextContent('none');
    expect(screen.getByTestId('prop-selectedEdgeId')).toHaveTextContent('edge-1');
  });
});
