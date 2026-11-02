import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BatteriekapazitaetRechner } from './BatteriekapazitaetRechner';
import { SolaranlageRechner } from './SolaranlageRechner';
import { BATTERY_BOUNDS, SOLAR_BOUNDS, isWithinBounds, rangeMessage } from './inputBounds';

/**
 * Regressionstest Audit 2026-11-02.
 *
 * Vorher: `DecimalInput` erzwingt `type="text"`, deshalb wirkte das HTML-`max`
 * nicht. Auf der Live-Seite ergaben 840 autarke Tage (Feld sagt `max="14"`)
 * „EMPFOHLENE NENNKAPAZITÄT 77780 Ah" und ein 30.000-Wp-Panel
 * (`max="600"`) „Erwarteter Ladestrom 1666,7 A" — ohne jeden Hinweis.
 * Dazu: „1 Panels à 100 Wp" und Zahlen ohne Tausendergruppen.
 */

const status = () => screen.getByRole('status');

describe('Eingabebereiche der Rechner', () => {
  it('meldet zu viele autarke Tage statt sie durchzurechnen', () => {
    render(<BatteriekapazitaetRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Autarke Tage ohne Ladung'), { target: { value: '840' } });

    expect(status().textContent).toContain('Die Zahl autarker Tage liegt zwischen 0,5 und 14.');
    expect(status().textContent).not.toContain('Nennkapazität');
  });

  it('meldet einen Tagesbedarf über der Obergrenze', () => {
    render(<BatteriekapazitaetRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '9999999' } });

    expect(status().textContent).toContain('Der Tagesbedarf liegt zwischen 1 und 20.000 Wh.');
  });

  it('verwirft einen negativen Reservezuschlag mit Bereichsmeldung', () => {
    render(<BatteriekapazitaetRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Reserve für Alterung und Kälte in Prozent'), {
      target: { value: '-5' },
    });

    expect(status().textContent).toContain('Der Reservezuschlag liegt zwischen 0 und 50 %.');
  });

  it('meldet ein Panel über der Obergrenze statt 1.666,7 A Ladestrom zu zeigen', () => {
    render(<SolaranlageRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Panel in Wp'), { target: { value: '30000' } });

    expect(status().textContent).toContain('Ein Panel liegt zwischen 5 und 600 Wp.');
    expect(status().textContent).not.toContain('Ladestrom');
  });

  it('meldet einen spezifischen Ertrag außerhalb des Bereichs', () => {
    render(<SolaranlageRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Spezifischer Ertrag in kWh je kWp und Tag'), {
      target: { value: '400' },
    });

    expect(status().textContent).toContain('Der spezifische Ertrag liegt zwischen 0,1 und 8 kWh/kWp/Tag.');
  });

  it('lässt gültige Eingaben unverändert durchrechnen', () => {
    render(<SolaranlageRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '1000' } });

    expect(status().textContent).toContain('Nötige Modulleistung');
  });

  it('spiegelt die Bereichsgrenzen in den Feld-Attributen', () => {
    render(<BatteriekapazitaetRechner />);
    const days = screen.getByLabelText('Autarke Tage ohne Ladung') as HTMLInputElement;
    expect(days.getAttribute('min')).toBe(String(BATTERY_BOUNDS.autonomyDays.min));
    expect(days.getAttribute('max')).toBe(String(BATTERY_BOUNDS.autonomyDays.max));

    render(<SolaranlageRechner />);
    const panel = screen.getByLabelText('Panel in Wp') as HTMLInputElement;
    expect(panel.getAttribute('max')).toBe(String(SOLAR_BOUNDS.panelWatts.max));
  });
});

describe('Zahlen- und Wortformat der Rechner', () => {
  it('gruppiert Tausender in der deutschen Schreibweise', () => {
    render(<BatteriekapazitaetRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '20000' } });
    fireEvent.change(screen.getByLabelText('Autarke Tage ohne Ladung'), { target: { value: '14' } });

    expect(status().textContent).toMatch(/\d{1,3}(\.\d{3})+ Ah/);
    expect(status().textContent).not.toMatch(/\d{4,} Ah/);
  });

  it('schreibt einen Singular, wenn genau ein Panel nötig ist', () => {
    render(<SolaranlageRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '1' } });

    expect(status().textContent).toContain('1 Panel à');
    expect(status().textContent).not.toContain('1 Panels');
  });

  it('lässt den Plural ab zwei Panels stehen', () => {
    render(<SolaranlageRechner />);
    fireEvent.change(screen.getByLabelText('Tagesbedarf in Wattstunden'), { target: { value: '1000' } });

    expect(status().textContent).toMatch(/\d+ Panels à/);
  });
});

describe('inputBounds-Helfer', () => {
  it('ist an den Grenzen noch innerhalb, knapp darüber außerhalb', () => {
    expect(isWithinBounds(14, BATTERY_BOUNDS.autonomyDays)).toBe(true);
    expect(isWithinBounds(0.5, BATTERY_BOUNDS.autonomyDays)).toBe(true);
    expect(isWithinBounds(14.1, BATTERY_BOUNDS.autonomyDays)).toBe(false);
  });

  it('setzt die Einheit nur mit Leerzeichen an', () => {
    expect(rangeMessage('Der Abschlag', SOLAR_BOUNDS.deratePercent, '%')).toBe(
      'Der Abschlag liegt zwischen 0 und 70 %.'
    );
    expect(rangeMessage('Ein Panel', SOLAR_BOUNDS.panelWatts, 'Wp')).toBe(
      'Ein Panel liegt zwischen 5 und 600 Wp.'
    );
    expect(rangeMessage('Die Zahl autarker Tage', BATTERY_BOUNDS.autonomyDays)).toBe(
      'Die Zahl autarker Tage liegt zwischen 0,5 und 14.'
    );
  });
});
