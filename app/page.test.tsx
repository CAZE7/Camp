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
    expect(screen.getByRole('heading', { name: /Guides/i, level: 2 })).toBeInTheDocument();
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
    expect(within(main).getByRole('link', { name: /Holzausbau \(BEDMAS\)/ })).toBeInTheDocument();
  });
});
