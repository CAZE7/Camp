import { describe, expect, it } from 'vitest';

import {
  PRODUKTIONSBILDER,
  bildIstFreigegeben,
  bildZuSchemaKnoten,
  freigegebeneBilder,
  type Produktionsbild,
} from './bildSitemap';

/**
 * Die Bild-Sitemap darf erst Bilder behaupten, wenn eigene Aufnahmen mit
 * geklärten Rechten vorliegen. Diese Tests halten den leeren Zustand und die
 * Regeln fest, die beim ersten echten Motiv greifen.
 */

const gueltig: Produktionsbild = {
  pfad: '/bilder/a-01-kabelverlegung-1200.avif',
  seite: '/camper-elektrik/',
  alt: 'Hände verlegen 12-V-Leitungen entlang einer Holzleiste im Camper-Innenausbau.',
  bildunterschrift: 'Der Kabelweg folgt der Holzleiste, nicht dem kürzesten Weg.',
  breite: 1200,
  hoehe: 805,
  rechteGeklaert: true,
};

describe('PRODUKTIONSBILDER', () => {
  it('ist leer, solange keine eigenen Fotos und Rechte vorliegen', () => {
    expect(PRODUKTIONSBILDER).toEqual([]);
    expect(freigegebeneBilder()).toEqual([]);
  });
});

describe('bildIstFreigegeben', () => {
  it('nimmt ein vollständig dokumentiertes eigenes Motiv an', () => {
    expect(bildIstFreigegeben(gueltig)).toBe(true);
  });

  it.each([
    ['Rechte nicht geklärt', { rechteGeklaert: false }],
    ['KI-Konzeptplatzhalter', { pfad: '/bilder/01-elektrik-einbau-1200.avif' }],
    ['falscher Ordner', { pfad: '/og/a-01-kabelverlegung-1200.avif' }],
    ['keine 1200er AVIF-Variante', { pfad: '/bilder/a-01-kabelverlegung.jpg' }],
    ['Großbuchstaben im Namen', { pfad: '/bilder/A-01-Kabelverlegung-1200.avif' }],
    ['kein Alt-Text', { alt: '' }],
    ['zu langer Alt-Text', { alt: 'x'.repeat(126) }],
    ['keine Bildunterschrift', { bildunterschrift: '   ' }],
    ['keine Breite', { breite: 0 }],
    ['keine ganze Zahl bei der Höhe', { hoehe: 805.5 }],
    ['Zielseite ohne Schrägstrich', { seite: '/camper-elektrik' }],
  ])('lehnt %s ab', (_grund, aenderung) => {
    expect(bildIstFreigegeben({ ...gueltig, ...aenderung })).toBe(false);
  });

  it('filtert unklare Einträge aus einer gemischten Liste', () => {
    const liste = [gueltig, { ...gueltig, rechteGeklaert: false }, { ...gueltig, alt: '' }];
    expect(freigegebeneBilder(liste)).toEqual([gueltig]);
  });

  it('begrenzt optional auf bekannte Seiten', () => {
    expect(freigegebeneBilder([gueltig], new Set(['/impressum/']))).toEqual([]);
    expect(freigegebeneBilder([gueltig], new Set(['/camper-elektrik/']))).toEqual([gueltig]);
  });
});

describe('bildZuSchemaKnoten', () => {
  it('erzeugt einen verschachtelten ImageObject ohne Preis oder Bewertung', () => {
    const knoten = bildZuSchemaKnoten(gueltig, 'https://12v-planer.de/bilder/a-01-kabelverlegung-1200.avif');
    expect(knoten['@type']).toBe('ImageObject');
    expect(knoten.description).toBe(gueltig.alt);
    expect(knoten.caption).toBe(gueltig.bildunterschrift);
    expect(knoten.width).toBe(1200);
    expect(knoten.height).toBe(805);
    expect(JSON.stringify(knoten)).not.toMatch(/price|rating|review/i);
  });
});
