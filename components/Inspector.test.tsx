import { beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Inspector from './Inspector';
import { type Edge } from '@xyflow/react';
import { type CableEdgeData } from './edges/CableEdge';

// §10 B6: `requestConfirm` ist ein imperativer Modul-Dialog; in jsdom hängt kein
// ConfirmDialogHost, also wird der Rückfrage-Aufruf selbst beobachtet. Die
// übrigen Exporte bleiben erhalten.
const { rückfrage } = vi.hoisted(() => ({
  rückfrage: vi.fn((_meldung: string) => Promise.resolve(false)),
}));
vi.mock('./ui/ConfirmDialog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ui/ConfirmDialog')>()),
  requestConfirm: rückfrage,
}));

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

  describe('Löschen: Statusfarbe niemals als Füllung (§10, Befund B6)', () => {
    // Die zwei Löschaktionen sind die einzigen echten Zerstörungsaktionen im
    // Planer und bisher die einzigen gefüllten `variant="destructive"`-Knöpfe.
    // Freigegebene Richtung (2026-11-04): Umriss in Fehlerfarbe — kein
    // gefüllter Knopf, aber weiterhin eindeutig benannt.
    const knoten = {
      id: 'bat-1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { label: 'Aufbaubatterie' },
    } as never;

    const leitung = {
      id: 'e-1',
      source: 'bat-1',
      target: 'load-1',
      type: 'cable',
      data: { length: 4.2 },
    } as never;

    const loeschKnopfErwarten = (button: HTMLElement) => {
      // Verboten ist die Fläche in Fehlerfarbe — ein Taston (`hover:`) ist keine
      // Füllung. `(?:^|\s)` lässt `hover:bg-destructive/10` zu.
      expect(button.className, 'Füllung wäre ein Status als Primärknopf').not.toMatch(
        /(?:^|\s)bg-destructive/
      );
      expect(button.className).not.toMatch(/text-destructive-foreground/);
      expect(button.className).toMatch(/border-destructive/);
      expect(button.className).toMatch(/(?:^|\s)text-destructive/);
    };

    it('renders the node delete action as an outlined error button, not a filled one', () => {
      render(<Inspector selectedNode={knoten} onDeleteNode={vi.fn()} />);
      loeschKnopfErwarten(screen.getByRole('button', { name: /^Löschen$/ }));
    });

    it('renders the edge delete action as an outlined error button, not a filled one', () => {
      render(<Inspector selectedEdge={leitung} onChangeLength={mockOnChangeLength} onDelete={vi.fn()} />);
      loeschKnopfErwarten(screen.getByRole('button', { name: /^Löschen$/ }));
    });

    it('keeps the destructive path named and confirmed', async () => {
      const onDeleteNode = vi.fn();
      render(<Inspector selectedNode={knoten} onDeleteNode={onDeleteNode} />);
      fireEvent.click(screen.getByRole('button', { name: /^Löschen$/ }));
      // Die Rückfrage ist der benannte Weg; ohne sie wäre der Knopf gefährlich.
      // `requestConfirm` ist ein imperativer Modul-Dialog — in jsdom erscheint
      // kein role="dialog", geprüft wird deshalb der Aufruf selbst.
      await waitFor(() => expect(rückfrage).toHaveBeenCalledTimes(1));
      expect(rückfrage.mock.calls[0]?.[0]).toMatch(/wirklich löschen\?/);
      expect(onDeleteNode).not.toHaveBeenCalled();
    });
  });
});
