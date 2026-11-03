import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LEGAL_PLACEHOLDER, SITE_LEGAL, type SiteLegal } from '@/lib/siteLegal';
import ImpressumPage from './page';

/**
 * Impressum-Seite (AUDIT „Impressum-Placeholder").
 *
 * Die Angaben kommen aus `lib/siteLegal.ts`; die Seite zeigt entweder die
 * echten Angaben oder — solange Platzhalter stehen — ihre Aufforderungstexte.
 * Diese Zweige sind hier gepinnt, weil der Placeholder-Zweig zugleich die
 * eingefrorene Pixel-Baseline ist (`tests/e2e/visual.spec.ts-snapshots/
 * route-impressum-{light,dark}.png`): Wer den Text ändert, verschiebt das
 * visuelle Gate und braucht UI-Freigabe.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/impressum',
}));

const filled: SiteLegal = {
  providerName: '12V-Planer Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@12v-planer.example',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

const empty: SiteLegal = {
  providerName: LEGAL_PLACEHOLDER,
  street: LEGAL_PLACEHOLDER,
  postalCodeAndCity: LEGAL_PLACEHOLDER,
  email: LEGAL_PLACEHOLDER,
  contentResponsible: LEGAL_PLACEHOLDER,
};

const original: SiteLegal = { ...SITE_LEGAL };

afterEach(() => {
  Object.assign(SITE_LEGAL, original);
});

describe('Impressum — solange die Angaben fehlen', () => {
  it('zeigt die offenen Betreiberangaben', () => {
    Object.assign(SITE_LEGAL, empty);
    render(<ImpressumPage />);
    expect(screen.getByText('12V-Planer — Betreiberangaben werden ergänzt.')).toBeTruthy();
    expect(
      screen.getByText('Name und Anschrift des Betreibers werden vor der Veröffentlichung ergänzt.')
    ).toBeTruthy();
    expect(screen.getByText('E-Mail: wird ergänzt.')).toBeTruthy();
    expect(screen.getByText('Nach § 18 Abs. 2 MStV: wird ergänzt.')).toBeTruthy();
  });

  it('zeigt keine Platzhalter-Marke und keine halbe Anschrift', () => {
    // Nur die E-Mail eingetragen: Der Anbieterblock bleibt beim
    // Aufforderungstext, statt „12V-Planer Ausbau GmbH" ohne Anschrift zu zeigen.
    Object.assign(SITE_LEGAL, empty, { email: filled.email });
    render(<ImpressumPage />);
    expect(screen.getByText('E-Mail: kontakt@12v-planer.example')).toBeTruthy();
    expect(screen.queryByText('12V-Planer — Betreiberangaben werden ergänzt.')).toBeTruthy();
    expect(screen.queryByText(filled.street)).toBeNull();
    expect(document.body.textContent).not.toContain('BITTE-EINTRAGEN');
  });
});

describe('Impressum — Angaben im Baum', () => {
  it('zeigt Name, Anschrift und kontakt@12v-planer.de, ohne Telefon und USt-Id', () => {
    render(<ImpressumPage />);
    expect(screen.getByText('Jonas Rieckhoff')).toBeTruthy();
    expect(screen.getByText('Franzosenkoppel 46')).toBeTruthy();
    expect(screen.getByText('22547 Hamburg')).toBeTruthy();
    expect(screen.getByText('E-Mail: kontakt@12v-planer.de')).toBeTruthy();
    expect(
      screen.getByText('Nach § 18 Abs. 2 MStV: Jonas Rieckhoff, Franzosenkoppel 46, 22547 Hamburg')
    ).toBeTruthy();
    expect(screen.getByText(/12V-Planer ist ein Planungswerkzeug/)).toBeTruthy();
    expect(screen.queryByText(/Telefon/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/USt-Id|Umsatzsteuer/);
    expect(document.body.textContent).not.toContain('BITTE-EINTRAGEN');
    expect(document.body.textContent).not.toContain('elektroplaner-camper.de');
  });
});

describe('Impressum — mit eingetragenen Angaben', () => {
  it('zeigt Anbieter, Anschrift, Kontakt und Inhaltsverantwortung', () => {
    Object.assign(SITE_LEGAL, filled);
    render(<ImpressumPage />);
    expect(screen.getByText('12V-Planer Ausbau GmbH')).toBeTruthy();
    expect(screen.getByText('Hafenstraße 12')).toBeTruthy();
    expect(screen.getByText('28217 Bremen')).toBeTruthy();
    expect(screen.getByText('E-Mail: kontakt@12v-planer.example')).toBeTruthy();
    expect(
      screen.getByText('Nach § 18 Abs. 2 MStV: Mareike Jensen, Hafenstraße 12, 28217 Bremen')
    ).toBeTruthy();
    // Die Aufforderungstexte verschwinden, sobald die Angaben da sind.
    expect(screen.queryByText('12V-Planer — Betreiberangaben werden ergänzt.')).toBeNull();
    expect(screen.queryByText('E-Mail: wird ergänzt.')).toBeNull();
  });

  it('behält den Haftungshinweis in beiden Zweigen', () => {
    Object.assign(SITE_LEGAL, filled);
    const { unmount } = render(<ImpressumPage />);
    expect(screen.getAllByText(/DIN VDE 0100-721/).length).toBeGreaterThan(0);
    unmount();
    render(<ImpressumPage />);
    expect(screen.getAllByText(/DIN VDE 0100-721/).length).toBeGreaterThan(0);
  });
});
