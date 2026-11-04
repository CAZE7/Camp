import { describe, expect, it } from 'vitest';

import {
  ATTRIBUTE,
  EINSATZFAELLE,
  GERAETE,
  KLASSEN,
  PREIS_MAX_ALTER_TAGE,
  PREISSTAND,
  geraetAnker,
  preisIstFrisch,
  type AttributId,
} from './ladeboosterGeraete';
import { itemListNode } from './jsonLd';
import { pageByPath } from './inventory';

/**
 * Die Zusagen der fertigen Vergleichsseite. Ohne diese Tests kann eine der
 * neun Karten wieder eigene Zahlen bekommen, ein „nicht belegt" still zu einer
 * leeren Zelle werden oder ein veralteter Preis unbemerkt stehen bleiben.
 */

const HEUTE = '2026-11-03';

describe('Datenquelle — eine Wahrheit für Rangliste, Karten und Schema', () => {
  it('nennt neun Geräte mit eindeutigen Kennungen und gültigen Klassen', () => {
    expect(GERAETE).toHaveLength(9);
    expect(new Set(GERAETE.map((g) => g.id)).size).toBe(9);
    const klassen = new Set(KLASSEN.map((k) => k.id));
    for (const g of GERAETE) expect(klassen.has(g.klasse)).toBe(true);
  });

  it('jedes Gerät trägt jedes deklarierte Attribut — null statt Lücke', () => {
    const ids = ATTRIBUTE.map((a) => a.id).sort();
    for (const g of GERAETE) {
      expect(Object.keys(g.specs).sort(), g.id).toEqual(ids);
      for (const a of ATTRIBUTE) {
        const wert = g.specs[a.id];
        expect(wert === null || (typeof wert === 'string' && wert.length > 0), `${g.id}.${a.id}`).toBe(true);
      }
    }
  });

  it('kennt echte Datenlücken und erfindet sie nicht weg', () => {
    const unbelegt = GERAETE.flatMap((g) => ATTRIBUTE.filter((a) => g.specs[a.id] === null));
    expect(unbelegt.length).toBeGreaterThan(0);
    // Genau das Importgerät hat keinen belastbaren Nennstrom.
    expect(GERAETE.filter((g) => g.stromA === null).map((g) => g.id)).toEqual(['import-120']);
  });

  it('Attribute und Klassen sind eindeutig und erklärt', () => {
    expect(new Set(ATTRIBUTE.map((a) => a.id)).size).toBe(ATTRIBUTE.length);
    expect(ATTRIBUTE).toHaveLength(8);
    for (const a of ATTRIBUTE) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.legende.length).toBeGreaterThan(20);
    }
    expect(new Set(KLASSEN.map((k) => k.id)).size).toBe(KLASSEN.length);
  });

  it('hält keine doppelten redaktionellen Sätze vor', () => {
    const saetze = GERAETE.flatMap((g) => [g.einordnung, g.haken, g.auffaellig, g.passtFuer]);
    const lang = saetze.filter((text) => text.length >= 60);
    expect(new Set(lang).size).toBe(lang.length);
  });

  it('verlinkt nur externe HTTPS-Belege, ohne Affiliate-Parameter', () => {
    const hrefs = GERAETE.flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(href.startsWith('https://')).toBe(true);
      expect(href).not.toMatch(/[?&](ref|aff|utm_|gclid)=/i);
    }
  });

  it('jeder Einsatzfall zeigt auf ein existierendes Gerät', () => {
    const ids = new Set(GERAETE.map((g) => g.id));
    expect(EINSATZFAELLE).toHaveLength(4);
    for (const u of EINSATZFAELLE) expect(ids.has(u.geraetId)).toBe(true);
    expect(geraetAnker('orion-30')).toBe('p-orion-30');
  });
});

describe('Preisbeobachtungen veralten nicht unbemerkt', () => {
  it('alle Preise sind frisch und tragen dasselbe Prüfdatum', () => {
    for (const g of GERAETE) {
      expect(g.preisGeprueft).toBe(PREISSTAND);
      expect(preisIstFrisch(g.preisGeprueft, HEUTE), g.id).toBe(true);
    }
  });

  it(`ein Preis älter als ${PREIS_MAX_ALTER_TAGE} Tage gilt als veraltet`, () => {
    expect(preisIstFrisch('2026-01-01', HEUTE)).toBe(false);
    expect(preisIstFrisch('kein Datum', HEUTE)).toBe(false);
    expect(preisIstFrisch(PREISSTAND, 'kein Datum')).toBe(false);
  });
});

describe('ItemList — dieselben Geräte wie das sichtbare HTML', () => {
  const PFAD = '/camper-elektrik/ladebooster/';
  const node = itemListNode({
    path: PFAD,
    name: 'Ladebooster im Vergleich: 30, 60 oder 90 A?',
    items: GERAETE.map((g) => ({
      id: g.id,
      name: `${g.brand} ${g.name}`,
      brand: g.brand,
      klasse: g.stromLabel,
      attribute: ATTRIBUTE.flatMap((a: { id: AttributId; label: string }) => {
        const wert = g.specs[a.id];
        return wert === null ? [] : [{ label: a.label, wert }];
      }),
    })),
  });

  it('ist genau EIN Knoten mit neun Positionen', () => {
    expect(node['@type']).toBe('ItemList');
    expect(node['numberOfItems']).toBe(GERAETE.length);
    expect(node['itemListElement']).toHaveLength(GERAETE.length);
  });

  it('enthält keine Preise, Bewertungen oder fremden Adressen', () => {
    const serialisiert = JSON.stringify(node);
    expect(serialisiert).not.toMatch(/offer|aggregateRating|review|price/i);
    expect(serialisiert).not.toContain('https://schema.org');
    const ids = serialisiert.match(/https?:\/\/[^"\\]+/g) ?? [];
    for (const id of ids) expect(id.startsWith('https://12v-planer.de')).toBe(true);
  });

  it('schreibt „nicht belegt" nicht als PropertyValue', () => {
    expect(JSON.stringify(node)).not.toContain('nicht belegt');
  });

  it('ist im Inventar genau einmal angekündigt', () => {
    const eintrag = pageByPath(PFAD);
    expect(eintrag).toBeDefined();
    expect(eintrag?.structuredData.filter((t) => t === 'ItemList')).toHaveLength(1);
  });
});
