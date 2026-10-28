import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LEGAL_PLACEHOLDER, SITE_LEGAL, type SiteLegal } from '@/lib/siteLegal';
import ImpressumPage from './page';

/**
 * Impressum-Seite.
 *
 * Die Angaben kommen aus `lib/siteLegal.ts`; die Seite zeigt entweder die
 * echten Angaben oder — wenn ein Feld leer ist — ihre Aufforderungstexte.
 *
 * Beide Zweige werden geprüft, aber unterschiedlich: Der **Stand im Baum**
 * (ausgefüllt seit 2026-10-28) ist der Normalfall und wird gegen die
 * tatsächlichen Werte gepinnt, damit eine versehentliche Leerung auffällt. Der
 * **Platzhalter-Zweig** wird mit einem ausdrücklich geleerten Objekt erzeugt —
 * er ist die Anzeige, die der Deploy-Wächter meldet, und muss weiterhin
 * funktionieren. Vorher hing dieser Test am Produktionswert; damit war er beim
 * Ausfüllen zwangsläufig rot und konnte nur durch Löschen grün werden.
 *
 * Die Gesetzeszitate sind Teil des Vertrags: Seit dem 14.05.2024 gilt § 5 DDG
 * (vorher § 5 TMG), seit 2020 § 18 Abs. 2 MStV (vorher § 55 Abs. 2 RStV). Ein
 * Impressum, das ein aufgehobenes Gesetz nennt, sieht vollständig aus und ist
 * es nicht — deshalb prüft dieser Test die Zitate selbst.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/impressum',
}));

/** Vollständige, aber fremde Angaben — für die Zweig-Tests. */
const filled: SiteLegal = {
  providerName: 'Elektroplaner Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@elektroplaner.example',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

/** Alle fünf Felder offen — der Zustand, den der Wächter meldet. */
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

describe('Impressum — mit eingetragenen Angaben', () => {
  it('zeigt Anbieter, Anschrift, Kontakt und Inhaltsverantwortung', () => {
    Object.assign(SITE_LEGAL, filled);
    render(<ImpressumPage />);
    expect(screen.getByText('Elektroplaner Ausbau GmbH')).toBeTruthy();
    expect(screen.getByText('Hafenstraße 12')).toBeTruthy();
    expect(screen.getByText('28217 Bremen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'kontakt@elektroplaner.example' })).toHaveAttribute(
      'href',
      'mailto:kontakt@elektroplaner.example'
    );
    expect(
      screen.getByText('Nach § 18 Abs. 2 MStV: Mareike Jensen, Hafenstraße 12, 28217 Bremen')
    ).toBeTruthy();
    // Die Aufforderungstexte verschwinden, sobald die Angaben da sind.
    expect(screen.queryByText('Elektroplaner — Projekt-Placeholder')).toBeNull();
    expect(screen.queryByText('kontakt@example.org')).toBeNull();
  });

  it('behält den Haftungshinweis in beiden Zweigen', () => {
    Object.assign(SITE_LEGAL, filled);
    const { unmount } = render(<ImpressumPage />);
    expect(screen.getByText(/DIN VDE 0100-721 Pflicht/)).toBeTruthy();
    unmount();
    Object.assign(SITE_LEGAL, empty);
    render(<ImpressumPage />);
    expect(screen.getByText(/DIN VDE 0100-721 Pflicht/)).toBeTruthy();
  });
});

describe('Impressum — solange die Angaben fehlen', () => {
  it('zeigt die Aufforderungstexte statt einer halben Anschrift', () => {
    Object.assign(SITE_LEGAL, empty);
    render(<ImpressumPage />);
    expect(screen.getByText('Elektroplaner — Projekt-Placeholder')).toBeTruthy();
    expect(screen.getByText('Bitte hier den Namen und die Anschrift des Betreibers eintragen.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'kontakt@example.org' })).toHaveAttribute(
      'href',
      'mailto:kontakt@example.org'
    );
    expect(screen.getByText('Nach § 18 Abs. 2 MStV: Bitte hier eintragen.')).toBeTruthy();
  });

  it('zeigt keine Platzhalter-Marke und keine halbe Anschrift', () => {
    // Nur die E-Mail eingetragen: Der Anbieterblock bleibt beim
    // Aufforderungstext, statt „Elektroplaner Ausbau GmbH" ohne Anschrift zu zeigen.
    Object.assign(SITE_LEGAL, empty, { email: filled.email });
    render(<ImpressumPage />);
    expect(screen.getByRole('link', { name: 'kontakt@elektroplaner.example' })).toHaveAttribute(
      'href',
      'mailto:kontakt@elektroplaner.example'
    );
    expect(screen.queryByText('Elektroplaner — Projekt-Placeholder')).toBeTruthy();
    expect(screen.queryByText(filled.street)).toBeNull();
    expect(document.body.textContent).not.toContain('BITTE-EINTRAGEN');
  });
});

describe('Impressum — Normzitate', () => {
  it('zitiert geltendes Recht: § 5 DDG und § 18 Abs. 2 MStV', () => {
    render(<ImpressumPage />);
    expect(screen.getByText('Angaben gemäß § 5 DDG.')).toBeTruthy();
    expect(screen.getByText(/§ 18 Abs\. 2 MStV/)).toBeTruthy();
    // Die abgelösten Vorschriften dürfen nicht mehr auftauchen: § 5 TMG wurde
    // am 14.05.2024 vom DDG abgelöst, § 55 Abs. 2 RStV 2020 vom MStV.
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('TMG');
    expect(text).not.toContain('RStV');
  });
});
