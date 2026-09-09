import React, { act } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';
import { CableListModal } from './CableListModal';
import { type ValidationWarning } from '../hooks/useLiveValidation';

// --- Fixtures ---

const nodes: Node[] = [
  { id: 'battery-1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie 100 Ah' } },
  { id: 'consumer-1', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'Kühlbox' } },
  { id: 'ground-1', type: 'ground', position: { x: 0, y: 0 }, data: { label: 'Massepunkt' } },
];

const edges: Edge<CableEdgeData>[] = [
  {
    id: 'e-cool-plus',
    source: 'battery-1',
    target: 'consumer-1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: { edgeDomain: 'DC_12V', length: 5, crossSection: 4, fuseSize: 15 },
  },
  {
    id: 'e-cool-minus',
    source: 'consumer-1',
    target: 'battery-1',
    sourceHandle: 'minus',
    targetHandle: 'minus',
    type: 'cableEdge',
    data: { edgeDomain: 'DC_12V', length: 5, crossSection: 4 },
  },
  {
    id: 'e-gnd',
    source: 'battery-1',
    target: 'ground-1',
    sourceHandle: 'minus',
    targetHandle: 'minus',
    type: 'cableEdge',
    data: { edgeDomain: 'DC_12V', length: 1, crossSection: 10 },
  },
];

let currentPlan: { nodes: Node[]; edges: Edge<CableEdgeData>[] } = { nodes, edges };
const focusElement = vi.fn();

vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: {
    getState: () => ({ nodes: currentPlan.nodes, edges: currentPlan.edges, focusElement }),
  },
}));

let mockWarnings: ValidationWarning[] = [];
vi.mock('../hooks/useLiveValidation', () => ({
  computeValidationWarnings: () => mockWarnings,
  useLiveValidation: () => mockWarnings,
}));

const openList = () => {
  act(() => {
    window.dispatchEvent(new Event('show-cable-list'));
  });
};

describe('CableListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPlan = { nodes, edges };
    mockWarnings = [
      {
        id: 'missing-fuse-e-cool-plus',
        category: 'safety',
        type: 'critical',
        title: 'Sicherung fehlt',
        focusId: 'e-cool-plus',
        focusType: 'edge',
        message: 'Kritisch: Sicherung fehlt',
      },
    ];
  });

  it('zeigt eine Zeile pro Leitung mit Status (Paar gebündelt, Minus einzeln)', async () => {
    render(<CableListModal />);
    openList();

    await waitFor(() => expect(screen.getByRole('dialog', { name: /Kabelliste/ })).toBeInTheDocument());

    const rows = screen
      .getAllByRole('row')
      .filter((element) => element.tagName === 'TR')
      .slice(1);
    expect(rows).toHaveLength(2);

    // Paar-Zeile: Adern 2, Sicherung von der Plus-Leitung, Status kritisch.
    const pairRow = screen.getByTestId('cable-row-e-cool-plus');
    expect(within(pairRow).getByText('2')).toBeInTheDocument();
    expect(within(pairRow).getByText('15 A')).toBeInTheDocument();
    expect(within(pairRow).getByText('Kritisch')).toBeInTheDocument();
    // Einzel-Minus-Rückleitung: Adern 1, Status OK.
    const singleRow = screen.getByTestId('cable-row-e-gnd');
    expect(within(singleRow).getByText('OK')).toBeInTheDocument();
    expect(within(singleRow).getByText('Massepunkt')).toBeInTheDocument();
  });

  it('fokussiert die Kante im Plan und schließt beim Zeilen-Klick (Zeile↔Kante-Sync)', async () => {
    render(<CableListModal />);
    openList();
    await waitFor(() => expect(screen.getByRole('dialog', { name: /Kabelliste/ })).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('cable-row-e-gnd'));
    expect(focusElement).toHaveBeenCalledWith('e-gnd', 'edge');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sortiert per Spaltenkopf (Adern aufsteigend: Einzeladern vor Paar)', async () => {
    render(<CableListModal />);
    openList();
    await waitFor(() => expect(screen.getByRole('dialog', { name: /Kabelliste/ })).toBeInTheDocument());

    const firstBodyRow = () => screen.getAllByRole('row').filter((element) => element.tagName === 'TR')[1];
    // Initial: Von = Batterie für beide, Tie-Breaker Nach-Label → Kühlbox vor Massepunkt.
    expect(firstBodyRow()).toHaveTextContent('Kühlbox');

    fireEvent.click(screen.getByRole('button', { name: /Adern/ }));
    expect(firstBodyRow()).toHaveTextContent('Massepunkt');
  });

  it('filtert per Suche', async () => {
    render(<CableListModal />);
    openList();
    await waitFor(() => expect(screen.getByRole('dialog', { name: /Kabelliste/ })).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Von, Nach, Funktion/), { target: { value: 'Kühlbox' } });
    expect(
      screen
        .getAllByRole('row')
        .filter((element) => element.tagName === 'TR')
        .slice(1)
    ).toHaveLength(1);
    expect(screen.getByTestId('cable-row-e-cool-plus')).toBeInTheDocument();
  });

  it('zeigt einen Empty-State ohne Leitungen', async () => {
    currentPlan = { nodes, edges: [] };
    render(<CableListModal />);
    openList();
    await waitFor(() => expect(screen.getByRole('dialog', { name: /Kabelliste/ })).toBeInTheDocument());
    expect(screen.getByText(/Noch keine Leitungen/)).toBeInTheDocument();
  });
});
