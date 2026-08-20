import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Planner from './Planner';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/elektrik-planung',
}));

// Mock next/dynamic to resolve component lazily with Suspense in test environment
vi.mock('next/dynamic', () => ({
  default: (loadComponent: () => Promise<any>) => {
    const Component = React.lazy(loadComponent);
    return function DynamicMock(props: any) {
      return (
        <React.Suspense fallback={<div>Loading...</div>}>
          <Component {...props} />
        </React.Suspense>
      );
    };
  },
}));

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
  it('renders all main planner areas', async () => {
    render(<Planner />);

    // Verify ReactFlowProvider wraps the content
    expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();

    // Verify all major child components are rendered after dynamic import
    await waitFor(() => {
        expect(screen.getByTestId('planner-sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('planner-dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
        expect(screen.getByTestId('planner-inspector')).toBeInTheDocument();
    });
  });

  it('has the correct layout structure', async () => {
    const { container } = render(<Planner />);

    // Because of dynamic loading, we need to wait for the inner div to appear.
    await waitFor(() => {
        const sidebar = screen.getByTestId('planner-sidebar');
        // The sidebar is wrapped in a container that has the lg:flex classes
        const mainContainer = sidebar.parentElement?.parentElement;
        expect(mainContainer).toHaveClass('flex', 'flex-col', 'lg:flex-row', 'flex-1', 'min-h-0', 'w-full', 'bg-background', 'overflow-hidden');
    });
  });
});
