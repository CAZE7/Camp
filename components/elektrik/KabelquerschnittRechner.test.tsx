import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KabelquerschnittRechner } from './KabelquerschnittRechner';

/**
 * Der Rechner ist mit dem Umzug von `/elektrik-planung/` nach
 * `/camper-elektrik/` gewandert. Seine Prüfungen sind mitgewandert: Sie
 * standen vorher im Seitentest und werden hier direkt am Bauteil
 * festgehalten — die Rechnung selbst liegt in `lib/cableSizing.ts`.
 */
describe('KabelquerschnittRechner', () => {
  it('verknüpft jedes Eingabefeld mit Beschriftung und Hilfetext', () => {
    render(<KabelquerschnittRechner />);

    const current = screen.getByLabelText('Betriebsstrom I in Ampere');
    const length = screen.getByLabelText('Einfache Leitungslänge L in Metern');

    for (const field of [current, length]) {
      expect(field).toHaveAttribute('type', 'number');
      expect(field).toHaveAttribute('inputmode', 'decimal');

      const describedBy = field.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).not.toBeNull();
    }
  });

  it('nennt nach der Eingabe Querschnitt, Spannungsfall und Sicherung', () => {
    render(<KabelquerschnittRechner />);

    fireEvent.change(screen.getByLabelText('Betriebsstrom I in Ampere'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Einfache Leitungslänge L in Metern'), { target: { value: '5' } });

    const result = screen.getByRole('status');
    expect(result).toHaveTextContent('6,0 mm²');
    expect(result).toHaveTextContent('0,29 V');
    expect(result).toHaveTextContent('10 A');
  });

  it('meldet Eingaben außerhalb der Normreihe sichtbar', () => {
    render(<KabelquerschnittRechner />);

    fireEvent.change(screen.getByLabelText('Betriebsstrom I in Ampere'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Einfache Leitungslänge L in Metern'), {
      target: { value: '10' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Außerhalb der Normreihe');
  });

  it('meldet unbrauchbare Eingaben, statt sie als null zu behandeln', () => {
    render(<KabelquerschnittRechner />);

    fireEvent.change(screen.getByLabelText('Betriebsstrom I in Ampere'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Einfache Leitungslänge L in Metern'), { target: { value: '5' } });

    expect(screen.getByRole('status')).toHaveTextContent('größer als null');
  });
});
