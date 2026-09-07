import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Edge } from 'reactflow';
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

  it('renders correctly with provided length', () => {
    const edgeWithLength = { ...defaultEdge, data: { length: 5.5 } };
    render(<EdgeInspector edge={edgeWithLength} onChangeLength={mockOnChangeLength} />);

    const input = screen.getByLabelText(/Länge/i) as HTMLInputElement;
    expect(input.value).toBe('5.5');
  });

  it('calls onChangeLength when input value changes to a valid number', () => {
    render(<EdgeInspector edge={defaultEdge} onChangeLength={mockOnChangeLength} />);

    const input = screen.getByLabelText(/Länge/i);
    fireEvent.change(input, { target: { value: '4.2' } });

    expect(mockOnChangeLength).toHaveBeenCalledTimes(1);
    expect(mockOnChangeLength).toHaveBeenCalledWith('edge-1', 4.2);
  });

  it('does not call onChangeLength when input value is invalid (NaN)', () => {
    render(<EdgeInspector edge={defaultEdge} onChangeLength={mockOnChangeLength} />);

    const input = screen.getByLabelText(/Länge/i);
    fireEvent.change(input, { target: { value: '' } });

    expect(mockOnChangeLength).not.toHaveBeenCalled();
  });
});
