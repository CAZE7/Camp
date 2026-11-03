import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Home from './page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe('Home Page', () => {
  it('renders the main sections', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: /Camper planen/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Fokus-Themen/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Wissen für den Ausbau/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Dach, Elektrik, Heizung und Sicherheit an einem Ort\./)).toBeInTheDocument();
  });

  it('keeps one H1, enforces the image contract, and shows page index and quick navigation', () => {
    render(<Home />);

    // Designkonzept 2026-11, P1: Das alte Bildverbot ist durch einen
    // Bildvertrag ersetzt. Die Startseite bleibt bis P2 absichtlich ohne
    // Foto — die Motive sind eigene Aufnahmen, KI-Platzhalter werden nicht
    // ausgeliefert (BILDRECHTE.md). Sobald P2 das Hero-Foto setzt, greift
    // dieser Guard: Alt-Text, feste Maße und Bildunterschrift sind Pflicht.
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    for (const img of document.querySelectorAll('img')) {
      expect(img).toHaveAttribute('alt');
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
      expect(img.closest('figure')?.querySelector('figcaption') ?? null).not.toBeNull();
    }
    const index = screen.getByRole('navigation', { name: /Inhaltsverzeichnis der Startseite/i });
    expect(within(index).getByRole('link', { name: /Werkzeuge/ })).toHaveAttribute(
      'href',
      '#werkzeuge-heading'
    );
    expect(screen.getByRole('navigation', { name: /Schnellnavigation/i })).toBeInTheDocument();
  });

  it('renders the tool links', () => {
    render(<Home />);

    const main = screen.getByRole('main');
    // Hero-CTA und Werkzeug-Karte teilen sich das Ziel — mindestens 1× je Tool.
    expect(within(main).getAllByRole('link', { name: /Schaltplan/ }).length).toBeGreaterThan(0);
    expect(within(main).getAllByRole('link', { name: /Dach/ }).length).toBeGreaterThan(0);
    expect(within(main).getAllByRole('link', { name: /Heizlast/ }).length).toBeGreaterThan(0);
    // KI-Assistent wurde entfernt (toter Link auf /ki-assistent/, Audit D10).
    // Negativ-Assertion hält fest, dass er nicht zurückkommt, ohne neue Seite.
    expect(within(main).queryByRole('link', { name: /Assistent/ })).not.toBeInTheDocument();
  });

  it('renders the guide links', () => {
    render(<Home />);

    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /Camper-Ausbauguide/ })).toBeInTheDocument();
    // "Ausbau-Fahrplan" erscheint als Empfehlung UND als Guide-Link — mindestens 1×.
    expect(within(main).getAllByRole('link', { name: /Ausbau-Fahrplan/ }).length).toBeGreaterThan(0);
    expect(within(main).getByRole('link', { name: /Holzausbau in sechs Schritten/ })).toBeInTheDocument();
  });
});
