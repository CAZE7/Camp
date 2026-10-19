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
 *
 * Seit dem 2026-10-16 nennt die Seite den geltenden Normstand (§ 5 DDG,
 * § 18 Abs. 2 MStV) statt der überholten Vorgänger (§ 5 TMG,
 * § 55 Abs. 2 RStV).
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/impressum',
}));

const filled: SiteLegal = {
  providerName: 'Werft Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@werft.example',
  phone: '+49 421 1234567',
  entityType: 'unternehmen',
  representative: 'Mareike Jensen',
  registerCourt: 'Amtsgericht Bremen',
  registerNumber: 'HRB 12345',
  vatId: 'DE123456789',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

const naturalPerson: SiteLegal = {
  ...filled,
  providerName: 'Mareike Jensen',
  entityType: 'natuerliche-person',
  phone: '',
  vatId: '',
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
    expect(screen.getByText('E-Mail-Adresse noch nicht eingetragen.')).toBeTruthy();
    expect(screen.getByText('Nach § 18 Abs. 2 MStV: Bitte hier eintragen.')).toBeTruthy();
  });

  it('nennt den geltenden Normstand statt der überholten Vorgänger', () => {
    render(<ImpressumPage />);
    expect(screen.getByText('Angaben gemäß § 5 DDG.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('TMG');
    expect(document.body.textContent).not.toContain('RStV');
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
      screen.getByText('Nach § 18 Abs. 2 MStV: Mareike Jensen, Hafenstraße 12, 28217 Bremen')
    ).toBeTruthy();
    // Die Aufforderungstexte verschwinden, sobald die Angaben da sind.
    expect(screen.queryByText('Werft — Projekt-Placeholder')).toBeNull();
    expect(screen.queryByText('E-Mail-Adresse noch nicht eingetragen.')).toBeNull();
  });

  it('zeigt bei einem Unternehmen Vertretung und Register', () => {
    Object.assign(SITE_LEGAL, filled);
    render(<ImpressumPage />);
    expect(screen.getByText('Vertreten durch: Mareike Jensen')).toBeTruthy();
    expect(screen.getByText('Registergericht: Amtsgericht Bremen')).toBeTruthy();
    expect(screen.getByText('Registernummer: HRB 12345')).toBeTruthy();
    expect(
      screen.getByText('Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE123456789')
    ).toBeTruthy();
  });

  it('lässt Register- und USt-Angaben bei einer natürlichen Person weg', () => {
    Object.assign(SITE_LEGAL, naturalPerson);
    render(<ImpressumPage />);
    expect(screen.queryByText('Vertreten durch: Mareike Jensen')).toBeNull();
    expect(screen.queryByText('Registergericht: Amtsgericht Bremen')).toBeNull();
    expect(document.body.textContent).not.toContain('§ 27a');
    expect(screen.queryByText('Telefon: +49 421 1234567')).toBeNull();
  });

  it('zeigt das Telefon, wenn angegeben', () => {
    Object.assign(SITE_LEGAL, { ...naturalPerson, phone: '+49 421 1234567' });
    render(<ImpressumPage />);
    expect(screen.getByText('Telefon: +49 421 1234567')).toBeTruthy();
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
