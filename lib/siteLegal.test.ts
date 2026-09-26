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

/** Vollständig ausgefüllte Angaben — die Referenz für „fertig". */
const filled: SiteLegal = {
  providerName: 'Werft Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@werft.example',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

describe('isPlaceholderText', () => {
  it('erkennt die Marke, auch mitten im Text', () => {
    expect(isPlaceholderText(LEGAL_PLACEHOLDER)).toBe(true);
    expect(isPlaceholderText(`Werft — ${LEGAL_PLACEHOLDER}`)).toBe(true);
  });

  it('echte Angaben sind keine Platzhalter', () => {
    expect(isPlaceholderText('Werft Ausbau GmbH')).toBe(false);
    expect(isPlaceholderText('')).toBe(false);
  });
});

describe('missingLegalFields', () => {
  it('nennt kein Feld, sobald alles eingetragen ist', () => {
    expect(missingLegalFields(filled)).toEqual([]);
  });

  it('der Stand im Baum ist unvollständig — alle fünf Felder offen', () => {
    // Das ist die Aussage des Audits: Die Angaben fehlen, und zwar vollständig.
    // Erfüllt jemand sie, wird dieser Test rot und muss MIT dem Eintrag
    // aktualisiert werden (er dokumentiert dann den erledigten Mangel).
    expect(missingLegalFields(SITE_LEGAL)).toEqual(Object.keys(LEGAL_FIELD_LABELS));
    expect(isProviderComplete(SITE_LEGAL)).toBe(false);
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
