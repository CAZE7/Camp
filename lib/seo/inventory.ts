/**
 * lib/seo/inventory.ts — das Seiteninventar der Auslieferung.
 *
 * Es beantwortet die Frage „welche Seiten existieren und welche Suchintention
 * bedienen sie?" maschinenlesbar (§4) und ist die EINZIGE Quelle dafür:
 *
 *   - `app/sitemap.ts` leitet die Sitemap daraus ab,
 *   - `scripts/seo/auditExport.ts` prüft den gebauten Export dagegen,
 *   - `scripts/seo/report.ts` erzeugt daraus die Inventardokumentation,
 *   - die Prüfungen für Thin Content, Verlinkung und Intent-Abdeckung lesen es.
 *
 * Warum bestehende Seiten hier ausdrücklich stehen und nicht aus dem Export
 * abgeleitet werden: Eine Prüfung, die ihre Erwartung aus dem Prüfling zieht,
 * prüft nichts. Dieses Inventar ist auch die Quelle der Metadaten für die
 * bestehenden statischen Routen; datengetriebene Inhalte übernehmen dieselben
 * Felder aus `content/`. Der Export wird dagegen geprüft, nie als Wahrheit
 * verwendet.
 */

import { CONTENT_PAGES } from './content';
import { queriesForPage } from './opportunities';
import { topicOf } from './topics';
import type { PageEntry, StructuredDataType } from './types';

/** Bestehende Route, deren vollständige Kopfdaten hier definiert werden. */
type LegacyPage = Omit<PageEntry, 'targetQueries'>;

/**
 * Bestehende Seiten der Auslieferung. `source` nennt die Datei, in der Titel,
 * Beschreibung und Abschnitte stehen — damit eine Änderung dort nicht
 * unbemerkt am Inventar vorbeiläuft.
 */
const EXISTING_PAGES: readonly LegacyPage[] = [
  {
    path: '/',
    label: 'Startseite',
    kind: 'start',
    indexability: 'index',
    h1: 'Camper-Ausbau planen: erst der Plan, dann das Blech.',
    title: 'Camper-Ausbau planen: Elektrik, Dach und Heizlast',
    absoluteTitle: true,
    description:
      'Werkstatt für den Camper-Ausbau: Schaltplan mit Kabelquerschnitt und Absicherung, Dachbelegung, Heizlast und die Reihenfolge der Gewerke.',
    searchIntent: 'Überblick: welche Werkzeuge und Wissensseiten es für den Camper-Ausbau gibt.',
    topicId: 'start',
    priority: 'P0',
    // H1 trägt den Hauptsuchbegriff („Camper-Ausbau planen“) — der Anspruch
    // („erst der Plan, dann das Blech“) bleibt, die Einordnung kommt dazu.
    // FAQPage: Die fünf Fragen stehen sichtbar auf der Startseite
    // (`HOME_FAQ` in `app/page.tsx`) und werden aus derselben Quelle
    // ausgezeichnet; `checkStructuredData` vergleicht Frage und Antwort
    // Zeichen für Zeichen mit dem sichtbaren Akkordeon.
    structuredData: ['WebPage', 'FAQPage'],
    sitemap: { changeFrequency: 'monthly', priority: 1 },
    // Belegte Inhaltsänderung: Commit 0b794ab (2026-10-28T09:33:28Z) hat den sichtbaren Text der Startseite ersetzt (Einordnung, FAQ).
    lastReviewed: '2026-10-28',
    source: 'app/page.tsx',
  },
  {
    path: '/elektrik-planung/',
    label: 'Camper-Elektroplaner',
    kind: 'werkzeug',
    indexability: 'index',
    h1: 'Camper-Elektrik berechnen',
    title: 'Camper Elektrik berechnen: 12V Kabelquerschnitt & Batterie-Planer',
    absoluteTitle: true,
    description:
      'Wohnmobil-Elektrik präzise dimensionieren: Leitungsquerschnitt nach DIN berechnen, Batteriekapazität bestimmen und autarkes 12V-System sicher planen.',
    searchIntent: 'eine 12-V-Leitung berechnen und die gesamte Anlage als Schaltplan zeichnen.',
    topicId: 'camper-elektrik',
    priority: 'P0',
    structuredData: ['WebPage', 'BreadcrumbList', 'WebApplication', 'FAQPage'],
    calculators: ['kabelquerschnitt'],
    ogImage: {
      path: '/og/elektrik-planung.png',
      width: 1200,
      height: 630,
      alt: 'Elektroplaner — Camper-Elektrik berechnen und 12-V-Anlage sicher dimensionieren',
    },
    sitemap: { changeFrequency: 'monthly', priority: 0.9 },
    source: 'app/elektrik-planung/page.tsx',
  },
  {
    /**
     * Die Zeichenanwendung selbst — eine eigene Route, damit sie das ganze
     * Browserfenster bekommt.
     *
     * Warum nicht weiterhin `/elektrik-planung/#planer`: Der Planer führt feste
     * Spaltenbreiten und eine eigene Anwendungsshell (Menüleiste, Werkzeugleiste,
     * Statuszeile) und stand dort als `h-dvh`-Block zwischen Rechner, Normtext
     * und Fragen — unter der 48-px-Kopfleiste der Website und über dem Seitenfuß.
     * Zwei Anwendungen (Dokument und Editor) teilten sich ein Scroll-Dokument.
     * Auf eigener Route füllt der Editor den ersten Bildschirm: kein Text
     * davor, kein Versatz, die Zeichenfläche beginnt bei y = 0. Darunter —
     * erst nach einem Bildschirm Scrollen — steht der statische Erklärtext
     * mit FAQ (`PlanerSeoContent`), damit Crawler mehr sehen als den
     * Ladezustand der Client-Anwendung.
     *
     * `/elektrik-planung/` bleibt die Wissens- und Rechnerseite des Themas und
     * verweist kontextuell hierher (Linkgraph-Regel `kontextuelle-verwaiste-seite`).
     *
     * Titel und Beschreibung bedienen ausdrücklich die Anfrage nach einem
     * kostenlosen Programme: „Programm" ist das Wort, mit dem in Deutschland
     * nach Software gesucht wird, „kostenlos" die Bedingung, unter der die
     * Zielgruppe überhaupt sucht. Der Wortlaut steht sowohl im Titel als auch
     * in der Hauptüberschrift (`PlanerSeoContent`), damit Überschrift und
     * Snippet dasselbe Versprechen geben.
     */
    path: '/planer/',
    label: 'Elektroplaner (Vollbild)',
    kind: 'werkzeug',
    indexability: 'index',
    h1: 'Camper-Schaltplan kostenlos erstellen',
    title: 'Kostenloses Programm für den Camper-Schaltplan',
    description:
      'Kostenloses Programm für den Camper-Schaltplan: Bauteile setzen, verdrahten lassen und Querschnitt, Sicherung und Spannungsfall prüfen — ohne Anmeldung.',
    searchIntent:
      'ein kostenloses Programm für den Camper-Schaltplan finden und die ganze Anlage damit zeichnen lassen.',
    topicId: 'camper-elektrik',
    priority: 'P0',
    // FAQPage + BreadcrumbList: Die Fragen stehen sichtbar unter der
    // Anwendung (`PlanerSeoContent`), die Brotkrumen beschreiben den Weg
    // Startseite → Planer. Ohne sichtbare Entsprechung kein Schema.
    structuredData: ['WebPage', 'BreadcrumbList', 'WebApplication', 'FAQPage'],
    ogImage: {
      path: '/og/elektrik-planung.png',
      width: 1200,
      height: 630,
      alt: 'Camper-Elektroplaner — Schaltplan im Vollbild mit Bauteilkatalog und Zeichenfläche',
    },
    sitemap: { changeFrequency: 'monthly', priority: 0.9 },
    source: 'app/planer/page.tsx',
  },
  {
    path: '/tools/dach/',
    label: 'Dach-Planer',
    kind: 'werkzeug',
    indexability: 'index',
    h1: 'Dach-Planer',
    title: 'Dach-Planer: Solarpanels und Dachluken platzieren',
    description:
      'Solarpanels, Dachluken und Kabeldurchlässe auf der Dachfläche platzieren, Belegung prüfen und die Gesamtleistung in Watt ablesen.',
    searchIntent: 'Solarpanels und Dachluken auf der Dachfläche platzieren und die Gesamtleistung ablesen.',
    topicId: 'dachplanung',
    priority: 'P1',
    // FAQPage: Die vier Fragen stehen sichtbar unter der Werkfläche
    // (`app/tools/dach/explainerContent.ts`) — dieselbe Quelle für Anzeige
    // und Auszeichnung.
    structuredData: ['WebPage', 'WebApplication', 'FAQPage'],
    ogImage: {
      path: '/og/dach.png',
      width: 1200,
      height: 630,
      alt: 'Solarpanels auf dem Dach eines Campers',
    },
    sitemap: { changeFrequency: 'monthly', priority: 0.8 },
    // Belegte Inhaltsänderung: Commit 0b794ab (2026-10-28T09:33:28Z) hat den Erklärblock ergänzt (243 → 752 Wörter).
    lastReviewed: '2026-10-28',
    source: 'app/tools/dach/layout.tsx',
  },
  {
    path: '/tools/heizung/',
    label: 'Heizlast-Rechner',
    kind: 'werkzeug',
    indexability: 'index',
    h1: 'Heizlast-Rechner',
    title: 'Heizlast-Rechner für Wohnmobil und Camper',
    description:
      'Benötigte Heizleistung aus Fahrzeuggröße, Dämmung und Wunschtemperatur berechnen — inklusive Empfehlung, welches Heizgerät passt.',
    searchIntent: 'die nötige Heizleistung aus Fahrzeug, Dämmung und Wunschtemperatur bestimmen.',
    topicId: 'heizlast',
    priority: 'P1',
    // FAQPage: Die vier Fragen stehen sichtbar unter dem Rechner
    // (`app/tools/heizung/explainerContent.ts`).
    structuredData: ['WebPage', 'WebApplication', 'FAQPage'],
    ogImage: {
      path: '/og/heizung.png',
      width: 1200,
      height: 630,
      alt: 'Heizlast-Rechner für Wohnmobil und Camper',
    },
    sitemap: { changeFrequency: 'monthly', priority: 0.8 },
    // Belegte Inhaltsänderung: Commit 0b794ab (2026-10-28T09:33:28Z) hat den Erklärblock ergänzt (472 → 1 024 Wörter).
    lastReviewed: '2026-10-28',
    source: 'app/tools/heizung/layout.tsx',
  },
  {
    path: '/guides/ausbau-fahrplan/',
    label: 'Ausbau-Fahrplan',
    kind: 'ratgeber',
    indexability: 'index',
    h1: 'Ausbau-Fahrplan',
    title: 'Ausbau-Fahrplan: Reihenfolge der Gewerke',
    description:
      'Vom Entkernen bis zum Möbelbau: die Reihenfolge für den Camper-Ausbau, mit den Fehlern, die dich sonst zwei Schritte zurückwerfen.',
    searchIntent: 'die Reihenfolge der Gewerke beim Camper-Ausbau kennen.',
    topicId: 'ausbau',
    priority: 'P2',
    structuredData: ['WebPage', 'BreadcrumbList'],
    ogImage: {
      path: '/og/ausbau-fahrplan.png',
      width: 1200,
      height: 630,
      alt: 'Ausbau-Fahrplan: Reihenfolge der Gewerke',
    },
    sitemap: { changeFrequency: 'monthly', priority: 0.6 },
    source: 'app/guides/ausbau-fahrplan/page.tsx',
  },
  {
    path: '/guides/camper-ausbauguide/',
    label: 'Camper-Ausbauguide',
    kind: 'ratgeber',
    indexability: 'index',
    h1: 'Der ultimative Camper-Ausbau-Guide: Von der leeren Blechbüchse zum rollenden Zuhause',
    title: 'Camper-Ausbauguide: Technik, Normen und Praxis',
    description:
      'Wissen für den Ausbau: Karosserie, Dämmung, 12-V-Elektrik, Gas und TÜV — verständlich erklärt, mit Normbezug und Praxiswerten.',
    searchIntent: 'Wissen zu Karosserie, Dämmung, Elektrik, Gas und TÜV nachlesen.',
    topicId: 'ausbau',
    priority: 'P1',
    structuredData: ['WebPage', 'BreadcrumbList'],
    ogImage: {
      path: '/og/camper-guide.png',
      width: 1200,
      height: 630,
      alt: 'Camper-Ausbauguide: Technik, Normen und Praxis',
    },
    sitemap: { changeFrequency: 'monthly', priority: 0.6 },
    source: 'app/guides/camper-ausbauguide/page.tsx',
  },
  {
    path: '/guides/holzausbau/',
    label: 'Holzausbau',
    kind: 'ratgeber',
    indexability: 'index',
    h1: 'Holzausbau im Camper: sechs Schritte',
    title: 'Holzausbau im Camper: sechs Schritte',
    description:
      'Möbelbau im Camper in sechs Schritten: Unterkonstruktion, Wandverkleidung, Stauraum, Befestigung und Oberflächen — mit Materialwahl und Gewicht.',
    searchIntent: 'Möbelbau im Camper in sechs Schritten umsetzen.',
    topicId: 'ausbau',
    priority: 'P3',
    structuredData: ['WebPage', 'BreadcrumbList'],
    ogImage: {
      path: '/og/holzausbau.png',
      width: 1200,
      height: 630,
      alt: 'Holzausbau im Camper: sechs Schritte',
    },
    sitemap: { changeFrequency: 'monthly', priority: 0.5 },
    source: 'app/guides/holzausbau/page.tsx',
  },
  {
    path: '/guides/',
    label: 'Guides',
    kind: 'pillar',
    indexability: 'index',
    h1: 'Guides für den Camper-Ausbau',
    title: 'Guides für den Camper-Ausbau: Reihenfolge',
    description:
      'Alle Leitfäden für den Camper-Ausbau: Reihenfolge der Gewerke, Technik mit Normbezug und Möbelbau — in der Reihenfolge, in der du sie brauchst.',
    searchIntent: 'die passenden Leitfäden für den Camper-Ausbau finden.',
    topicId: 'ausbau',
    priority: 'P1',
    structuredData: ['WebPage', 'BreadcrumbList'],
    sitemap: { changeFrequency: 'monthly', priority: 0.7 },
    source: 'app/guides/page.tsx',
  },
  {
    path: '/impressum/',
    label: 'Impressum',
    kind: 'rechtliches',
    indexability: 'index',
    h1: 'Impressum',
    title: 'Impressum',
    description: 'Anbieterkennzeichnung nach § 5 DDG: Anbieter, Anschrift und Kontakt dieser Seite.',
    searchIntent: 'Anbieterkennzeichnung und Kontaktweg finden.',
    topicId: 'rechtliches',
    priority: 'P3',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'yearly', priority: 0.3 },
    // Belegte Inhaltsänderung: Commit a3e885e (2026-10-28T09:33:33Z) hat die Anbieterkennzeichnung gefüllt.
    lastReviewed: '2026-10-28',
    source: 'app/impressum/page.tsx',
  },
  {
    path: '/datenschutz/',
    label: 'Datenschutz',
    kind: 'rechtliches',
    indexability: 'index',
    h1: 'Datenschutz',
    title: 'Datenschutz',
    description:
      'Welche Daten diese Seite verarbeitet, wo sie gespeichert werden und welche Rechte du nach DSGVO hast.',
    searchIntent: 'nachlesen, welche Daten die Seite verarbeitet.',
    topicId: 'rechtliches',
    priority: 'P3',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'yearly', priority: 0.3 },
    // Belegte Inhaltsänderung: Diese Fassung ersetzt die Kurzfassung mit 134 Wörtern (Art. 13 DSGVO).
    lastReviewed: '2026-10-28',
    source: 'app/datenschutz/page.tsx',
  },
  {
    path: '/design-system/',
    label: 'Design-System',
    kind: 'ansicht',
    indexability: 'noindex',
    h1: 'DARK ENGINEERING DESIGN SYSTEM',
    title: 'Design-System',
    description: 'Interne Übersicht der Bausteine, Zustände und Typografiestufen des Planers.',
    searchIntent: 'interne Übersicht der Bausteine — kein Inhalt für Ergebnislisten.',
    topicId: 'vertrauen',
    priority: 'P3',
    structuredData: [],
    source: 'app/design-system/page.tsx',
  },
  {
    /**
     * Alte Adresse der Vertrauensseite (`/ueber-werft/`).
     *
     * Der Pfad trug den früheren Produktnamen; die Seite liegt jetzt unter
     * `/ueber-elektroplaner/`. Diese Route antwortet weiter mit einer
     * Weiterleitung (meta refresh auf 0 Sekunden), damit bestehende Verweise
     * nicht ins Leere laufen — sie gehört aber nicht in den Index: Zwei
     * Adressen mit demselben Inhalt sind für Suchmaschinen Dubletten, und die
     * Auszeichnung „Weiterleitung" würde in Ergebnislisten nur verwirren.
     * Deshalb `noindex` und kein Sitemap-Eintrag.
     */
    path: '/ueber-werft/',
    label: 'Weiterleitung: Über Elektroplaner',
    kind: 'ansicht',
    indexability: 'noindex',
    h1: 'Weiterleitung: Über Elektroplaner',
    title: 'Über Elektroplaner',
    absoluteTitle: true,
    description: 'Diese Adresse ist umgezogen: Die Vertrauensseite liegt jetzt unter /ueber-elektroplaner/.',
    searchIntent: 'alte Adresse der Vertrauensseite — führt weiter, kein Inhalt für Ergebnislisten.',
    topicId: 'vertrauen',
    priority: 'P3',
    structuredData: [],
    source: 'app/ueber-werft/page.tsx',
  },
];

/** Technische Seiten: dreimal dieselbe Fehlerseite, nicht beworben, noindex. */
export const TECHNICAL_PAGES: readonly string[] = ['/404/', '/_not-found/'];

/** Strukturierte Daten, die jede inhaltsgetriebene Seite trägt. */
function structuredDataOf(hasFaq: boolean, hasCalculator: boolean): StructuredDataType[] {
  const types: StructuredDataType[] = ['WebPage', 'BreadcrumbList'];
  if (hasFaq) types.push('FAQPage');
  if (hasCalculator) types.push('WebApplication');
  return types;
}

/** Aus dem Inhalt abgeleiteter Inventareintrag. */
function entryOfContent(page: (typeof CONTENT_PAGES)[number]): PageEntry {
  const calculators = [
    ...new Set(page.sections.flatMap((section) => (section.calculator ? [section.calculator] : []))),
  ];
  const hasCalculator = calculators.length > 0;
  return {
    path: page.path,
    label: page.h1,
    kind: page.kind,
    indexability: 'index',
    h1: page.h1,
    searchIntent: page.lead,
    topicId: page.topicId,
    priority: page.priority,
    targetQueries: queriesForPage(page.path),
    structuredData: structuredDataOf((page.faq?.length ?? 0) > 0, hasCalculator),
    sitemap: { changeFrequency: page.changeFrequency, priority: page.sitemapPriority },
    source: `lib/seo/content/${page.slug}.ts`,
    title: page.title,
    description: page.description,
    ...(page.absoluteTitle ? { absoluteTitle: true } : {}),
    ...(page.ogImage ? { ogImage: page.ogImage } : {}),
    ...(hasCalculator ? { calculators } : {}),
    ...(page.lastReviewed ? { lastReviewed: page.lastReviewed } : {}),
  };
}

/** Alle Seiten der Auslieferung in Anzeigereihenfolge. */
export const PAGES: readonly PageEntry[] = [
  ...EXISTING_PAGES.map((page) => ({ ...page, targetQueries: queriesForPage(page.path) })),
  ...CONTENT_PAGES.map(entryOfContent),
];

const BY_PATH = new Map(PAGES.map((page) => [page.path, page]));

/** Inventareintrag zu einem Pfad. */
export const pageByPath = (path: string): PageEntry | undefined => BY_PATH.get(path);

/** Alle indexierbaren Seiten. */
export const indexablePages = (): readonly PageEntry[] =>
  PAGES.filter((page) => page.indexability === 'index');

/** Alle Seiten ohne Indexaufnahme. */
export const nonIndexablePages = (): readonly PageEntry[] =>
  PAGES.filter((page) => page.indexability === 'noindex');

/** Kinder eines Themas, die eine Seite haben — Grundlage der Pillar-Raster. */
export const pagesOfTopicChildren = (topicId: string): readonly PageEntry[] =>
  PAGES.filter((page) => {
    const topic = topicOf(page.topicId);
    return topic.parent === topicId;
  });

/** Sitemap-Einträge — abgeleitet, damit Sitemap und Inventar nicht auseinanderlaufen. */
export const SITEMAP_ROUTES = indexablePages()
  .filter(
    (page): page is PageEntry & { sitemap: NonNullable<PageEntry['sitemap']> } => page.sitemap !== undefined
  )
  .map((page) => ({
    path: page.path,
    changeFrequency: page.sitemap.changeFrequency,
    priority: page.sitemap.priority,
    ...(page.lastReviewed ? { lastReviewed: page.lastReviewed } : {}),
  }));
