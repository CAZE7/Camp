import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeizungErklaerung } from './HeizungErklaerung';

/**
 * Der Erklärblock zum Heizlast-Rechner wird gegen das Modell im Werkzeug
 * geprüft: Wer die Zahlen im Text nachrechnet, muss auf dieselben kommen.
 */
describe('HeizungErklaerung', () => {
  it('nennt die Abschnitte in der richtigen Reihenfolge', () => {
    render(<HeizungErklaerung />);

    const headings = screen
      .getAllByRole('heading')
      .map((heading) => heading.textContent?.trim())
      .filter((text): text is string => Boolean(text));

    expect(headings[0]).toBe('Der Heizlast-Rechner: Wärmeverluste, Dämmung und Heizleistung');
    expect(headings).toEqual(
      expect.arrayContaining([
        'Die zwei Verlustwege',
        'U-Wert und Transmission',
        'Lüftung',
        'Beispielrechnung',
        'Was das Ergebnis bedeutet',
        'Grenzen',
        'Weiter im Schaltplan',
      ])
    );
  });

  it('rechnet das Beispiel mit den Werten des Werkzeugs nach', () => {
    render(<HeizungErklaerung />);

    // Ducato L1H1: 2,67 m × 1,87 m × 1,66 m, daraus 8,29 m³ und 25,06 m² Fläche
    expect(screen.getByText(/8,29 m³/)).toBeInTheDocument();
    expect(screen.getByText(/25,06 m²/)).toBeInTheDocument();
    // Ergebnis der Rechnung: 2 090 W + 55 W ≈ 2,1 kW
    expect(screen.getByText(/2 090 W/)).toBeInTheDocument();
    expect(screen.getByText('2,1 kW')).toBeInTheDocument();
  });

  it('nennt die Modellwerte, mit denen das Werkzeug rechnet', () => {
    render(<HeizungErklaerung />);

    expect(screen.getByText(/5,88 W\/\(m²·K\)/)).toBeInTheDocument();
    expect(screen.getByText(/1,43 W\/\(m²·K\)/)).toBeInTheDocument();
    expect(screen.getByText('Q̇_L = n · V · 0,34 Wh/(m³·K) · ΔT')).toBeInTheDocument();
  });

  it('verweist auf den Schaltplan und den Ausbau-Fahrplan', () => {
    render(<HeizungErklaerung />);

    expect(screen.getByRole('link', { name: 'Camper-Elektroplaner' }).getAttribute('href')).toMatch(
      /^\/planer\/?$/
    );
    expect(screen.getByRole('link', { name: 'Ausbau-Fahrplan' }).getAttribute('href')).toMatch(
      /^\/guides\/ausbau-fahrplan\/?$/
    );
    expect(screen.getByRole('link', { name: 'Elektrik-Hub' }).getAttribute('href')).toMatch(
      /^\/camper-elektrik\/?$/
    );
  });

  it('nennt den inhaltlichen Stand sichtbar', () => {
    render(<HeizungErklaerung />);

    expect(screen.getByText(/Inhaltlicher Stand: 2026-10/)).toBeInTheDocument();
  });
});
