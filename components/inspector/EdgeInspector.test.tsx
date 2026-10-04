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

/**
 * V2-INTENT-002: Ohne diesen Schalter war die Absicht des Nutzers im Modell
 * vorhanden, aber unerreichbar — jede gezogene Leitung blieb Freiwild für
 * den nächsten Auto-Wire-Lauf.
 */
describe('V2-INTENT-002: Verbindlichkeit', () => {
  const edge = (data: CableEdgeData): Edge<CableEdgeData> => ({
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    data,
  });

  it('zeigt den Schalter nur, wenn der Aufrufer ihn bedienen kann', () => {
    render(<EdgeInspector edge={edge({})} onChangeLength={vi.fn()} />);
    expect(screen.queryByRole('radiogroup', { name: 'Verbindlichkeit' })).toBeNull();
  });

  it('eine selbst gezogene Leitung steht auf „Meine Entscheidung“', () => {
    render(
      <EdgeInspector edge={edge({ autoWired: false })} onChangeLength={vi.fn()} onChangeIntent={vi.fn()} />
    );
    expect(screen.getByTestId('edge-intent-user')).toHaveAttribute('aria-checked', 'true');
  });

  it('eine Auto-Kante steht auf „Automatik“', () => {
    render(
      <EdgeInspector edge={edge({ autoWired: true })} onChangeLength={vi.fn()} onChangeIntent={vi.fn()} />
    );
    expect(screen.getByTestId('edge-intent-auto')).toHaveAttribute('aria-checked', 'true');
  });

  it('die Sperre schlägt ein widersprüchliches Etikett (gleiche Ableitung wie AutoWire)', () => {
    render(
      <EdgeInspector
        edge={edge({ locked: true, intent: 'auto' })}
        onChangeLength={vi.fn()}
        onChangeIntent={vi.fn()}
      />
    );
    expect(screen.getByTestId('edge-intent-locked')).toHaveAttribute('aria-checked', 'true');
  });

  it('meldet die Wahl mit Kanten-ID weiter', () => {
    const onChangeIntent = vi.fn();
    render(<EdgeInspector edge={edge({})} onChangeLength={vi.fn()} onChangeIntent={onChangeIntent} />);
    fireEvent.click(screen.getByTestId('edge-intent-locked'));
    expect(onChangeIntent).toHaveBeenCalledWith('edge-1', 'locked');
  });
});
