import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CableEdgeData } from '../edges/CableEdge';
import { EdgeInspector } from './EdgeInspector';

describe('EdgeInspector Component', () => {
  const mockOnChangeLength = vi.fn();

  const defaultEdge: Edge<CableEdgeData> = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    data: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default length (3) when no data length provided', () => {
    render(<EdgeInspector edge={defaultEdge} onChangeLength={mockOnChangeLength} />);

    const input = screen.getByLabelText(/Länge/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('3');
  });

  it('nennt eine Planungsannahme beim Namen (dreißigste Fassung)', () => {
    // AutoWire legt Längen als Annahme an. Vorher stand so ein Wert im
    // Inspektor wie eine Nutzereingabe da; jetzt steht dabei, dass er keine ist.
    const edgeWithAssumption = { ...defaultEdge, data: { length: 3, lengthIsAssumption: true } };
    render(<EdgeInspector edge={edgeWithAssumption} onChangeLength={mockOnChangeLength} />);

    expect(screen.getByText(/Planungsannahme aus der Vorlage/i)).toBeInTheDocument();
  });

  it('schweigt über Annahmen, wenn der Wert vom Nutzer stammt', () => {
    const edgeWithOwnLength = { ...defaultEdge, data: { length: 3, lengthIsAssumption: false } };
    render(<EdgeInspector edge={edgeWithOwnLength} onChangeLength={mockOnChangeLength} />);

    expect(screen.queryByText(/Planungsannahme aus der Vorlage/i)).not.toBeInTheDocument();
  });

  it('renders correctly with provided length', () => {
    const edgeWithLength = { ...defaultEdge, data: { length: 5.5 } };
    render(<EdgeInspector edge={edgeWithLength} onChangeLength={mockOnChangeLength} />);

    const input = screen.getByLabelText(/Länge/i) as HTMLInputElement;
    expect(input.value).toBe('5.5');
  });

  it('calls onChangeLength when input value changes to a valid number', () => {
    render(<EdgeInspector edge={defaultEdge} onChangeLength={mockOnChangeLength} />);

    const input = screen.getByLabelText(/Länge/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4.2' } });

    expect(mockOnChangeLength).toHaveBeenCalledTimes(1);
    expect(mockOnChangeLength).toHaveBeenCalledWith('edge-1', 4.2);
  });

  it('does not call onChangeLength when input value is invalid (NaN)', () => {
    render(<EdgeInspector edge={defaultEdge} onChangeLength={mockOnChangeLength} />);

    const input = screen.getByLabelText(/Länge/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    expect(mockOnChangeLength).not.toHaveBeenCalled();
  });
});
