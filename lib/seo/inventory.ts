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
 * Warum die bestehenden Seiten hier ausdrücklich stehen und nicht abgeleitet
 * werden: Eine Prüfung, die ihre Erwartung aus dem Prüfling zieht, prüft
 * nichts. Die Einträge nennen Hauptüberschrift und Suchintention; der Prüflauf
 * hält sie gegen den Export und macht Abweichungen sichtbar. Die neue
 * Inhaltsseiten dagegen entstehen aus `content/` — dort stehen Titel,
 * Beschreibung und Abschnitte an einer Stelle, das Inventar liest sie.
 */

import { CONTENT_PAGES } from './content';
import { queriesForPage } from './opportunities';
import { topicOf } from './topics';
import type { PageEntry, PageKind, StructuredDataType } from './types';

/** Seite ohne eigenen Inhalt für Ergebnislisten (Ansicht, internes Werkzeug). */
type LegacyPage = Omit<PageEntry, 'targetQueries' | 'title' | 'description'>;

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
    h1: 'Camper planen — erst der Plan, dann das Blech.',
    searchIntent: 'Überblick: welche Werkzeuge und Wissensseiten es für den Camper-Ausbau gibt.',
    topicId: 'start',
    priority: 'P0',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'monthly', priority: 1 },
    source: 'app/page.tsx',
  },
  {
    path: '/elektrik-planung/',
    label: 'Camper-Elektroplaner',
    kind: 'werkzeug',
    indexability: 'index',
    h1: 'Camper-Elektrik berechnen',
    searchIntent: 'eine 12-V-Leitung berechnen und die gesamte Anlage als Schaltplan zeichnen.',
    topicId: 'camper-elektrik',
    priority: 'P0',
    structuredData: ['WebPage', 'BreadcrumbList', 'WebApplication', 'FAQPage'],
    sitemap: { changeFrequency: 'monthly', priority: 0.9 },
    source: 'app/elektrik-planung/page.tsx',
  },
  {
    path: '/tools/dach/',
    label: 'Dach-Planer',
    kind: 'werkzeug',
    indexability: 'index',
    h1: 'Dach-Planer',
    searchIntent: 'Solarpanels und Dachluken auf der Dachfläche platzieren und die Gesamtleistung ablesen.',
    topicId: 'dachplanung',
    priority: 'P1',
    structuredData: ['WebPage', 'WebApplication'],
    sitemap: { changeFrequency: 'monthly', priority: 0.8 },
    source: 'app/tools/dach/layout.tsx',
  },
  {
    path: '/tools/heizung/',
    label: 'Heizlast-Rechner',
    kind: 'werkzeug',
    indexability: 'index',
    h1: 'Heizlast-Rechner',
    searchIntent: 'die nötige Heizleistung aus Fahrzeug, Dämmung und Wunschtemperatur bestimmen.',
    topicId: 'heizlast',
    priority: 'P1',
    structuredData: ['WebPage', 'WebApplication'],
    sitemap: { changeFrequency: 'monthly', priority: 0.8 },
    source: 'app/tools/heizung/layout.tsx',
  },
  {
    path: '/guides/ausbau-fahrplan/',
    label: 'Ausbau-Fahrplan',
    kind: 'ratgeber',
    indexability: 'index',
    h1: 'Ausbau-Fahrplan',
    searchIntent: 'die Reihenfolge der Gewerke beim Camper-Ausbau kennen.',
    topicId: 'ausbau',
    priority: 'P2',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'monthly', priority: 0.6 },
    source: 'app/guides/ausbau-fahrplan/page.tsx',
  },
  {
    path: '/guides/camper-ausbauguide/',
    label: 'Camper-Ausbauguide',
    kind: 'ratgeber',
    indexability: 'index',
    h1: 'Der ultimative Camper-Ausbau-Guide:Von der leeren Blechbüchse zum rollenden Zuhause',
    searchIntent: 'Wissen zu Karosserie, Dämmung, Elektrik, Gas und TÜV nachlesen.',
    topicId: 'ausbau',
    priority: 'P1',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'monthly', priority: 0.6 },
    source: 'app/guides/camper-ausbauguide/page.tsx',
  },
  {
    path: '/guides/holzausbau/',
    label: 'Holzausbau',
    kind: 'ratgeber',
    indexability: 'index',
    h1: 'Holzausbau nach BEDMAS',
    searchIntent: 'Möbelbau im Camper in sechs Schritten umsetzen.',
    topicId: 'ausbau',
    priority: 'P3',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'monthly', priority: 0.5 },
    source: 'app/guides/holzausbau/page.tsx',
  },
  {
    path: '/impressum/',
    label: 'Impressum',
    kind: 'rechtliches',
    indexability: 'index',
    h1: 'Impressum',
    searchIntent: 'Anbieterkennzeichnung und Kontaktweg finden.',
    topicId: 'rechtliches',
    priority: 'P3',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'yearly', priority: 0.3 },
    source: 'app/impressum/page.tsx',
  },
  {
    path: '/datenschutz/',
    label: 'Datenschutz',
    kind: 'rechtliches',
    indexability: 'index',
    h1: 'Datenschutz',
    searchIntent: 'nachlesen, welche Daten die Seite verarbeitet.',
    topicId: 'rechtliches',
    priority: 'P3',
    structuredData: ['WebPage'],
    sitemap: { changeFrequency: 'yearly', priority: 0.3 },
    source: 'app/datenschutz/page.tsx',
  },
  {
    path: '/design-system/',
    label: 'Design-System',
    kind: 'ansicht',
    indexability: 'noindex',
    h1: 'DARK ENGINEERING DESIGN SYSTEM',
    searchIntent: 'interne Übersicht der Bausteine — kein Inhalt für Ergebnislisten.',
    topicId: 'vertrauen',
    priority: 'P3',
    structuredData: ['WebPage'],
    source: 'app/design-system/page.tsx',
  },
  {
    path: '/ki-assistent/',
    label: 'Camper-Assistent',
    kind: 'ansicht',
    indexability: 'noindex',
    h1: 'Camper-Assistent',
    searchIntent: 'Fragen im Dialog stellen — ergänzende Ansicht ohne eigenen Inhalt für Ergebnislisten.',
    topicId: 'start',
    priority: 'P3',
    structuredData: ['WebPage'],
    source: 'app/ki-assistent/page.tsx',
  },
];

/** Technische Seiten: dreimal dieselbe Fehlerseite, nicht beworben, noindex. */
export const TECHNICAL_PAGES: readonly string[] = ['/404/', '/_not-found/'];

/** Strukturierte Daten, die jede inhaltsgetriebene Seite trägt. */
function structuredDataOf(kind: PageKind, hasFaq: boolean, hasCalculator: boolean): StructuredDataType[] {
  const types: StructuredDataType[] = [kind === 'rechner' ? 'WebPage' : 'WebPage', 'BreadcrumbList'];
  if (hasFaq) types.push('FAQPage');
  if (hasCalculator) types.push('WebApplication');
  return types;
}

/** Aus dem Inhalt abgeleiteter Inventareintrag. */
function entryOfContent(page: (typeof CONTENT_PAGES)[number]): PageEntry {
  const hasCalculator = page.sections.some((section) => section.calculator !== undefined);
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
    structuredData: structuredDataOf(page.kind, (page.faq?.length ?? 0) > 0, hasCalculator),
    sitemap: { changeFrequency: page.changeFrequency, priority: page.sitemapPriority },
    source: `lib/seo/content/${page.slug}.ts`,
    title: page.title,
    description: page.description,
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
  }));
