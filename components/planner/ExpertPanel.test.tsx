import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpertPanel } from './ExpertPanel';
import { usePlannerStore } from '../../store/usePlannerStore';
import { withSelector } from '../../test-helpers/reactflowMocks';

const defaultPlannerStoreState = {
  selectedNodes: [],
  nodes: [],
  edges: [],
};

vi.mock('../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn(),
}));

describe('ExpertPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders closed state by default with FAB button', () => {
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector(defaultPlannerStoreState) as typeof usePlannerStore
    );
    render(<ExpertPanel />);

    // The panel should be closed initially and show the FAB
    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it('opens panel and displays default tip when no node is selected', () => {
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector(defaultPlannerStoreState) as typeof usePlannerStore
    );
    render(<ExpertPanel />);

    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // Panel should now be open, showing default tip
    expect(screen.getByText('Fachwissen')).toBeInTheDocument();
    expect(screen.getByText("So funktioniert's")).toBeInTheDocument();
  });

  it('shows specific knowledge when a node is selected', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'battery', data: {} }],
      nodes: [],
      edges: [],
    };
    vi.mocked(usePlannerStore).mockImplementation(withSelector(selectedState) as typeof usePlannerStore);

    render(<ExpertPanel />);

    // Open the panel
    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // Should show battery knowledge
    expect(screen.getByText('Batterie — Fachwissen')).toBeInTheDocument();
    expect(screen.getByText('LiFePO4 vs. AGM')).toBeInTheDocument();
  });

  it('calculates live recommendations for inverter', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'inverter', data: { watts: 1000 } }],
      nodes: [],
      edges: [{ id: 'e1', source: '1', target: '2', data: { length: 2 } }],
    };
    vi.mocked(usePlannerStore).mockImplementation(withSelector(selectedState) as typeof usePlannerStore);

    render(<ExpertPanel />);

    // Open the panel
    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Aktuelle Empfehlung/)).toBeInTheDocument();
    expect(screen.getByText('Kabelquerschnitt')).toBeInTheDocument();
    expect(screen.getByText('Sicherung')).toBeInTheDocument();
    // I = 1000 / 12.8 / 0.85 = 91.91 A (Systemspannung statt hartem /12)
    expect(screen.getByText(/91\.9 A/)).toBeInTheDocument();
  });

  it('calculates live recommendations for solar', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'solar', data: { watts: 200 } }],
      nodes: [],
      edges: [{ id: 'e1', source: '1', target: '2', data: { length: 5 } }],
    };
    vi.mocked(usePlannerStore).mockImplementation(withSelector(selectedState) as typeof usePlannerStore);

    render(<ExpertPanel />);

    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // I = 200 / 18 = 11.11A
    expect(screen.getByText(/11\.1 A/)).toBeInTheDocument();
  });

  it('toggles tip sections', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'battery', data: {} }],
      nodes: [],
      edges: [],
    };
    vi.mocked(usePlannerStore).mockImplementation(withSelector(selectedState) as typeof usePlannerStore);

    render(<ExpertPanel />);

    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // The first tip should be expanded by default (index 0)
    // We should see its body text
    expect(
      screen.getByText(
        'LiFePO4-Akkus haben eine nutzbare Kapazität von ca. 95 % Entladetiefe (DoD), AGM nur ~50%. Eine 100Ah LiFePO4 ersetzt also eine 200Ah AGM.'
      )
    ).toBeInTheDocument();

    // Click the second tip
    const secondTipHeading = screen.getByText('Kabelquerschnitt zur Batterie');
    fireEvent.click(secondTipHeading);

    // Should now see the second tip body
    expect(
      screen.getByText(/Die Zuleitung zur Batterie muss den maximalen Entladestrom tragen/)
    ).toBeInTheDocument();
  });

  it('M8-2: Schließen-Button ist tokenfarben, Header ist sticky', () => {
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector(defaultPlannerStoreState) as typeof usePlannerStore
    );
    render(<ExpertPanel />);
    fireEvent.click(screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i }));

    const close = screen.getByTestId('expert-panel-close');
    expect(close).toBeVisible();
    expect(close).toHaveAttribute('aria-label', 'Panel schließen');
    expect(close.className).toContain('text-bone');
    expect(close.className).not.toContain('text-paper/70');
    expect(close.className).toMatch(/h-11/);
    expect(close.className).toMatch(/w-11/);

    const header = close.parentElement;
    expect(header?.className).toContain('sticky');
    expect(header?.className).toContain('bg-ink');
    expect(header?.className).toContain('text-bone');

    const panel = screen.getByTestId('expert-panel');
    expect(panel).toHaveAttribute('data-open', 'true');
    expect(panel.className).toContain('bottom-28');
    // md:bottom-20 hält das offene Panel über der Statuszeile (54 px +
    // Rand) — bottom-16 ließ es sie um 5 px schneiden (E2E `expert-panel`).
    expect(panel.className).toContain('md:bottom-20');
    expect(panel.className).not.toContain('top-16');
  });

  it('M8-2: Layout-Klassen räumen MiniMap/Statuszeile auf 375/768/1440', () => {
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector(defaultPlannerStoreState) as typeof usePlannerStore
    );
    const { rerender } = render(<ExpertPanel />);
    const closed = screen.getByTestId('expert-panel');
    expect(closed.className).toContain('right-4');
    expect(closed.className).toContain('bottom-20');
    expect(closed.className).toContain('md:bottom-16');

    fireEvent.click(screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i }));
    rerender(<ExpertPanel />);
    expect(screen.getByTestId('expert-panel-open')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('expert-panel-close'));
    expect(screen.queryByTestId('expert-panel-open')).not.toBeInTheDocument();
  });
});
