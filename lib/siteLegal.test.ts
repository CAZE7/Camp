import { describe, expect, it } from 'vitest';
import {
  LEGAL_FIELD_LABELS,
  LEGAL_PLACEHOLDER,
  SITE_LEGAL,
  isPlaceholderText,
  isProviderComplete,
  missingLegalFields,
  type SiteLegal,
} from './siteLegal';

/**
 * Impressum-Angaben (AUDIT „Impressum-Placeholder").
 *
 * Die Seite wird öffentlich ausgeliefert; die Angaben sind deshalb Daten mit
 * einer prüfbaren Vollständigkeit, kein Freitext im JSX. Diese Tests pinnen den
 * Vertrag, auf dem der Deploy-Wächter (`scripts/ci/verifyLegalNotice.ts`) und
 * die Anzeige-Zweige der Seite stehen.
 */

/** Alle fünf Felder offen — die Referenz für „unvollständig". */
const empty: SiteLegal = {
  providerName: LEGAL_PLACEHOLDER,
  street: LEGAL_PLACEHOLDER,
  postalCodeAndCity: LEGAL_PLACEHOLDER,
  email: LEGAL_PLACEHOLDER,
  contentResponsible: LEGAL_PLACEHOLDER,
};

/** Vollständig ausgefüllte Angaben (fremde Person) — Referenz für „fertig". */
const filled: SiteLegal = {
  providerName: 'Elektroplaner Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@elektroplaner.example',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

describe('isPlaceholderText', () => {
  it('erkennt die Marke, auch mitten im Text', () => {
    expect(isPlaceholderText(LEGAL_PLACEHOLDER)).toBe(true);
    expect(isPlaceholderText(`Elektroplaner — ${LEGAL_PLACEHOLDER}`)).toBe(true);
  });

  it('echte Angaben sind keine Platzhalter', () => {
    expect(isPlaceholderText('Elektroplaner Ausbau GmbH')).toBe(false);
    expect(isPlaceholderText('')).toBe(false);
  });
});

describe('missingLegalFields', () => {
  it('nennt kein Feld, sobald alles eingetragen ist', () => {
    expect(missingLegalFields(filled)).toEqual([]);
  });

  it('alle Felder offen: jedes einzelne wird benannt', () => {
    expect(missingLegalFields(empty)).toEqual(Object.keys(LEGAL_FIELD_LABELS));
    expect(isProviderComplete(empty)).toBe(false);
  });

  it('der Stand im Baum ist vollständig (Mangel vom 2026-10-28 behoben)', () => {
    // Vorher war hier der Gegenbefund gepinnt („alle fünf Felder offen") — der
    // Mangel, den das Audit gemeldet hatte. Jetzt steht der ausgefüllte Stand
    // im Test, damit eine versehentliche Leerung auffällt: Das Impressum ist
    // die einzige Seite, deren Text eine Rechtsfolge hat.
    expect(missingLegalFields(SITE_LEGAL)).toEqual([]);
    expect(isProviderComplete(SITE_LEGAL)).toBe(true);
    // Die Werte selbst, nicht nur ihre Vollständigkeit: PLZ und Ort müssen zu
    // einer echten Anschrift gehören, nicht zu zwei zusammengewürfelten.
    expect(SITE_LEGAL.providerName).toBe('Jonas Rieckhoff');
    expect(SITE_LEGAL.street).toBe('Franzosenkoppel 46');
    expect(SITE_LEGAL.postalCodeAndCity).toBe('22547 Hamburg');
    expect(SITE_LEGAL.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
    expect(SITE_LEGAL.contentResponsible).toContain('Hamburg');
  });

  it('ein halb ausgefülltes Impressum zählt als unvollständig', () => {
    const partial: SiteLegal = { ...filled, email: LEGAL_PLACEHOLDER };
    expect(missingLegalFields(partial)).toEqual(['email']);
    // Anbieterblock bleibt vollständig — die Seite zeigt die echte Anschrift
    // und fordert nur die E-Mail an.
    expect(isProviderComplete(partial)).toBe(true);
  });

  it('fehlt nur ein Teil der Anschrift, gilt der Anbieterblock als offen', () => {
    // Eine halbe Anschrift sieht vollständig aus und ist rechtlich wertlos.
    expect(isProviderComplete({ ...filled, postalCodeAndCity: LEGAL_PLACEHOLDER })).toBe(false);
    expect(isProviderComplete({ ...filled, street: LEGAL_PLACEHOLDER })).toBe(false);
  });
});

describe('LEGAL_FIELD_LABELS', () => {
  it('jedes Feld hat einen menschlichen Bezeichner (für die CI-Meldung)', () => {
    expect(Object.keys(LEGAL_FIELD_LABELS).sort()).toEqual(Object.keys(filled).sort());
    for (const label of Object.values(LEGAL_FIELD_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      expect(isPlaceholderText(label)).toBe(false);
    }
  });
});
