import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSelector } from '../../test-helpers/reactflowMocks';
import { PlannerSidebar } from './PlannerSidebar';

// Mock usePlannerStore
const mockToggleSidebar = vi.fn();
// AUDIT T1: Zustand als Modul-Konstante, damit der Selektor einen Typ hat
// (Name beginnt mit `mock`, damit Vitest die Referenz in der Factory erlaubt).
const mockSidebarStoreState = {
  viewMode: 'electric',
  isSidebarOpen: true,
  toggleSidebar: mockToggleSidebar,
};
vi.mock('../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn((selector: (state: typeof mockSidebarStoreState) => unknown) =>
    selector(mockSidebarStoreState)
  ),
}));

// Mock Sidebar component
vi.mock('../Sidebar', () => ({
  Sidebar: ({ mode }: { mode: string }) => <div data-testid="sidebar-mock">Sidebar Mode: {mode}</div>,
}));

describe('PlannerSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSidebarStoreState.isSidebarOpen = true;
  });

  it('renders correctly initially with sidebar open', () => {
    render(<PlannerSidebar />);

    // Check if the mock Sidebar is rendered with the correct mode
    expect(screen.getByTestId('sidebar-mock')).toHaveTextContent('Sidebar Mode: electric');

    // Check if the toggle button is present and has the correct title for "open" state
    const toggleButton = screen.getByTitle('Sidebar einklappen');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveClass('h-11', 'w-11');
    expect(toggleButton).toHaveAttribute('aria-controls', 'component-palette-panel');
    expect(document.getElementById('component-palette-panel')).toBeInTheDocument();
  });

  it('keeps a collapsed desktop palette out of keyboard navigation while preserving its mobile tab layout', () => {
    mockSidebarStoreState.isSidebarOpen = false;
    render(<PlannerSidebar />);

    const panel = document.getElementById('component-palette-panel');
    expect(panel).toHaveClass('w-full', 'md:invisible', 'md:w-0');
  });

  it('toggles sidebar state when button is clicked', () => {
    render(<PlannerSidebar />);

    const toggleButton = screen.getByRole('button');

    // Initially open (isSidebarOpen=true in mock)
    expect(toggleButton).toHaveAttribute('title', 'Sidebar einklappen');

    // Clicking should call toggleSidebar from store
    fireEvent.click(toggleButton);
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('passes the correct viewMode from store to Sidebar', async () => {
    // Change mock to return 'water' mode
    const { usePlannerStore } = await import('../../store/usePlannerStore');
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector({
        viewMode: 'water',
        isSidebarOpen: true,
        toggleSidebar: vi.fn(),
      }) as typeof usePlannerStore
    );

    render(<PlannerSidebar />);

    expect(screen.getByTestId('sidebar-mock')).toHaveTextContent('Sidebar Mode: water');
  });
});
