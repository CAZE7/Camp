import { describe, expect, it } from 'vitest';

import {
  LEGAL_PLACEHOLDER,
  SITE_LEGAL,
  hasPhone,
  hasVatId,
  isCompany,
  isEmailComplete,
  isProviderComplete,
  missingLegalFields,
  undecidedOptionalFields,
  type SiteLegal,
} from './siteLegal';

/**
 * Die Pflichtangaben des Impressums hängen an der Rechtsform. Diese Logik
 * entscheidet, was der Deploy-Wächter meldet — und damit, ob ein unvollständiges
 * Impressum veröffentlicht wird. Sie wird deshalb hier festgehalten, nicht nur
 * im Wächter.
 */
const vollstaendig: SiteLegal = {
  providerName: 'Werft Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@werft.example',
  phone: '',
  entityType: 'unternehmen',
  representative: 'Mareike Jensen',
  registerCourt: 'Amtsgericht Bremen',
  registerNumber: 'HRB 12345',
  vatId: 'DE123456789',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

describe('missingLegalFields', () => {
  it('meldet bei einer natürlichen Person keine Registerangaben', () => {
    const legal: SiteLegal = {
      ...vollstaendig,
      entityType: 'natuerliche-person',
      representative: '',
      registerCourt: '',
      registerNumber: '',
    };
    expect(missingLegalFields(legal)).toEqual([]);
  });

  it('meldet bei einem Unternehmen die fehlenden Registerangaben', () => {
    const legal: SiteLegal = { ...vollstaendig, registerNumber: LEGAL_PLACEHOLDER };
    expect(missingLegalFields(legal)).toEqual(['registerNumber']);
  });

  it('fordert bei unbekannter Rechtsform beide Sätze', () => {
    // Lieber eine Angabe zu viel melden als eine fehlende übersehen: Solange
    // die Rechtsform offen ist, gilt die Vereinigung beider Anforderungen.
    const legal: SiteLegal = { ...vollstaendig, entityType: LEGAL_PLACEHOLDER };
    expect(missingLegalFields(legal)).toEqual(['entityType']);
  });

  it('meldet die fehlende Rechtsform selbst', () => {
    const legal: SiteLegal = { ...vollstaendig, entityType: LEGAL_PLACEHOLDER };
    expect(missingLegalFields(legal)).toContain('entityType');
  });

  it('behandelt ein leeres Impressum als vollständig offen', () => {
    expect(missingLegalFields(SITE_LEGAL).length).toBeGreaterThan(0);
    expect(missingLegalFields(SITE_LEGAL)).toContain('providerName');
    expect(missingLegalFields(SITE_LEGAL)).toContain('email');
    expect(missingLegalFields(SITE_LEGAL)).toContain('contentResponsible');
  });
});

describe('undecidedOptionalFields', () => {
  it('meldet Telefon und USt-IdNr., solange sie nicht entschieden sind', () => {
    expect(undecidedOptionalFields(SITE_LEGAL)).toEqual(['phone', 'vatId']);
  });

  it('meldet nichts, wenn beide Angaben bewusst leer sind', () => {
    const legal: SiteLegal = { ...vollstaendig, phone: '', vatId: '' };
    expect(undecidedOptionalFields(legal)).toEqual([]);
  });

  it('nennt eine fehlende Pflichtangabe nicht als optionale Unentschlossenheit', () => {
    const legal: SiteLegal = { ...vollstaendig, providerName: LEGAL_PLACEHOLDER };
    expect(undecidedOptionalFields(legal)).not.toContain('providerName');
  });
});

describe('Sichtbarkeit der optionalen Angaben', () => {
  it('zeigt Telefon und USt-IdNr. nur, wenn sie gefüllt sind', () => {
    expect(hasPhone({ ...vollstaendig, phone: '' })).toBe(false);
    expect(hasPhone({ ...vollstaendig, phone: '+49 421 1' })).toBe(true);
    expect(hasVatId({ ...vollstaendig, vatId: '' })).toBe(false);
    expect(hasVatId(vollstaendig)).toBe(true);
  });

  it('erkennt die Unternehmensform', () => {
    expect(isCompany(vollstaendig)).toBe(true);
    expect(isCompany({ ...vollstaendig, entityType: 'natuerliche-person' })).toBe(false);
    expect(isCompany({ ...vollstaendig, entityType: LEGAL_PLACEHOLDER })).toBe(false);
  });

  it('trennt Anbieterblock und E-Mail', () => {
    expect(isProviderComplete(vollstaendig)).toBe(true);
    expect(isProviderComplete({ ...vollstaendig, street: LEGAL_PLACEHOLDER })).toBe(false);
    expect(isEmailComplete(vollstaendig)).toBe(true);
    expect(isEmailComplete({ ...vollstaendig, email: LEGAL_PLACEHOLDER })).toBe(false);
  });
});
