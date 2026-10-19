import { beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Inspector from './Inspector';
import { type Edge } from '@xyflow/react';
import { type CableEdgeData } from './edges/CableEdge';

describe('Inspector Component', () => {
  const mockOnChangeLength = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Selection', () => {
    it('renders the electrical routing legend when no edge or node is selected', () => {
      render(<Inspector selectedEdge={null} onChangeLength={mockOnChangeLength} viewMode="electric" />);

      expect(screen.getByText('Kein Element ausgewählt')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Leitungs-Legende' })).toBeInTheDocument();
      expect(screen.getByText('12 V DC · Plus')).toBeInTheDocument();
      expect(screen.getByText('12 V DC · Minus')).toBeInTheDocument();
      expect(screen.getByText('230 V AC')).toBeInTheDocument();
      expect(screen.getByText('Solar')).toBeInTheDocument();
      expect(screen.getByText(/Kabel verlaufen rechtwinklig/)).toBeInTheDocument();
    });

    it('shows the water routing legend in water view', () => {
      render(<Inspector selectedEdge={null} onChangeLength={mockOnChangeLength} viewMode="water" />);

      expect(screen.getByRole('heading', { name: 'Rohr-Legende' })).toBeInTheDocument();
      expect(screen.getByText('Frischwasser')).toBeInTheDocument();
      expect(screen.getByText('Abwasser')).toBeInTheDocument();
      expect(screen.getByText(/Rohre verlaufen rechtwinklig/)).toBeInTheDocument();
      expect(screen.queryByText('12 V DC · Plus')).not.toBeInTheDocument();
    });
  });

  describe('Edge Selection', () => {
    it('renders length input when an edge is selected', () => {
      const mockEdge: Edge<CableEdgeData> = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        data: { length: 5 },
      };

      render(<Inspector selectedEdge={mockEdge} onChangeLength={mockOnChangeLength} />);

      expect(screen.queryByText('Kein Kabel ausgewählt')).not.toBeInTheDocument();

      const lengthInput = screen.getByLabelText(/Länge \(m\)/i);
      expect(lengthInput).toBeInTheDocument();
      expect(lengthInput).toHaveValue('5');
      expect(lengthInput).toHaveAttribute('inputmode', 'decimal');
    });

    it('calls onChangeLength when length input changes', () => {
      const mockEdge: Edge<CableEdgeData> = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        data: { length: 5 },
      };

      render(<Inspector selectedEdge={mockEdge} onChangeLength={mockOnChangeLength} />);

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

      render(<Inspector selectedEdge={mockEdge} onChangeLength={mockOnChangeLength} />);

      const lengthInput = screen.getByLabelText(/Länge \(m\)/i);
      expect(lengthInput).toHaveValue('3'); // Default length is 3 (Textfeld seit B-01)
    });

    it('does not call onChangeLength when input is NaN', () => {
      const mockEdge: Edge<CableEdgeData> = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        data: { length: 5, crossSection: 4 },
      };

      render(<Inspector selectedEdge={mockEdge} onChangeLength={mockOnChangeLength} />);

      const lengthInput = screen.getByLabelText(/Länge \(m\)/i);
      fireEvent.change(lengthInput, { target: { value: '' } });

      expect(mockOnChangeLength).not.toHaveBeenCalled();
    });
  });
});
