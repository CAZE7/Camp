import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SITE_LEGAL, type SiteLegal } from '@/lib/siteLegal';
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
  providerName: 'Werft Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@werft.example',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

const original: SiteLegal = { ...SITE_LEGAL };

afterEach(() => {
  Object.assign(SITE_LEGAL, original);
});

describe('Impressum — solange die Angaben fehlen', () => {
  it('zeigt die Aufforderungstexte der eingefrorenen Baseline', () => {
    render(<ImpressumPage />);
    expect(screen.getByText('Werft — Projekt-Placeholder')).toBeTruthy();
    expect(screen.getByText('Bitte hier den Namen und die Anschrift des Betreibers eintragen.')).toBeTruthy();
    expect(screen.getByText('E-Mail: kontakt@example.org')).toBeTruthy();
    expect(screen.getByText('Nach § 55 Abs. 2 RStV: Bitte hier eintragen.')).toBeTruthy();
  });

  it('zeigt keine Platzhalter-Marke und keine halbe Anschrift', () => {
    // Nur die E-Mail eingetragen: Der Anbieterblock bleibt beim
    // Aufforderungstext, statt „Werft Ausbau GmbH" ohne Anschrift zu zeigen.
    Object.assign(SITE_LEGAL, original, { email: filled.email });
    render(<ImpressumPage />);
    expect(screen.getByText('E-Mail: kontakt@werft.example')).toBeTruthy();
    expect(screen.queryByText('Werft — Projekt-Placeholder')).toBeTruthy();
    expect(screen.queryByText(filled.street)).toBeNull();
    expect(document.body.textContent).not.toContain('BITTE-EINTRAGEN');
  });
});

describe('Impressum — mit eingetragenen Angaben', () => {
  it('zeigt Anbieter, Anschrift, Kontakt und Inhaltsverantwortung', () => {
    Object.assign(SITE_LEGAL, filled);
    render(<ImpressumPage />);
    expect(screen.getByText('Werft Ausbau GmbH')).toBeTruthy();
    expect(screen.getByText('Hafenstraße 12')).toBeTruthy();
    expect(screen.getByText('28217 Bremen')).toBeTruthy();
    expect(screen.getByText('E-Mail: kontakt@werft.example')).toBeTruthy();
    expect(
      screen.getByText('Nach § 55 Abs. 2 RStV: Mareike Jensen, Hafenstraße 12, 28217 Bremen')
    ).toBeTruthy();
    // Die Aufforderungstexte verschwinden, sobald die Angaben da sind.
    expect(screen.queryByText('Werft — Projekt-Placeholder')).toBeNull();
    expect(screen.queryByText('E-Mail: kontakt@example.org')).toBeNull();
  });

  it('behält den Haftungshinweis in beiden Zweigen', () => {
    Object.assign(SITE_LEGAL, filled);
    const { unmount } = render(<ImpressumPage />);
    expect(screen.getByText(/DIN VDE 0100-721 Pflicht/)).toBeTruthy();
    unmount();
    render(<ImpressumPage />);
    expect(screen.getByText(/DIN VDE 0100-721 Pflicht/)).toBeTruthy();
  });
});
