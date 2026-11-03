import { describe, expect, it } from 'vitest';

import { LADEBOOSTER_VERGLEICH } from './ladebooster';
import { produktVergleich, rangfolge } from './rangfolge';
import type { ComparisonProduct } from './types';

const geraet = (ueberschreiben: Partial<ComparisonProduct> = {}): ComparisonProduct => ({
  id: 'x',
  brand: 'Marke',
  name: 'Gerät',
  classId: 'klein',
  specs: {},
  fit: { label: 'Einstieg', tone: 'plain' },
  caveats: [],
  stromA: null,
  priceEur: null,
  priceChecked: '2026-10-23',
  detail: [],
  links: [],
  ...ueberschreiben,
});

describe('Rangfolge', () => {
  it('sortiert aufsteigend nach Strom und innerhalb derselben Klasse nach Preis', () => {
    const liste = rangfolge([
      geraet({ id: 'teuer-60', stromA: 60, priceEur: 702 }),
      geraet({ id: 'klein', stromA: 30, priceEur: 150 }),
      geraet({ id: 'billig-60', stromA: 60, priceEur: 260 }),
    ]);
    expect(liste.map((produkt) => produkt.id)).toEqual(['klein', 'billig-60', 'teuer-60']);
  });

  it('stellt nicht belegte Werte ans Ende, nicht an den Anfang', () => {
    const liste = rangfolge([
      geraet({ id: 'unbekannt', stromA: null, priceEur: 180 }),
      geraet({ id: 'belegt', stromA: 120, priceEur: 711 }),
    ]);
    expect(liste.map((produkt) => produkt.id)).toEqual(['belegt', 'unbekannt']);
  });

  it('bricht einen Gleichstand über die Kennung, damit die Reihenfolge fest ist', () => {
    const liste = rangfolge([geraet({ id: 'b' }), geraet({ id: 'a' })]);
    expect(liste.map((produkt) => produkt.id)).toEqual(['a', 'b']);
    expect(produktVergleich('strom')(geraet({ id: 'a' }), geraet({ id: 'a' }))).toBe(0);
  });

  it('verändert die Eingabe nicht', () => {
    const eingabe = [geraet({ id: 'b', stromA: 90 }), geraet({ id: 'a', stromA: 30 })];
    rangfolge(eingabe);
    expect(eingabe.map((produkt) => produkt.id)).toEqual(['b', 'a']);
  });

  it('sortiert die neun Ladebooster in die veröffentlichte Reihenfolge', () => {
    expect(rangfolge(LADEBOOSTER_VERGLEICH.products).map((produkt) => produkt.id)).toEqual([
      'orion-tr-smart-12-12-30',
      'renogy-50a-dc-dc-mppt',
      'ective-bb-60',
      'buettner-mt-bcb',
      'schaudt-wa-121545',
      'votronic-vcc-1212-90',
      'victron-buck-boost-100a',
      'sterling-saturn-bb12120',
      'import-ungebrandet',
    ]);
  });
});
