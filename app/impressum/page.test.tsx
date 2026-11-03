import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LEGAL_PLACEHOLDER, SITE_LEGAL, type SiteLegal } from '@/lib/siteLegal';
import ImpressumPage from './page';

/**
 * Impressum-Seite (AUDIT „Impressum-Placeholder").
 *
 * Die Angaben kommen aus `lib/siteLegal.ts`; die Seite zeigt entweder die
 * echten Angaben oder — bei Platzhaltern — ihre Aufforderungstexte. Beide
 * Zweige sind hier gepinnt, weil der Placeholder-Zweig zugleich die
 * eingefrorene Pixel-Baseline ist (`tests/e2e/visual.spec.ts-snapshots/
 * route-impressum-{light,dark}.png`): Wer den Text ändert, verschiebt das
 * visuelle Gate und braucht UI-Freigabe.
 *
 * Fortschreibung 2026-11-03: `SITE_LEGAL` ist jetzt befüllt. Die
 * Platzhalter-Zweige werden deshalb über eine eigene Fixture gesetzt, statt
 * den Zustand im Baum vorauszusetzen — sonst hinge der Test am Datenstand.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/impressum',
}));

/** Fixtures. Ausdrücklich KEINE echten Betreiberangaben. */
const filled: SiteLegal = {
  providerName: '12V-Planer Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@12v-planer.example',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

const live: SiteLegal = { ...SITE_LEGAL };

const placeholders: SiteLegal = {
  providerName: LEGAL_PLACEHOLDER,
  street: LEGAL_PLACEHOLDER,
  postalCodeAndCity: LEGAL_PLACEHOLDER,
  email: LEGAL_PLACEHOLDER,
  contentResponsible: LEGAL_PLACEHOLDER,
};

afterEach(() => {
  Object.assign(SITE_LEGAL, live);
});

describe('Impressum — solange die Angaben fehlen', () => {
  beforeEach(() => {
    Object.assign(SITE_LEGAL, placeholders);
  });

  it('zeigt die offenen Betreiberangaben', () => {
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
    Object.assign(SITE_LEGAL, placeholders, { email: filled.email });
    render(<ImpressumPage />);
    expect(screen.getByText('E-Mail: kontakt@12v-planer.example')).toBeTruthy();
    expect(screen.queryByText('12V-Planer — Betreiberangaben werden ergänzt.')).toBeTruthy();
    expect(screen.queryByText(filled.street)).toBeNull();
    expect(document.body.textContent).not.toContain('BITTE-EINTRAGEN');
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

  it('zeigt im Live-Zustand die vom Betreiber freigegebenen Angaben', () => {
    render(<ImpressumPage />);
    expect(screen.getByText('Jonas Rieckhoff')).toBeTruthy();
    expect(screen.getByText('Franzosenkoppel 46')).toBeTruthy();
    expect(screen.getByText('22547 Hamburg')).toBeTruthy();
    expect(screen.getByText('E-Mail: kontakt@elektroplaner-camper.de')).toBeTruthy();
    expect(screen.getByText(/Nach § 18 Abs\. 2 MStV: Jonas Rieckhoff/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('wird ergänzt');
    expect(document.body.textContent).not.toContain('BITTE-EINTRAGEN');
  });

  it('behält den Haftungshinweis in beiden Zweigen', () => {
    Object.assign(SITE_LEGAL, filled);
    const { unmount } = render(<ImpressumPage />);
    expect(screen.getAllByText(/DIN VDE 0100-721/).length).toBeGreaterThan(0);
    unmount();
    Object.assign(SITE_LEGAL, placeholders);
    render(<ImpressumPage />);
    expect(screen.getAllByText(/DIN VDE 0100-721/).length).toBeGreaterThan(0);
  });
});
