import { describe, expect, it } from 'vitest';

import { SITE_ORIGIN } from '@/lib/site';
import { itemListNode, type JsonLdNode } from '@/lib/seo/jsonLd';
import { LADEBOOSTER_VERGLEICH } from './ladebooster';
import { rangfolge } from './rangfolge';
import { vergleichsProdukte } from './schema';

/**
 * G9 der Vergleichs-Spec: Die Maschinenfassung beschreibt dieselbe Liste wie
 * die Seite — gleiche Anzahl, gleiche Reihenfolge, gleiche Anker — und trägt
 * keine fremde Adresse.
 *
 * Letzteres ist kein Stilurteil, sondern ein Gate des Exports
 * (`json-ld-adresse`, `scripts/seo/checks.ts`): jede URL mit anderem Ursprung
 * ist ein Fehler. Hersteller- und Händleradressen stehen deshalb nur sichtbar
 * als Beleg, nicht im Schema.
 */

const LISTE = itemListNode({
  path: '/camper-elektrik/ladebooster/',
  name: LADEBOOSTER_VERGLEICH.heading,
  description: LADEBOOSTER_VERGLEICH.tableCaption,
  products: vergleichsProdukte(LADEBOOSTER_VERGLEICH),
});

/** Sammelt jede Zeichenkette im Knoten, auch in verschachtelten Objekten. */
function zeichenketten(knoten: unknown): string[] {
  if (typeof knoten === 'string') return [knoten];
  if (Array.isArray(knoten)) return knoten.flatMap(zeichenketten);
  if (knoten && typeof knoten === 'object') return Object.values(knoten).flatMap(zeichenketten);
  return [];
}

describe('vergleichsProdukte — Zuordnung ohne zweite Wahrheit', () => {
  it('führt jedes Gerät genau einmal, in der Reihenfolge der Rangliste', () => {
    const produkte = vergleichsProdukte(LADEBOOSTER_VERGLEICH);
    expect(produkte).toHaveLength(LADEBOOSTER_VERGLEICH.products.length);
    expect(produkte.map((p) => p.anchor)).toEqual(
      rangfolge(LADEBOOSTER_VERGLEICH.products).map((p) => `p-${p.id}`)
    );
  });

  it('nennt Marke und Gerät wie die Produktkarte', () => {
    const erstes = vergleichsProdukte(LADEBOOSTER_VERGLEICH)[0]!;
    const geraet = LADEBOOSTER_VERGLEICH.products.find((p) => `p-${p.id}` === erstes.anchor)!;
    expect(erstes.name).toBe(`${geraet.brand} ${geraet.name}`);
    expect(erstes.brand).toBe(geraet.brand);
  });

  it('lässt unbelegte Merkmale weg statt einen leeren Wert zu behaupten', () => {
    const geraet = LADEBOOSTER_VERGLEICH.products.find((p) => p.id === 'import-ungebrandet')!;
    const produkt = vergleichsProdukte(LADEBOOSTER_VERGLEICH).find(
      (p) => p.anchor === 'p-import-ungebrandet'
    )!;

    // `null` heißt „nachgesehen, nicht belegt". Sichtbar fehlt die Zeile in der
    // Karte; im Schema wäre ein leerer PropertyValue eine Behauptung ohne Wert.
    const belegt = LADEBOOSTER_VERGLEICH.attributes.filter((attribut) => geraet.specs[attribut.id] != null);
    expect(belegt.length).toBeLessThan(LADEBOOSTER_VERGLEICH.attributes.length);
    expect(produkt.properties.map((eigenschaft) => eigenschaft.name)).toEqual(
      belegt.map((attribut) => attribut.label)
    );
    expect(
      produkt.properties.every((eigenschaft) => eigenschaft.value !== null && eigenschaft.value !== undefined)
    ).toBe(true);
  });

  it('übernimmt die Einheit aus der Merkmalsdeklaration', () => {
    const produkte = vergleichsProdukte(LADEBOOSTER_VERGLEICH);
    const mitEinheit = LADEBOOSTER_VERGLEICH.attributes.filter((attribut) => attribut.unit);
    if (mitEinheit.length === 0) return;

    for (const eigenschaft of produkte.flatMap((p) => p.properties)) {
      const attribut = mitEinheit.find((a) => a.label === eigenschaft.name);
      if (attribut) expect(eigenschaft.unitText).toBe(attribut.unit);
    }
  });
});

describe('itemListNode — G9', () => {
  it('zählt so viele Listeneinträge wie die Seite Geräte zeigt', () => {
    const eintraege = LISTE['itemListElement'] as JsonLdNode[];
    expect(LISTE['numberOfItems']).toBe(LADEBOOSTER_VERGLEICH.products.length);
    expect(eintraege).toHaveLength(LADEBOOSTER_VERGLEICH.products.length);
    expect(eintraege.map((eintrag) => eintrag['position'])).toEqual(
      LADEBOOSTER_VERGLEICH.products.map((_geraet, index) => index + 1)
    );
  });

  it('trägt genau einen ItemList-Knoten und die Produkte inline', () => {
    expect(LISTE['@type']).toBe('ItemList');
    const eintraege = LISTE['itemListElement'] as JsonLdNode[];
    expect(eintraege.every((eintrag) => eintrag['@type'] === 'ListItem')).toBe(true);
    expect(eintraege.every((eintrag) => (eintrag['item'] as JsonLdNode)['@type'] === 'Product')).toBe(true);
    // Neun Product-Knoten auf oberster Ebene würden `json-ld-inventar` reißen
    // (genau ein Knoten je angekündigtem Typ). Inline sind es null.
    expect(eintraege.some((eintrag) => eintrag['@type'] === 'Product')).toBe(false);
  });

  it('verweist auf die Anker, die die Produktkarten tragen', () => {
    const eintraege = LISTE['itemListElement'] as JsonLdNode[];
    const ids = eintraege.map((eintrag) => String((eintrag['item'] as JsonLdNode)['@id']));
    for (const produkt of LADEBOOSTER_VERGLEICH.products) {
      expect(ids.some((id) => id.endsWith(`#p-${produkt.id}`))).toBe(true);
    }
  });

  it('nennt keine fremde Adresse und keinen Preis', () => {
    const texte = zeichenketten(LISTE);
    const fremd = texte.filter((text) => {
      if (!/^https?:\/\//i.test(text)) return false;
      try {
        return new URL(text).origin !== SITE_ORIGIN;
      } catch {
        return true;
      }
    });
    expect(fremd, fremd.join('\n')).toEqual([]);

    const schluessel = JSON.stringify(LISTE);
    for (const verboten of ['"offers"', '"price"', '"review"', '"aggregateRating"', '"sameAs"']) {
      expect(schluessel, `${verboten} steht im Schema`).not.toContain(verboten);
    }
  });
});
