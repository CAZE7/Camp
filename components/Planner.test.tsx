import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Planner from './Planner';

// Mock the child components to simplify testing
vi.mock('./planner/PlannerSidebar', () => ({
  PlannerSidebar: () => <div data-testid="planner-sidebar">PlannerSidebar</div>,
}));

vi.mock('./planner/PlannerInspector', () => ({
  PlannerInspector: () => <div data-testid="planner-inspector">PlannerInspector</div>,
}));

vi.mock('./planner/PlannerDashboard', () => ({
  PlannerDashboard: () => <div data-testid="planner-dashboard">PlannerDashboard</div>,
}));

vi.mock('./planner/FlowCanvas', () => ({
  FlowCanvas: () => <div data-testid="flow-canvas">FlowCanvas</div>,
}));

// Mock ReactFlowProvider
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="react-flow-provider">{children}</div>
    ),
  };
});

describe('Planner Component', () => {
  it('renders all main planner areas', () => {
    render(<Planner />);

    // Verify ReactFlowProvider wraps the content
    expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();

    // Verify all major child components are rendered
    expect(screen.getByTestId('planner-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('planner-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('planner-inspector')).toBeInTheDocument();
  });

  it('has the correct layout structure', () => {
    const { container } = render(<Planner />);

    // Check if the main container has the expected classes
    const mainContainer = container.firstChild?.firstChild;
    expect(mainContainer).toHaveClass('flex', 'h-screen', 'w-full', 'bg-background', 'overflow-hidden');
  });
});
