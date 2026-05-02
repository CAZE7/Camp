import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Inspector from './Inspector';
import { Edge } from 'reactflow';
import { CableEdgeData } from './edges/CableEdge';

describe('Inspector Component', () => {
  const mockOnChangeLength = vi.fn();
  const mockOnChangeCrossSection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Kein Element ausgewählt" when no edge or node is selected', () => {
    render(
      <Inspector
        selectedEdge={null}
        onChangeLength={mockOnChangeLength}
        onChangeCrossSection={mockOnChangeCrossSection}
      />
    );

    expect(screen.getByText('Kein Element ausgewählt')).toBeInTheDocument();
  });

  it('renders length input when an edge is selected', () => {
    const mockEdge: Edge<CableEdgeData> = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      data: { length: 5 },
    };

    render(
      <Inspector
        selectedEdge={mockEdge}
        onChangeLength={mockOnChangeLength}
        onChangeCrossSection={mockOnChangeCrossSection}
      />
    );

    expect(screen.queryByText('Kein Kabel ausgewählt')).not.toBeInTheDocument();

    const lengthInput = screen.getByLabelText(/Länge \(m\)/i);
    expect(lengthInput).toBeInTheDocument();
    expect(lengthInput).toHaveValue(5);
  });

  it('calls onChangeLength when length input changes', () => {
    const mockEdge: Edge<CableEdgeData> = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      data: { length: 5 },
    };

    render(
      <Inspector
        selectedEdge={mockEdge}
        onChangeLength={mockOnChangeLength}
        onChangeCrossSection={mockOnChangeCrossSection}
      />
    );

    const lengthInput = screen.getByLabelText(/Länge \(m\)/i);
    fireEvent.change(lengthInput, { target: { value: '7.5' } });

    expect(mockOnChangeLength).toHaveBeenCalledTimes(1);
    expect(mockOnChangeLength).toHaveBeenCalledWith('edge-1', 7.5);
  });

  it('uses default values when edge data is missing', () => {
    const mockEdge: Edge<CableEdgeData> = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      // Missing data
    };

    render(
      <Inspector
        selectedEdge={mockEdge}
        onChangeLength={mockOnChangeLength}
        onChangeCrossSection={mockOnChangeCrossSection}
      />
    );

    const lengthInput = screen.getByLabelText(/Länge \(m\)/i);
    expect(lengthInput).toHaveValue(3); // Default length is 3
  });

  it('does not call onChangeLength when input is NaN', () => {
    const mockEdge: Edge<CableEdgeData> = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      data: { length: 5, crossSection: 4 },
    };

    render(
      <Inspector
        selectedEdge={mockEdge}
        onChangeLength={mockOnChangeLength}
        onChangeCrossSection={mockOnChangeCrossSection}
      />
    );

    const lengthInput = screen.getByLabelText(/Länge \(m\)/i);
    fireEvent.change(lengthInput, { target: { value: '' } });

    expect(mockOnChangeLength).not.toHaveBeenCalled();
  });
});
