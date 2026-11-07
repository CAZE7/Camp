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

  it('zeigt den Datenblatt-Prüfstrom I₂ und meldet Änderungen', () => {
    const onChangeFuseI2 = vi.fn();
    render(
      <EdgeInspector
        edge={{ ...defaultEdge, data: { fuseSize: 40, fuseType: 'midi', i2A: 54 } }}
        onChangeLength={mockOnChangeLength}
        onChangeFuseI2={onChangeFuseI2}
      />
    );

    const input = screen.getByLabelText(/Prüfstrom I₂/i) as HTMLInputElement;
    expect(input.value).toBe('54');

    fireEvent.change(input, { target: { value: '60' } });
    expect(onChangeFuseI2).toHaveBeenCalledWith('edge-1', 60);
  });

  it('leert den Prüfstrom, damit wieder die Produktnorm gilt', () => {
    const onChangeFuseI2 = vi.fn();
    render(
      <EdgeInspector
        edge={{ ...defaultEdge, data: { fuseSize: 40, fuseType: 'midi', i2A: 54 } }}
        onChangeLength={mockOnChangeLength}
        onChangeFuseI2={onChangeFuseI2}
      />
    );

    fireEvent.change(screen.getByLabelText(/Prüfstrom I₂/i), { target: { value: '' } });
    expect(onChangeFuseI2).toHaveBeenCalledWith('edge-1', 0);
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

describe('EdgeInspector — AC-Schutzorgan: Polzahl und FI-Typ', () => {
  const acEdge = (data: CableEdgeData): Edge<CableEdgeData> => ({
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    data,
  });

  it('meldet die gewählte Polzahl und behält die übrigen Descriptor-Felder', () => {
    const onChangeAcProtection = vi.fn();
    render(
      <EdgeInspector
        edge={acEdge({
          edgeDomain: 'AC_230V',
          fuseSize: 16,
          acProtection: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 },
        })}
        onChangeLength={vi.fn()}
        onChangeAcProtection={onChangeAcProtection}
      />
    );

    fireEvent.change(screen.getByLabelText(/Polzahl/i), { target: { value: '2' } });
    expect(onChangeAcProtection).toHaveBeenCalledWith(
      'edge-1',
      expect.objectContaining({ kind: 'mcb', characteristic: 'B', poles: 2 })
    );
  });

  it('weist im 230-V-Block auf die Modellgrenzen hin (NET-003)', () => {
    render(
      <EdgeInspector
        edge={acEdge({
          edgeDomain: 'AC_230V',
          fuseSize: 16,
          acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 },
        })}
        onChangeLength={vi.fn()}
        onChangeAcProtection={vi.fn()}
      />
    );
    const note = screen.getByTestId('edge-230v-scope-note');
    expect(note).toHaveTextContent('NET-003');
    expect(note).toHaveTextContent('Rückspeiseschutz');
    expect(note).toHaveTextContent('qualifiziertes Personal');
  });

  it('meldet den Fehlerstromtyp des RCBO und behält die übrigen Felder', () => {
    const onChangeAcProtection = vi.fn();
    render(
      <EdgeInspector
        edge={acEdge({
          edgeDomain: 'AC_230V',
          fuseSize: 16,
          acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 },
        })}
        onChangeLength={vi.fn()}
        onChangeAcProtection={onChangeAcProtection}
      />
    );

    fireEvent.change(screen.getByLabelText(/Fehlerstromtyp/i), { target: { value: 'B' } });
    expect(onChangeAcProtection).toHaveBeenCalledWith(
      'edge-1',
      expect.objectContaining({ kind: 'rcbo', residualType: 'B' })
    );
  });
});

/** P0-3: Verlegebedingungen sind im Inspektor auswählbar und erklärt. */
describe('EdgeInspector — Verlegebedingungen (P0-3)', () => {
  const edge: Edge<CableEdgeData> = {
    id: 'edge-cond',
    source: 'n1',
    target: 'n2',
    data: { crossSection: 10, edgeDomain: 'DC_12V' },
  };

  it('zeigt Referenzmodell, I_z und einen Wechsel auf Motorraum an', () => {
    const onChange = vi.fn();
    render(<EdgeInspector edge={edge} onChangeLength={vi.fn()} onChangeCableConditions={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Verlegebedingungen/i }));

    expect(screen.getByText(/rechnerisch mit Referenzmodell bewertet/i)).toBeInTheDocument();
    expect(screen.getByText(/36,4 A/)).toBeInTheDocument(); // 52 A × 0,7 für 10 mm²
    const select = screen.getByLabelText(/Einbausituation/i);
    fireEvent.change(select, { target: { value: 'engine-bay' } });
    expect(onChange).toHaveBeenCalledWith('edge-cond', { installationCondition: 'engine-bay' });
  });

  it('nennt bei gewählter Bedingung die Annahmen und Datengrundlage', () => {
    const withEngine: Edge<CableEdgeData> = {
      ...edge,
      data: { ...edge.data, installationCondition: 'engine-bay' },
    };
    render(<EdgeInspector edge={withEngine} onChangeLength={vi.fn()} onChangeCableConditions={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Verlegebedingungen/i }));
    expect(screen.getByText(/mit Annahmen bewertet/i)).toBeInTheDocument();
    expect(screen.getByText(/IEC 60364-5-52/)).toBeInTheDocument();
    expect(screen.getByText(/26,0 A/)).toBeInTheDocument(); // 52 A × 0,5 bei 60 °C
  });
});

/**
 * AUD-003 — die Herkunft der Belastbarkeitstabelle muss sichtbar sein.
 *
 * „Referenzmodell bewertet" sagt nicht, WOHER die Tabelle kommt. Die verwendete
 * Tabelle ist eine Hausinstallationstabelle (DIN VDE 0298-4, Verlegeart B2),
 * keine geprüfte Fahrzeugleitungs-Tabelle nach ISO 6722 / FLRY. Ohne diesen
 * Hinweis wirkt die Zahl fahrzeugspezifisch, obwohl sie es nicht ist.
 *
 * Es wird KEIN Zahlenwert geändert — nur die Herkunft benannt. Der Escape-Hatch
 * `manufacturerIzA` bleibt der Weg zu einer belegten Auslegung; bei gesetztem
 * Datenblattwert ist der Tabellenhinweis gegenstandslos und entfällt.
 */
describe('AUD-003 — Herkunft der Belastbarkeitstabelle', () => {
  const edge: Edge<CableEdgeData> = {
    id: 'edge-basis',
    source: 'n1',
    target: 'n2',
    data: { crossSection: 10, edgeDomain: 'DC_12V' },
  };

  it('nennt Hausinstallation und die fehlende Fahrzeugnorm bei Tabellenrechnung', () => {
    render(<EdgeInspector edge={edge} onChangeLength={vi.fn()} onChangeCableConditions={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Verlegebedingungen/i }));

    const basis = screen.getByTestId('cable-ampacity-basis');
    expect(basis.textContent).toMatch(/DIN VDE 0298-4/);
    expect(basis.textContent).toMatch(/ISO 6722/);
    expect(basis.textContent).toMatch(/Hausinstallation/);
  });

  it('nennt die Tabellengrenze auch bei gewählter Einbausituation', () => {
    const withEngine: Edge<CableEdgeData> = {
      ...edge,
      data: { ...edge.data, installationCondition: 'engine-bay' },
    };
    render(<EdgeInspector edge={withEngine} onChangeLength={vi.fn()} onChangeCableConditions={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Verlegebedingungen/i }));
    expect(screen.getByTestId('cable-ampacity-basis').textContent).toMatch(/ISO 6722/);
  });

  it('entfällt bei hinterlegter Herstellerangabe — dann gilt nicht die Tabelle', () => {
    const withDatasheet: Edge<CableEdgeData> = {
      ...edge,
      data: { ...edge.data, installationCondition: 'datasheet', manufacturerIzA: 70 },
    };
    render(<EdgeInspector edge={withDatasheet} onChangeLength={vi.fn()} onChangeCableConditions={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Verlegebedingungen/i }));
    expect(screen.getByText(/Herstellerangabe hinterlegt/i)).toBeInTheDocument();
    expect(screen.queryByTestId('cable-ampacity-basis')).not.toBeInTheDocument();
  });
});
