/**
 * lib/seo/comparisons/gates.ts — die Regeln, die ein Vergleich erfüllen muss.
 *
 * Warum Funktionen und keine Konventionen: Der erste Vergleich dieser Seite
 * wiederholte drei Aussagen je dreimal fast wortgleich, zeigte denselben
 * Gerätebestand in vier Darstellungen und trug einen Preisstand, der an drei
 * Stellen stand. Nichts davon wäre aufgefallen — es gab keine Stelle, die es
 * hätte melden können.
 *
 * Jede Regel hier gibt Funde zurück statt zu werfen, damit ein Test die
 * vollständige Liste sehen kann und damit dieselben Funktionen später für
 * weitere Vergleiche laufen (Wechselrichter, LiFePO4).
 *
 * Kein React, keine App-Importe (ARCHITECTURE-RULES Rule A).
 */

import type { SeoPageContent } from '../types';
import type { ComparisonSpec } from './types';

/** Ab dieser Länge ist eine Wiederholung eine Aussage und keine Floskel. */
export const MIN_DOPPEL_ZEICHEN = 60;

/**
 * Länge einer gemeinsamen Wortfolge, ab der zwei Aussagen als doppelt gelten.
 *
 * Der Wert ist an den drei Wiederholungen des Bestands geeicht, nicht geraten:
 * „und eine stillgelegte EBL-Ladung sind Pflicht" (7 Wörter), „nennt 120 A und
 * 1.620 W" (6), „Im Hybridbetrieb liefert jede Quelle maximal 25 A" (8). Alle
 * drei Paare schlägt die Regel bei Folge ≥ 6 an — nachzuprüfen in
 * `gates.test.ts`. Ein Wortfolgen-Maß ist nötig, weil Umformulieren weder die
 * Wortmenge noch die Reihenfolge erhält: Jaccard-Ähnlichkeit über Wortmengen
 * lag für dieselben Paare bei 0,43 und über 5er-Folgen bei 0,04, hätte also
 * nichts gemeldet.
 */
export const MIN_GEMEINSAME_FOLGE = 6;

/** Tage, nach denen ein Preis als ungeprüft gilt (G5). */
export const PREIS_MAX_TAGE = 180;

/** Autorentext der Vergleichszone ohne Quellenverzeichnis (G3). */
export const WORTBUDGET_VERGLEICH = 700;

/** Autorentext der Ratgeber-Abschnitte (G3). */
export const WORTBUDGET_RATGEBER = 1300;

/** Wörter je FAQ-Antwort — kurz genug für eine direkte Antwort (G3). */
export const WORTBUDGET_FAQ_ANTWORT = 40;

export type Fund = { regel: string; text: string };

/** Wörter eines Textes: alles, was mindestens einen Buchstaben oder eine Ziffer trägt. */
export function woerter(text: string): number {
  return text.split(/\s+/).filter((wort) => /[\p{L}\p{N}]/u.test(wort)).length;
}

/**
 * Vergleichsform eines Textes: interne Verweise auf ihren Ankertext reduziert,
 * Satzzeichen entfernt, Zwischenraum geglättet, Kleinbuchstaben.
 *
 * Satzzeichen zählen nicht mit, sonst entscheidet ein Semikolon darüber, ob zwei
 * Sätze dieselbe Aussage wiederholen: Im Bestand endete dieselbe Pflicht einmal
 * mit „… sind Pflicht; die Lichtmaschine …" und einmal mit „… sind Pflicht.".
 * `RichText` nutzt `[Text](/ziel/)`, und dasselbe Ziel mit anderem Ankertext
 * soll nicht als neue Aussage zählen.
 */
export function normalisiert(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

type Aussage = { quelle: string; text: string; norm: string; woerterListe: string[] };

/**
 * Länge der längsten gemeinsamen Wortfolge zweier Aussagen.
 *
 * Klassische längste-gemeinsame-Teilfolge auf Wortgrenzen statt Zeichen:
 * „Eingang 12–15 V" und „Eingang 1.350 W" teilen das Wort „Eingang", aber keine
 * Folge — und genau deshalb zählt die Folge, nicht der Wortschatz.
 */
export function gemeinsameFolge(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let vorige = new Array<number>(b.length + 1).fill(0);
  let beste = 0;
  for (let i = 1; i <= a.length; i += 1) {
    const aktuelle = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        aktuelle[j] = vorige[j - 1]! + 1;
        if (aktuelle[j]! > beste) beste = aktuelle[j]!;
      }
    }
    vorige = aktuelle;
  }
  return beste;
}

function aussagenVon(quellen: readonly { name: string; texte: readonly string[] }[]): Aussage[] {
  return quellen.flatMap(({ name, texte }) =>
    texte.map((text) => {
      const norm = normalisiert(text);
      return {
        quelle: name,
        text,
        norm,
        woerterListe: norm.split(' ').filter((wort) => wort.length > 0),
      };
    })
  );
}

/**
 * G1 — keine Aussage doppelt.
 *
 * Zwei Stufen, weil die Wiederholungen im Bestand nicht bytegleich waren:
 * `doppelter-text` für identische Aussagen und `doppelte-aussage` für eine
 * gemeinsame Wortfolge ab `MIN_GEMEINSAME_FOLGE`.
 *
 * Grenze des Maßes, ausdrücklich: dieselbe Tatsache in vollständig anderen
 * Worten erkennt die Regel nicht. Sie hält den Text kurz, indem sie verhindert,
 * dass ein Satz zweimal auf der Seite steht — nicht, indem sie Inhalte prüft.
 */
export function doppelteAussagen(
  quellen: readonly { name: string; texte: readonly string[] }[],
  grenzen: { minZeichen?: number; minFolge?: number } = {}
): Fund[] {
  const minZeichen = grenzen.minZeichen ?? MIN_DOPPEL_ZEICHEN;
  const minFolge = grenzen.minFolge ?? MIN_GEMEINSAME_FOLGE;
  const aussagen = aussagenVon(quellen).filter((a) => a.norm.length >= minZeichen);
  const funde: Fund[] = [];

  for (let i = 0; i < aussagen.length; i += 1) {
    for (let j = i + 1; j < aussagen.length; j += 1) {
      const a = aussagen[i]!;
      const b = aussagen[j]!;
      if (a.norm === b.norm) {
        funde.push({
          regel: 'doppelter-text',
          text: `${a.quelle} und ${b.quelle}: „${a.text.slice(0, 70)}" steht zweimal.`,
        });
        continue;
      }
      const folge = gemeinsameFolge(a.woerterListe, b.woerterListe);
      if (folge >= minFolge) {
        funde.push({
          regel: 'doppelte-aussage',
          text: `${a.quelle} und ${b.quelle}: ${folge} gemeinsame Wörter in Folge, erlaubt sind ${minFolge - 1}.`,
        });
      }
    }
  }
  return funde;
}

/**
 * Autorentext der Vergleichszone — alles, was gerendert wird, außer dem
 * Quellenverzeichnis. Die Quellen sind Belegliste, nicht Lesetext; sie zählen
 * für das Budget nicht, wohl aber für G1.
 */
export function vergleichsTexte(spec: ComparisonSpec): string[] {
  return [
    spec.heading,
    spec.tableLabel,
    spec.tableCaption,
    spec.noRatingNote,
    spec.priceAsOf,
    ...spec.attributes.flatMap((attribut) => [
      attribut.label,
      ...(attribut.unit ? [attribut.unit] : []),
      ...(attribut.legend ? [attribut.legend] : []),
    ]),
    ...spec.classes.map((klasse) => klasse.label),
    ...spec.products.flatMap((produkt) => [
      produkt.brand,
      produkt.name,
      ...Object.values(produkt.specs).flatMap((wert) => (typeof wert === 'string' ? [wert] : [])),
      produkt.fit.label,
      ...produkt.caveats.map((hinweis) => hinweis.text),
      ...produkt.detail,
      ...produkt.links.map((verweis) => verweis.label),
    ]),
    ...spec.useCases.flatMap((fall) => [fall.situation, fall.why]),
  ];
}

/**
 * Beleglisten des Vergleichs: getrennt gezählt, aber Teil der Duplikatprüfung.
 *
 * Adressen zählen nicht mit. Derselbe Beleg steht absichtlich zweimal auf der
 * Seite — einmal am Gerät als Kurzverweis und einmal im Quellenverzeichnis.
 * Geprüft werden Aussagen, nicht Pfade.
 */
export function quellenTexte(spec: ComparisonSpec): string[] {
  return spec.sources.flatMap((gruppe) => [gruppe.group, ...gruppe.entries.map((eintrag) => eintrag.label)]);
}

/** Autorentext der Ratgeber-Abschnitte einer Seite. */
export function ratgeberTexte(page: SeoPageContent): string[] {
  return [
    page.lead,
    ...page.sections.flatMap((section) => [
      section.heading,
      ...(section.body ?? []),
      ...(section.list?.items ?? []),
      ...(section.definitions ?? []).flatMap((begriff) => [begriff.term, begriff.description]),
      ...(section.table
        ? [
            section.table.caption ?? '',
            ...(section.table.head ?? []),
            ...section.table.rows.flat(),
            section.table.note ?? '',
          ]
        : []),
      ...(section.formula ? [section.formula.expression, section.formula.caption ?? ''] : []),
      ...(section.callout ? [section.callout.text] : []),
      ...(section.links ?? []).flatMap((verweis) => [verweis.label, verweis.description ?? '']),
      ...(section.subsections ?? []).flatMap((teil) => [teil.heading, ...teil.body]),
    ]),
  ];
}

/** G3 — Wortbudget einer Textmenge. */
export function wortBudget(texte: readonly string[], grenze: number, name: string): Fund[] {
  const anzahl = woerter(texte.filter((text) => text.length > 0).join(' '));
  return anzahl > grenze
    ? [{ regel: 'wortbudget', text: `${name}: ${anzahl} Wörter, erlaubt sind ${grenze}.` }]
    : [];
}

/** G3 — FAQ-Antworten bleiben kurz genug für eine direkte Antwort. */
export function faqZuLang(page: SeoPageContent, grenze = WORTBUDGET_FAQ_ANTWORT): Fund[] {
  return (page.faq ?? [])
    .map((eintrag) => ({ eintrag, anzahl: woerter(eintrag.answer) }))
    .filter(({ anzahl }) => anzahl > grenze)
    .map(({ eintrag, anzahl }) => ({
      regel: 'faq-zu-lang',
      text: `„${eintrag.question}": ${anzahl} Wörter, erlaubt sind ${grenze}.`,
    }));
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Tage zwischen zwei ISO-Daten; `null`, wenn eines nicht lesbar ist. */
export function tageSeit(von: string, bis: Date): number | null {
  if (!ISO_DATUM.test(von)) return null;
  const start = Date.parse(`${von}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  return Math.floor((bis.getTime() - start) / 86_400_000);
}

/**
 * G2 — Vollständigkeit der Daten.
 *
 * `specs` muss jeden deklarierten Merkmals-`id` als Schlüssel tragen. Ein
 * explizites `null` heißt „nachgesehen, nicht belegt" und ist erlaubt; ein
 * fehlender Schlüssel heißt „vergessen" und ist ein Fund. Genau dieser
 * Unterschied ist der Zweck der Regel.
 */
export function attributLuecken(spec: ComparisonSpec): Fund[] {
  const funde: Fund[] = [];
  const merkmalIds = new Set<string>();

  for (const attribut of spec.attributes) {
    if (merkmalIds.has(attribut.id))
      funde.push({ regel: 'merkmal-doppelt', text: `Merkmal „${attribut.id}" ist zweimal deklariert.` });
    merkmalIds.add(attribut.id);
  }

  const klasseIds = new Set(spec.classes.map((klasse) => klasse.id));
  const produktIds = new Set<string>();

  for (const produkt of spec.products) {
    if (produktIds.has(produkt.id))
      funde.push({ regel: 'produkt-doppelt', text: `Produkt „${produkt.id}" ist zweimal eingetragen.` });
    produktIds.add(produkt.id);

    if (!klasseIds.has(produkt.classId))
      funde.push({
        regel: 'klasse-unbekannt',
        text: `${produkt.name}: Klasse „${produkt.classId}" ist nicht deklariert.`,
      });

    for (const id of merkmalIds) {
      if (!(id in produkt.specs))
        funde.push({
          regel: 'merkmal-fehlt',
          text: `${produkt.name}: Merkmal „${id}" fehlt — auch „nicht belegt" muss als null stehen.`,
        });
    }
    for (const id of Object.keys(produkt.specs)) {
      if (!merkmalIds.has(id))
        funde.push({ regel: 'merkmal-unbekannt', text: `${produkt.name}: „${id}" ist kein Merkmal.` });
    }

    if (produkt.priceEur !== null) {
      if (!ISO_DATUM.test(produkt.priceChecked))
        funde.push({
          regel: 'preisstand-unlesbar',
          text: `${produkt.name}: priceChecked „${produkt.priceChecked}" ist kein ISO-Datum.`,
        });
    }
    for (const verweis of produkt.links) {
      if (!/^https:\/\//.test(verweis.href))
        funde.push({
          regel: 'beleg-unlesbar',
          text: `${produkt.name}: „${verweis.label}" ohne https-Adresse.`,
        });
    }
  }

  for (const fall of spec.useCases) {
    if (!produktIds.has(fall.pickId))
      funde.push({
        regel: 'einsatzfall-ohne-geraet',
        text: `Einsatzfall „${fall.id}" verweist auf „${fall.pickId}", das es nicht gibt.`,
      });
  }

  if (!ISO_DATUM.test(spec.priceAsOfDate))
    funde.push({
      regel: 'preisstand-unlesbar',
      text: `priceAsOfDate „${spec.priceAsOfDate}" ist kein ISO-Datum.`,
    });

  return funde;
}

/**
 * G5 — Preisstand veraltet.
 *
 * Ein beobachteter Straßenpreis ist eine Zusage an den Leser. Ohne diese Regel
 * altert sie still, und genau das ist im Bestand passiert: Der Preisstand stand
 * dreimal im Markup, gepflegt wurde er an keiner Stelle.
 */
export function preisStandVeraltet(spec: ComparisonSpec, heute: Date, maxTage = PREIS_MAX_TAGE): Fund[] {
  const funde: Fund[] = [];
  for (const produkt of spec.products) {
    if (produkt.priceEur === null) continue;
    const tage = tageSeit(produkt.priceChecked, heute);
    if (tage === null) continue;
    if (tage > maxTage)
      funde.push({
        regel: 'preis-veraltet',
        text: `${produkt.name}: Preisstand ${produkt.priceChecked} ist ${tage} Tage alt, erlaubt sind ${maxTage}.`,
      });
  }
  return funde;
}
