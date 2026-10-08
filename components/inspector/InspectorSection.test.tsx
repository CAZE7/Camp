import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Inspector from '../Inspector';
import { InspectorSection } from './InspectorSection';
import { type PlannerFlowNode } from '../nodes/types';

/**
 * Eigenschafts-Sektionen: Schlüsselwerte stehen offen, erweiterte Werte sind
 * eingeklappt. Geprüft wird die Bedienung (aria-expanded + Sichtbarkeit des
 * Rumpfes) und die Zuordnung der Batteriefelder auf die Sektionen.
 */
describe('InspectorSection', () => {
  it('startet eingeklappt und lässt sich öffnen und schließen', () => {
    render(
      <InspectorSection title="Berechnung">
        <span>Peukert-Exponent (k)</span>
      </InspectorSection>
    );

    const toggle = screen.getByRole('button', { name: /Berechnung/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Peukert-Exponent (k)')).not.toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Peukert-Exponent (k)')).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Peukert-Exponent (k)')).not.toBeVisible();
  });

  it('ist mit defaultOpen sofort offen', () => {
    render(
      <InspectorSection title="Elektrisch" defaultOpen>
        <span>Kapazität (Ah)</span>
      </InspectorSection>
    );

    expect(screen.getByRole('button', { name: /Elektrisch/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Kapazität (Ah)')).toBeVisible();
  });

  it('verbindet Kopf und Rumpf über aria-controls', () => {
    render(
      <InspectorSection title="Anschluss" defaultOpen>
        <span>BMS Dauerentladung (A)</span>
      </InspectorSection>
    );

    const toggle = screen.getByRole('button', { name: /Anschluss/i });
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toBeTruthy();
  });
});

describe('Inspector — Sektionen je Knotentyp', () => {
  const batteryNode = {
    id: 'bat-1',
    type: 'battery',
    position: { x: 0, y: 0 },
    data: { label: 'Batterie', capacity: 100 },
  } as unknown as PlannerFlowNode;

  it('gruppiert die Batterie in Elektrisch, Anschluss und Berechnung', () => {
    render(<Inspector selectedNode={batteryNode} onDelete={vi.fn()} onUpdateNode={vi.fn()} />);

    // Schlüsselwerte offen …
    expect(screen.getByRole('button', { name: /^Elektrisch$/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Kapazität (Ah)')).toBeVisible();

    // … Spezialwerte erst auf Klick.
    const anschluss = screen.getByRole('button', { name: /^Anschluss$/ });
    const berechnung = screen.getByRole('button', { name: /^Berechnung$/ });
    expect(anschluss).toHaveAttribute('aria-expanded', 'false');
    expect(berechnung).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Peukert-Exponent (k)')).not.toBeVisible();

    fireEvent.click(berechnung);
    expect(screen.getByLabelText('Peukert-Exponent (k)')).toBeVisible();
  });

  it('lässt einfache Verbraucher in einer offenen Sektion', () => {
    const consumerNode = {
      id: 'con-1',
      type: 'consumer',
      position: { x: 0, y: 0 },
      data: { label: 'Kühlschrank', watts: 60, hours: 8 },
    } as unknown as PlannerFlowNode;

    render(<Inspector selectedNode={consumerNode} onDelete={vi.fn()} onUpdateNode={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^Elektrisch$/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Leistung (W)')).toBeVisible();
    expect(screen.getByLabelText('Nutzung (h/Tag)')).toBeVisible();
  });
});
