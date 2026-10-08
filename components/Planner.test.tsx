import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlannerInner from './PlannerInner';
import Planner from './Planner';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/elektrik-planung',
}));

// Mock next/dynamic to return PlannerInner directly in test environment
vi.mock('next/dynamic', () => ({
  default: () => PlannerInner,
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
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="react-flow-provider">{children}</div>
    ),
    // Die Shell liest den Canvas-Zoom über `useStore`. Ein Attrappen-Provider
    // hat keinen Kontext — deshalb wird hier nur dieser eine Hook mit einem
    // ruhigen Standardwert beantwortet, statt den echten Provider zu mounten
    // (dessen ResizeObserver-Lauf in jsdom unnötig Speicher frisst).
    useStore: (selector: (state: { transform: number[] }) => unknown) => selector({ transform: [0, 0, 1] }),
    // Die Statuszeile fragt die Zeigerposition über den Viewport-Helper ab.
    useReactFlow: () => ({ screenToFlowPosition: (point: { x: number; y: number }) => point }),
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
    render(<Planner />);

    // Because of dynamic loading, we need to wait for the inner div to appear.
    await waitFor(() => {
      // Die Anwendungsshell ist eine Spalte: Menüleiste, Werkzeugleiste,
      // Arbeitsbereich, Statuszeile. Nur der Arbeitsbereich wird ab 768 px
      // zur Zeile (Sidebar + Canvas nebeneinander, Akzeptanzkriterium A2).
      const shell = screen.getByTestId('planner-shell');
      expect(shell).toHaveClass(
        'planner-shell',
        'flex',
        'flex-col',
        'h-dvh',
        'shrink-0',
        'min-h-0',
        'w-full',
        'bg-background',
        'overflow-hidden'
      );
      // `shrink-0` is essential: flex-1's zero basis collapsed the dvh shell
      // to the toolbar + bottom nav in a parent with automatic height.
      const workspace = screen.getByTestId('planner-workspace');
      expect(workspace).toHaveClass('flex', 'flex-col', 'md:flex-row', 'min-h-0', 'min-w-0', 'flex-1');
    });
  });
});
