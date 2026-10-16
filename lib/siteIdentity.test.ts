import { describe, expect, it } from 'vitest';

import { SITE_SAME_AS, organizationNode, siteGraph, websiteNode } from './siteIdentity';
import { LEGAL_PLACEHOLDER, type SiteLegal } from './siteLegal';

/**
 * Die Identität der Marke in der strukturierten Beschreibung.
 *
 * Zwei Zusagen werden hier festgehalten: Die Kontaktangabe erscheint nur,
 * wenn die Impressumsangaben eingetragen sind, und `sameAs` nur, wenn echte
 * Profile benannt wurden. Beides sind Angaben, die eine Suchmaschine als
 * Beleg für die Existenz der Marke liest — erfunden wären sie schädlich.
 */
const mitKontakt: SiteLegal = {
  providerName: 'Werft Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@werft.example',
  phone: '',
  entityType: 'unternehmen',
  representative: 'Mareike Jensen',
  registerCourt: 'Amtsgericht Bremen',
  registerNumber: 'HRB 12345',
  vatId: '',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

describe('websiteNode', () => {
  it('beschreibt die Website mit Verweis auf die Organisation', () => {
    const node = websiteNode();
    expect(node['@type']).toBe('WebSite');
    const publisher = node['publisher'] as { '@id'?: unknown };
    expect(String(publisher['@id'])).toContain('#organization');
    expect(String(node['url'])).toMatch(/^https:\/\/elektroplaner-camper\.de\/$/);
  });
});

describe('organizationNode', () => {
  it('nennt keine Kontaktangabe, solange die Impressumsangaben offen sind', () => {
    const node = organizationNode({ legal: { ...mitKontakt, email: LEGAL_PLACEHOLDER } });
    expect(node['email']).toBeUndefined();
    expect(node['contactPoint']).toBeUndefined();
  });

  it('nennt E-Mail und Kontaktpunkt, sobald die Angabe belegt ist', () => {
    const node = organizationNode({ legal: mitKontakt });
    expect(node['email']).toBe('kontakt@werft.example');
    expect(node['contactPoint']).toEqual([
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'kontakt@werft.example',
        availableLanguage: ['de'],
      },
    ]);
  });

  it('trägt kein sameAs, solange keine Profile eingetragen sind', () => {
    // Der Auslieferungsstand: `SITE_SAME_AS` ist leer, weil der Betreiber
    // noch keine echten Profile eingetragen hat. Erfundene Adressen wären
    // schlimmer als keine.
    expect(SITE_SAME_AS).toEqual([]);
    expect(organizationNode({ legal: mitKontakt })['sameAs']).toBeUndefined();
  });

  it('übernimmt eingetragene Profile unverändert', () => {
    const sameAs = ['https://github.com/beispiel/werft', 'https://www.youtube.com/@beispiel'];
    const node = organizationNode({ legal: mitKontakt, sameAs });
    expect(node['sameAs']).toEqual(sameAs);
  });

  it('zeigt Name, Adresse, Sprache und Logo immer', () => {
    const node = organizationNode({ legal: mitKontakt });
    expect(node['@type']).toBe('Organization');
    expect(node['name']).toBe('Werft');
    expect(node['inLanguage']).toBe('de-DE');
    expect(node['logo']).toMatchObject({ '@type': 'ImageObject', width: 512, height: 512 });
  });
});

describe('siteGraph', () => {
  it('besteht aus Website und Organisation', () => {
    const graph = siteGraph({ legal: mitKontakt });
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph'].map((node) => node['@type'])).toEqual(['WebSite', 'Organization']);
  });
});
