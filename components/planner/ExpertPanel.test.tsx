import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpertPanel } from './ExpertPanel';
import { usePlannerStore } from '../../store/usePlannerStore';

const defaultPlannerStoreState = {
  selectedNodes: [],
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
    vi.mocked(usePlannerStore).mockImplementation((selector: any) => selector(defaultPlannerStoreState));
    render(<ExpertPanel />);

    // The panel should be closed initially and show the FAB
    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it('opens panel and displays default tip when no node is selected', () => {
    vi.mocked(usePlannerStore).mockImplementation((selector: any) => selector(defaultPlannerStoreState));
    render(<ExpertPanel />);

    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // Panel should now be open, showing default tip
    expect(screen.getByText("Fachwissen")).toBeInTheDocument();
    expect(screen.getByText("So funktioniert's")).toBeInTheDocument();
  });

  it('shows specific knowledge when a node is selected', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'battery', data: {} }],
      edges: [],
    };
    vi.mocked(usePlannerStore).mockImplementation((selector: any) => selector(selectedState));

    render(<ExpertPanel />);

    // Open the panel
    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // Should show battery knowledge
    expect(screen.getByText("Batterie — Fachwissen")).toBeInTheDocument();
    expect(screen.getByText("LiFePO4 vs. AGM")).toBeInTheDocument();
  });

  it('calculates live recommendations for inverter', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'inverter', data: { watts: 1000 } }],
      edges: [{ id: 'e1', source: '1', target: '2', data: { length: 2 } }],
    };
    vi.mocked(usePlannerStore).mockImplementation((selector: any) => selector(selectedState));

    render(<ExpertPanel />);

    // Open the panel
    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Aktuelle Empfehlung/)).toBeInTheDocument();
    expect(screen.getByText("Kabelquerschnitt")).toBeInTheDocument();
    expect(screen.getByText("Max. Sicherung")).toBeInTheDocument();
    // I = 1000 / 12 / 0.85 = 98.03 A -> expected current
    expect(screen.getByText(/98\.0 A/)).toBeInTheDocument();
  });

  it('calculates live recommendations for solar', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'solar', data: { watts: 200 } }],
      edges: [{ id: 'e1', source: '1', target: '2', data: { length: 5 } }],
    };
    vi.mocked(usePlannerStore).mockImplementation((selector: any) => selector(selectedState));

    render(<ExpertPanel />);

    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // I = 200 / 18 = 11.11A
    expect(screen.getByText(/11\.1 A/)).toBeInTheDocument();
  });

  it('toggles tip sections', () => {
    const selectedState = {
      selectedNodes: [{ id: '1', type: 'battery', data: {} }],
      edges: [],
    };
    vi.mocked(usePlannerStore).mockImplementation((selector: any) => selector(selectedState));

    render(<ExpertPanel />);

    const toggleBtn = screen.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    fireEvent.click(toggleBtn);

    // The first tip should be expanded by default (index 0)
    // We should see its body text
    expect(screen.getByText("LiFePO4-Akkus haben eine nutzbare Kapazität von ca. 95 % Entladetiefe (DoD), AGM nur ~50%. Eine 100Ah LiFePO4 ersetzt also eine 200Ah AGM.")).toBeInTheDocument();

    // Click the second tip
    const secondTipHeading = screen.getByText("Kabelquerschnitt zur Batterie");
    fireEvent.click(secondTipHeading);

    // Should now see the second tip body
    expect(screen.getByText(/Die Zuleitung zur Batterie muss den maximalen Entladestrom tragen/)).toBeInTheDocument();
  });
});
