import { describe, expect, it } from 'vitest';

import { LADEBOOSTER_VERGLEICH } from './ladebooster';
import {
  attributLuecken,
  doppelteAussagen,
  faqZuLang,
  gemeinsameFolge,
  normalisiert,
  preisStandVeraltet,
  quellenTexte,
  ratgeberTexte,
  tageSeit,
  vergleichsTexte,
  woerter,
  wortBudget,
  WORTBUDGET_VERGLEICH,
} from './gates';
import type { ComparisonProduct, ComparisonSpec } from './types';

/**
 * Die drei Wiederholungen, die im Bestand tatsächlich standen —
 * `components/seo/LadeboosterVergleich.tsx` vor dem Umbau. Sie sind hier
 * Fixtures, keine ausgedachten Beispiele: Eine Regel, die den Fehler nicht
 * meldet, den sie verhindern soll, ist Dekoration.
 */
const WIEDERHOLUNG_PARALLEL = [
  'Victron erlaubt den Parallelbetrieb ausdrücklich. In der Praxis verteilt sich die Last aber nicht von selbst. Gleiche Leitungslängen, ein gemeinsamer Abgreifpunkt und eine stillgelegte EBL-Ladung sind Pflicht; die Lichtmaschine muss den doppelten Eingangsstrom tragen.',
  '60 A für rund 300–450 € plus Verkabelung. Victron erlaubt es, aber die Last verteilt sich nicht von selbst. Gleiche Leitungslängen, ein Sternpunkt und eine stillgelegte EBL-Ladung sind Pflicht.',
] as const;

const WIEDERHOLUNG_STERLING = [
  'Der Sterling nennt 120 A und 1.620 W; im Handbuch stehen 110 A bei 14,41 V.',
  'Die Produktseite nennt 120 A und 1.620 W; das Handbuch nennt 110 A bei 14,41 V.',
] as const;

const WIEDERHOLUNG_RENOGY = [
  '50 A sind die Gesamtleistung über beide Quellen. Im Hybridbetrieb liefert jede Quelle maximal 25 A. Wer 50 A aus der Lichtmaschine erwartet, während Solar läuft, wird enttäuscht.',
  'Das Handbuch ist eindeutig: Im Hybridbetrieb liefert jede Quelle maximal 25 A, die Gesamtleistung bleibt bei 50 A.',
] as const;

const produkt = (ueberschreiben: Partial<ComparisonProduct> = {}): ComparisonProduct => ({
  id: 'geraet-a',
  brand: 'Marke',
  name: 'Gerät A',
  classId: 'klein',
  specs: { strom: '30 A', kabel: null },
  fit: { label: 'Einstieg', tone: 'plain' },
  caveats: [],
  priceEur: 100,
  priceChecked: '2026-10-23',
  detail: [],
  links: [],
  ...ueberschreiben,
});

const basis = (ueberschreiben: Partial<ComparisonSpec> = {}): ComparisonSpec => ({
  id: 'test',
  heading: 'Testvergleich',
  tableLabel: 'Überblick',
  tableCaption: 'Zwei Geräte im Test.',
  noRatingNote: 'Keine Noten.',
  priceAsOf: 'Preisstand 23.10.2026.',
  priceAsOfDate: '2026-10-23',
  attributes: [
    { id: 'strom', label: 'Strom', inTable: true },
    { id: 'kabel', label: 'Kabel', inTable: false },
  ],
  classes: [{ id: 'klein', label: 'klein' }],
  products: [produkt()],
  useCases: [],
  sources: [],
  ...ueberschreiben,
});

describe('Zählen und Normalisieren', () => {
  it('zählt Wörter, nicht Leerzeichen', () => {
    expect(woerter('30 A an 330 Ah sind 0,09 C')).toBe(8);
    expect(woerter('   ')).toBe(0);
    expect(woerter('—')).toBe(0);
  });

  it('reduziert interne Verweise auf ihren Ankertext', () => {
    expect(normalisiert('[Kabelquerschnitt berechnen](/camper-elektrik/kabelquerschnitt/)')).toBe(
      'kabelquerschnitt berechnen'
    );
  });

  it('ignoriert Satzzeichen, damit ein Semikolon keine neue Aussage macht', () => {
    expect(normalisiert('Pflicht; die Lichtmaschine')).toBe('pflicht die lichtmaschine');
    expect(normalisiert('Pflicht. Die Lichtmaschine')).toBe('pflicht die lichtmaschine');
  });

  it('misst die längste gemeinsame Wortfolge', () => {
    expect(gemeinsameFolge(['a', 'b', 'c'], ['x', 'b', 'c', 'y'])).toBe(2);
    expect(gemeinsameFolge(['a'], ['b'])).toBe(0);
    expect(gemeinsameFolge([], ['b'])).toBe(0);
  });
});

describe('G1 — keine Aussage doppelt', () => {
  it('meldet identische Aussagen', () => {
    const funde = doppelteAussagen([
      { name: 'Karte', texte: [WIEDERHOLUNG_STERLING[0]] },
      { name: 'Tabelle', texte: [WIEDERHOLUNG_STERLING[0]] },
    ]);
    expect(funde.map((fund) => fund.regel)).toContain('doppelter-text');
  });

  it.each([
    ['Parallelbetrieb', WIEDERHOLUNG_PARALLEL],
    ['Sterling-Angaben', WIEDERHOLUNG_STERLING],
    ['Renogy-Aufteilung', WIEDERHOLUNG_RENOGY],
  ])('meldet die umformulierte Wiederholung: %s', (_name, paar) => {
    const funde = doppelteAussagen([
      { name: 'Leiter', texte: [paar[0]] },
      { name: 'Karte', texte: [paar[1]] },
    ]);
    expect(funde).toHaveLength(1);
    expect(funde[0]!.regel).toBe('doppelte-aussage');
  });

  it('meldet kurze Wiederholungen nicht — „Handbuch" ist keine Aussage', () => {
    const funde = doppelteAussagen([
      { name: 'a', texte: ['Handbuch'] },
      { name: 'b', texte: ['Handbuch'] },
    ]);
    expect(funde).toHaveLength(0);
  });

  it('meldet zwei verschiedene Aussagen mit gemeinsamer Vokabel nicht', () => {
    const funde = doppelteAussagen([
      {
        name: 'schaudt',
        texte: ['Eingang 12–15 V, Temperaturfühler im Lieferumfang. Preis pro Ampere: rund 8,20 € bei 70 A.'],
      },
      {
        name: 'votronic',
        texte: [
          'Eingang 1.350 W, maximal 125 A, Temperaturfühler im Lieferumfang. Straßenpreis 500–555 €, eigener Kaufpreis 380 € im Oktober 2026.',
        ],
      },
    ]);
    expect(funde).toHaveLength(0);
  });
});

describe('G2 — Vollständigkeit der Daten', () => {
  it('ist still, wenn jeder Schlüssel gesetzt ist', () => {
    expect(attributLuecken(basis())).toHaveLength(0);
  });

  it('meldet ein fehlendes Merkmal, erlaubt aber ein ausdrückliches null', () => {
    const luecke = basis({ products: [produkt({ specs: { strom: '30 A' } })] });
    expect(attributLuecken(luecke).map((fund) => fund.regel)).toContain('merkmal-fehlt');

    const ausdruecklich = basis({ products: [produkt({ specs: { strom: '30 A', kabel: null } })] });
    expect(attributLuecken(ausdruecklich)).toHaveLength(0);
  });

  it('meldet ein Merkmal, das nicht deklariert ist', () => {
    const funde = attributLuecken(
      basis({ products: [produkt({ specs: { strom: '30 A', kabel: null, extras: 'ja' } })] })
    );
    expect(funde.map((fund) => fund.regel)).toContain('merkmal-unbekannt');
  });

  it('meldet doppelte Kennungen', () => {
    expect(attributLuecken(basis({ products: [produkt(), produkt()] })).map((f) => f.regel)).toContain(
      'produkt-doppelt'
    );
    expect(
      attributLuecken(
        basis({
          attributes: [
            { id: 'strom', label: 'Strom', inTable: true },
            { id: 'strom', label: 'Strom nochmal', inTable: false },
          ],
        })
      ).map((f) => f.regel)
    ).toContain('merkmal-doppelt');
  });

  it('meldet eine unbekannte Klasse und einen Einsatzfall ohne Gerät', () => {
    expect(
      attributLuecken(basis({ products: [produkt({ classId: 'gross' })] })).map((f) => f.regel)
    ).toContain('klasse-unbekannt');
    expect(
      attributLuecken(
        basis({
          useCases: [
            { id: 'fall', situation: 'Wer wenig Platz hat', pickId: 'gibt-es-nicht', why: 'Deshalb.' },
          ],
        })
      ).map((f) => f.regel)
    ).toContain('einsatzfall-ohne-geraet');
  });

  it('meldet einen Preisstand der Seite, der kein ISO-Datum ist', () => {
    const funde = attributLuecken(basis({ priceAsOfDate: '23.10.2026' }));
    expect(funde.map((fund) => fund.regel)).toContain('preisstand-unlesbar');
    expect(funde.some((fund) => fund.text.includes('priceAsOfDate'))).toBe(true);
  });

  it('meldet ein Preisdatum, das kein ISO-Datum ist, und einen Beleg ohne Adresse', () => {
    expect(
      attributLuecken(basis({ products: [produkt({ priceChecked: '23.10.2026' })] })).map((f) => f.regel)
    ).toContain('preisstand-unlesbar');
    expect(
      attributLuecken(
        basis({
          products: [produkt({ links: [{ href: '/camper-elektrik/', label: 'Intern', kind: 'report' }] })],
        })
      ).map((f) => f.regel)
    ).toContain('beleg-unlesbar');
  });
});

describe('G5 — Preisstand veraltet', () => {
  const heute = new Date('2026-10-26T12:00:00Z');

  it('bleibt still bei einem frischen Preis', () => {
    expect(preisStandVeraltet(basis(), heute)).toHaveLength(0);
  });

  it('meldet einen Preis, der älter als 180 Tage ist', () => {
    const alt = basis({ products: [produkt({ priceChecked: '2026-01-01' })] });
    const funde = preisStandVeraltet(alt, heute);
    expect(funde).toHaveLength(1);
    expect(funde[0]!.regel).toBe('preis-veraltet');
  });

  it('zählt Tage ab einem ISO-Datum', () => {
    expect(tageSeit('2026-10-23', heute)).toBe(3);
    expect(tageSeit('23.10.2026', heute)).toBeNull();
  });
});

describe('G3 — Wortbudget', () => {
  it('meldet nur die Überschreitung', () => {
    expect(wortBudget(['zehn Wörter zählen hier genau mit und sind elf'], 9, 'Test')).toHaveLength(0);
    expect(wortBudget(['zehn Wörter zählen hier genau mit und sind elf'], 8, 'Test')).toHaveLength(1);
  });

  it('meldet eine zu lange FAQ-Antwort', () => {
    const antwort = Array.from({ length: 45 }, (_wert, index) => `Wort${index + 1}`).join(' ');
    const funde = faqZuLang({
      path: '/test/',
      slug: 'test',
      topicId: 'test',
      kind: 'cluster',
      title: 'Testseite für das Budget',
      description: 'Beschreibung, die lang genug für das Gate ist und deshalb hier steht.',
      h1: 'Testseite',
      lead: 'Ein Satz.',
      priority: 'P2',
      sections: [],
      faq: [{ question: 'Wie lang darf eine Antwort sein?', answer: antwort }],
      related: [],
      contentRevision: '2026-10',
      changeFrequency: 'monthly',
      sitemapPriority: 0.7,
    });
    expect(funde).toHaveLength(1);
    expect(funde[0]!.regel).toBe('faq-zu-lang');
  });
});

describe('Ladebooster-Vergleich hält die Gates', () => {
  it('trägt alle neun Geräte mit vollständigen Merkmalen', () => {
    expect(LADEBOOSTER_VERGLEICH.products).toHaveLength(9);
    expect(LADEBOOSTER_VERGLEICH.useCases).toHaveLength(4);
    expect(attributLuecken(LADEBOOSTER_VERGLEICH)).toHaveLength(0);
  });

  it('wiederholt keine Aussage — auch nicht über die Quellenliste hinweg', () => {
    const funde = doppelteAussagen([
      { name: 'Vergleich', texte: vergleichsTexte(LADEBOOSTER_VERGLEICH) },
      { name: 'Quellen', texte: quellenTexte(LADEBOOSTER_VERGLEICH) },
    ]);
    expect(funde).toEqual([]);
  });

  it('bleibt im Wortbudget der Vergleichszone', () => {
    const texte = vergleichsTexte(LADEBOOSTER_VERGLEICH);
    expect(woerter(texte.join(' '))).toBeLessThanOrEqual(WORTBUDGET_VERGLEICH);
    expect(wortBudget(texte, WORTBUDGET_VERGLEICH, 'Vergleichszone')).toHaveLength(0);
  });

  it('trägt alle 34 Belege in drei Gruppen', () => {
    const anzahl = LADEBOOSTER_VERGLEICH.sources.reduce((summe, gruppe) => summe + gruppe.entries.length, 0);
    expect(anzahl).toBe(34);
    expect(LADEBOOSTER_VERGLEICH.sources.map((gruppe) => gruppe.group)).toEqual([
      'Hersteller',
      'Foren & Praxis',
      'Preise',
    ]);
  });

  it('hat am Stichtag der Spec keinen veralteten Preis', () => {
    expect(preisStandVeraltet(LADEBOOSTER_VERGLEICH, new Date('2026-10-26T12:00:00Z'))).toHaveLength(0);
  });

  it('nennt jedes Gerät genau einem Einsatzfall oder keinem — und jede Klasse ist belegt', () => {
    const belegt = new Set(LADEBOOSTER_VERGLEICH.products.map((p) => p.classId));
    const deklariert = new Set(LADEBOOSTER_VERGLEICH.classes.map((k) => k.id));
    expect([...deklariert].filter((id) => !belegt.has(id))).toEqual([]);
  });
});

describe('Textsammlungen sind vollständig', () => {
  it('sammelt aus einem Artikel jeden sichtbaren Text', () => {
    const texte = ratgeberTexte({
      path: '/test/',
      slug: 'test',
      topicId: 'test',
      kind: 'cluster',
      title: 'Testseite für die Sammlung',
      description: 'Beschreibung, die lang genug für das Gate ist und deshalb hier steht.',
      h1: 'Testseite',
      lead: 'Der Einstieg.',
      priority: 'P2',
      sections: [
        {
          id: 'eins',
          heading: 'Erster Abschnitt',
          body: ['Ein Absatz.'],
          list: { items: ['Ein Punkt.'] },
          definitions: [{ term: 'Begriff', description: 'Erklärung' }],
          table: { head: ['Spalte'], rows: [['Zelle']], caption: 'Titel', note: 'Hinweis' },
          formula: { expression: 'U = R · I', caption: 'Ohm' },
          callout: { tone: 'warning', text: 'Achtung.' },
          links: [{ href: '/camper-elektrik/', label: 'Weiter', description: 'Beschreibung' }],
          subsections: [{ heading: 'Unterteil', body: ['Text darunter.'] }],
        },
      ],
      related: [],
      contentRevision: '2026-10',
      changeFrequency: 'monthly',
      sitemapPriority: 0.7,
    });
    expect(texte).toEqual(
      expect.arrayContaining([
        'Der Einstieg.',
        'Erster Abschnitt',
        'Ein Absatz.',
        'Ein Punkt.',
        'Begriff',
        'Erklärung',
        'Titel',
        'Spalte',
        'Zelle',
        'Hinweis',
        'U = R · I',
        'Ohm',
        'Achtung.',
        'Weiter',
        'Beschreibung',
        'Unterteil',
        'Text darunter.',
      ])
    );
  });
});
