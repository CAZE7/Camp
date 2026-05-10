import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AusbauFahrplanPage from './page';

describe('AusbauFahrplanPage', () => {
  it('renders the main title', () => {
    render(<AusbauFahrplanPage />);
    const mainTitle = screen.getByRole('heading', { name: /Der ultimative Camper-Ausbau Fahrplan/i, level: 1 });
    expect(mainTitle).toBeInTheDocument();
  });

  it('renders the sticky sidebar with Inhaltsverzeichnis', () => {
    render(<AusbauFahrplanPage />);
    const sidebarHeading = screen.getByRole('heading', { name: /Inhaltsverzeichnis/i, level: 2 });
    expect(sidebarHeading).toBeInTheDocument();

    // Check for some navigation links
    expect(screen.getByRole('link', { name: /1. Planung/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2. Rostschutz/i })).toBeInTheDocument();
  });

  it('renders the step modules correctly', () => {
    render(<AusbauFahrplanPage />);

    // Check headings for some steps
    expect(screen.getByRole('heading', { name: '1. Planung', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Rostschutz & Hohlraumversiegelung', level: 2 })).toBeInTheDocument();

    // Check that some step content is rendered
    expect(screen.getByText(/Einen detaillierten Grundriss und eine realistische Budgetkalkulation erstellen/i)).toBeInTheDocument();

    // Check that the standard sections for steps are present
    const werkzeugHeadings = screen.getAllByRole('heading', { name: /Werkzeug & Material/i, level: 3 });
    expect(werkzeugHeadings.length).toBeGreaterThan(0);

    const schrittHeadings = screen.getAllByRole('heading', { name: /Schritt für Schritt/i, level: 3 });
    expect(schrittHeadings.length).toBeGreaterThan(0);
  });

  it('renders additional info sections when present', () => {
    render(<AusbauFahrplanPage />);

    // Check for typische fehler (present in multiple places)
    const fehlerHeadings = screen.getAllByText(/Typische Fehler/i);
    expect(fehlerHeadings.length).toBeGreaterThan(0);

    // Check for Kaufhilfe
    const kaufhilfeHeadings = screen.getAllByRole('heading', { name: /Kaufhilfe/i, level: 3 });
    expect(kaufhilfeHeadings.length).toBeGreaterThan(0);

    // Check for Zusatzinfo
    expect(screen.getByRole('heading', { name: /Zusatzinfo/i, level: 3 })).toBeInTheDocument();

    // Check for comparison sections
    expect(screen.getByRole('heading', { name: /Vergleich: Fenster & Lüftung/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Vergleich: Dämmstoffe/i, level: 3 })).toBeInTheDocument();
  });
});
