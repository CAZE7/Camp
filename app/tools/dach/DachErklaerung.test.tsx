import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DachErklaerung } from './DachErklaerung';

/**
 * Der Erklärblock ist der Text, den die Dach-Seite bisher nicht hatte. Er wird
 * deshalb auf drei Punkte geprüft: dass die Abschnitte da sind, dass die
 * Zahlen zum Werkzeug passen (Safe Zone, Panelmaße) und dass er auf die
 * Seiten verweist, die es wirklich gibt.
 */
describe('DachErklaerung', () => {
  it('nennt die Abschnitte in der richtigen Reihenfolge', () => {
    render(<DachErklaerung />);

    const headings = screen
      .getAllByRole('heading')
      .map((heading) => heading.textContent?.trim())
      .filter((text): text is string => Boolean(text));

    expect(headings[0]).toBe('Der Dach-Planer: Fläche, Belegung und Solarleistung');
    expect(headings).toEqual(
      expect.arrayContaining([
        'So planst du in drei Schritten',
        'Fläche, Panel-Watt und was die Summe bedeutet',
        'Praxisbeispiel: zwei Module, ein Fenster',
        'Grenzen des Modells',
        'Weiter im Schaltplan',
      ])
    );
  });

  it('nennt die Werte, mit denen das Werkzeug rechnet', () => {
    render(<DachErklaerung />);

    // Sicherheitsbereich aus app/tools/dach/validation.ts
    expect(screen.getByText(/15 cm vorn/)).toBeInTheDocument();
    // Standardmodul aus der Seitenleiste des Werkzeugs
    expect(screen.getByText(/200 W und 100 × 60 cm/)).toBeInTheDocument();
    // Dachfläche des Beispielmodells Ducato L1H1 aus lib/vehicleTemplates.ts
    expect(screen.getByText(/140 × 267 cm/)).toBeInTheDocument();
  });

  it('verweist auf die Seiten, die es im Ausbau gibt', () => {
    render(<DachErklaerung />);

    // Der Slash am Ende ist Sache der Router-Konfiguration (`trailingSlash`),
    // deshalb wird er hier nicht fest verdrahtet.
    expect(screen.getByRole('link', { name: 'Ausbau-Fahrplan' }).getAttribute('href')).toMatch(
      /^\/guides\/ausbau-fahrplan\/?$/
    );
    expect(screen.getByRole('link', { name: 'Elektrik-Hub' }).getAttribute('href')).toMatch(
      /^\/camper-elektrik\/?$/
    );
    expect(screen.getByRole('link', { name: 'Holzausbau' }).getAttribute('href')).toMatch(
      /^\/guides\/holzausbau\/?$/
    );
    expect(screen.getByRole('link', { name: 'Camper-Ausbauguide' }).getAttribute('href')).toMatch(
      /^\/guides\/camper-ausbauguide\/?$/
    );
  });

  it('nennt den inhaltlichen Stand sichtbar', () => {
    render(<DachErklaerung />);

    expect(screen.getByText(/Inhaltlicher Stand: 2026-10/)).toBeInTheDocument();
  });
});
