import type { Metadata } from 'next';

import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_ORIGIN,
  absoluteUrl,
} from './site';

/**
 * Eine Tabelle, alle indexierbaren Routen. Titel, Description, kanonische URL
 * und Structured-Data-Art stehen genau hier — nicht verstreut über die
 * `page.tsx`-Dateien. Route-Dateien rufen nur `pageMetadata(path)` auf.
 */

export type SeoKind = 'home' | 'tool' | 'guide' | 'legal' | 'internal';

export type SeoPath =
  | '/'
  | '/elektrik-planung'
  | '/tools/dach'
  | '/tools/heizung'
  | '/guides/ausbau-fahrplan'
  | '/guides/camper-ausbauguide'
  | '/guides/holzausbau'
  | '/datenschutz'
  | '/impressum'
  | '/ki-assistent'
  | '/design-system';

interface RouteEntry {
  /** Vorderer Titelteil; `layout.tsx` ergänzt per Template ` | Werft`. */
  title: string;
  description: string;
  kind: SeoKind;
  /** Label in der Brotkrumen-Navigation. */
  crumb: string;
  /** `false` ⇒ noindex, follow und nicht in der Sitemap. */
  indexable: boolean;
}

export const ROUTES: Record<SeoPath, RouteEntry> = {
  '/': {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    kind: 'home',
    crumb: 'Start',
    indexable: true,
  },
  '/elektrik-planung': {
    title: 'Camper-Elektrik berechnen: Querschnitt & Batterie',
    description:
      '12-V-Bordnetz für Wohnmobil und Kastenwagen dimensionieren: Kabelquerschnitt und Sicherung je Leitung, Spannungsfall in Prozent, Batteriebank und Stückliste.',
    kind: 'tool',
    crumb: 'Schaltplan',
    indexable: true,
  },
  '/tools/dach': {
    title: 'Dach-Planer: Solarfläche & Dachluken platzieren',
    description:
      'Solarpaneele und Dachfenster auf der nutzbaren Dachfläche des Transporters anordnen, Abstände zur Safe Zone prüfen und die Gesamt-Watt direkt ablesen.',
    kind: 'tool',
    crumb: 'Dach-Planer',
    indexable: true,
  },
  '/tools/heizung': {
    title: 'Heizlast berechnen — Watt für den Camper',
    description:
      'Benötigte Heizleistung aus Fahrzeug, Dämmung, Innenfläche und Wunschtemperatur: in wenigen Schritten zur Wattzahl, die beim Gas- oder Dieselverbrauch trägt.',
    kind: 'tool',
    crumb: 'Heizlast',
    indexable: true,
  },
  '/guides/ausbau-fahrplan': {
    title: 'Camper Ausbau: Reihenfolge in 9 Schritten',
    description:
      'Fahrplan für den Selbstausbau — Entkernung, Rostschutz, Fenster, Dämmung, Elektrik-Vorbereitung, Boden, Wände, Möbelbau, Küche. Mit Werkzeugliste je Schritt.',
    kind: 'guide',
    crumb: 'Ausbau-Fahrplan',
    indexable: true,
  },
  '/guides/camper-ausbauguide': {
    title: 'Camper-Ausbau Guide — Blechbüchse bis Zuhause',
    description:
      'Der große Ratgeber zum Camper-Ausbau: Karosserie, Dämmung, Elektrik, Wasserversorgung und Möbelbau — mit Praxiswerten für Transporter von T5 bis Sprinter.',
    kind: 'guide',
    crumb: 'Ausbauguide',
    indexable: true,
  },
  '/guides/holzausbau': {
    title: 'Holzausbau im Camper nach BEDMAS — 6 Schritte',
    description:
      'Möbelbau im Kastenwagen in der Reihenfolge BEDMAS: Trennwand, Elektrik-Verlegung, Fenster und Lukend, Verkleidung, Einbauten, Innenausbau Schritt für Schritt.',
    kind: 'guide',
    crumb: 'Holzausbau (BEDMAS)',
    indexable: true,
  },
  '/datenschutz': {
    title: 'Datenschutzerklärung',
    description:
      'Wie Werft mit personenbezogenen Daten umgeht: welche Daten beim Planen anfallen, wo sie gespeichert werden und welche Rechte du hast.',
    kind: 'legal',
    crumb: 'Datenschutz',
    indexable: true,
  },
  '/impressum': {
    title: 'Impressum',
    description:
      'Anschrift, Kontakt und inhaltlich verantwortliche Person für Werft — den Online-Planer für Camper-Elektrik, Solarfläche und Heizlast.',
    kind: 'legal',
    crumb: 'Impressum',
    indexable: true,
  },
  '/ki-assistent': {
    title: 'KI-Assistent für Camper-Elektrik',
    description:
      'Der KI-Assistent ist im statischen Export nicht an ein Backend angebunden und beantwortet Anfragen daher nicht.',
    kind: 'internal',
    crumb: 'KI-Assistent',
    // components/Chat.tsx:18-22: /api/chat existiert nur im Dev-Server, im
    // ausgelieferten Artefakt wäre die Eingabe eine Sackgasse.
    indexable: false,
  },
  '/design-system': {
    title: 'Design-System',
    description: 'Interne Übersichtsseite der UI-Bausteine von Werft.',
    kind: 'internal',
    crumb: 'Design-System',
    indexable: false,
  },
};

/** Werkzeuge, die als `WebApplication` ausgeworfen werden. */
const SOFTWARE_APPS: Partial<Record<SeoPath, { name: string; category: string }>> = {
  '/elektrik-planung': { name: 'Werft Schaltplan-Editor', category: 'UtilityApplication' },
  '/tools/dach': { name: 'Werft Dach-Planer', category: 'UtilityApplication' },
  '/tools/heizung': { name: 'Werft Heizlast-Rechner', category: 'UtilityApplication' },
};

export function pageMetadata(path: SeoPath): Metadata {
  const route = ROUTES[path];
  const url = absoluteUrl(path);
  // Das Layout-Template hängt den Markennamen ans `<title>` an — für OG und
  // Twitter passiert das nicht automatisch, also hier explizit gleichziehen.
  const brandedTitle = `${route.title} | ${SITE_NAME}`;

  return {
    title: route.title,
    description: route.description,
    alternates: { canonical: url },
    robots: route.indexable
      ? {
          index: true,
          follow: true,
          'max-snippet': -1,
          'max-image-preview': 'large',
          'max-video-preview': -1,
        }
      : { index: false, follow: true },
    openGraph: {
      type: route.kind === 'guide' ? 'article' : 'website',
      url,
      title: brandedTitle,
      description: route.description,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      images: [{ ...OG_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: brandedTitle,
      description: route.description,
      images: [OG_IMAGE.url],
    },
  };
}

/**
 * Brotkrumen-Kette: immer Start → aktuelle Route. Es gibt keine Zwischen-
 * Index-Seite (`/guides` existiert nicht), also erfindet die Kette auch keine.
 */
export function breadcrumbTrail(path: SeoPath): { name: string; url: string }[] {
  if (path === '/') return [{ name: ROUTES['/'].crumb, url: absoluteUrl('/') }];
  return [
    { name: ROUTES['/'].crumb, url: absoluteUrl('/') },
    { name: ROUTES[path].crumb, url: absoluteUrl(path) },
  ];
}

/**
 * FAQ-Inhalt aus einer Hand: dieselben Einträge, die `jsonLdGraph` als
 * `FAQPage` auswirft, rendert die Route auch sichtbar. FAQ-Schema ohne den
 * zugehörigen Text auf der Seite wäre eine Behauptung ins Dokument — und die
 * Antworten hier sind dem Code entnommen, nicht erfunden:
 *
 * - `lib/units.ts:465` → A = I · 2L / (κ · ΔU)
 * - `lib/materials.ts:39` → ρ(Kupfer) = 0,0175 Ω·mm²/m, woraus κ ≈ 57 folgt
 * - `lib/electrical.ts:404-408` → ΔU-Einstufung 1 % / 3 % / 4 %, ausdrücklich
 *   als Planungsannahme dokumentiert, ohne Normzitat (`AUDIT ELE-010`)
 * - `AGENTS.md` §4.3 → Sicherungsgrenze durch Konstruktion: I_B ≤ I_n ≤ I_z
 */
export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQS: Partial<Record<SeoPath, FaqEntry[]>> = {
  '/elektrik-planung': [
    {
      question: 'Wie berechnet der Planer den Kabelquerschnitt?',
      answer:
        'Aus dem Leitungsstrom I, der einfachen Länge L und dem zulässigen Spannungsfall ΔU nach A = I · 2L / (κ · ΔU). Der Faktor 2 steht für Hin- und Rückleitung; mit dem spezifischen Widerstand von Kupfer (ρ = 0,0175 Ω·mm²/m) ergibt sich ein Leitwert κ von rund 57.',
    },
    {
      question: 'Ab wann ist der Spannungsfall zu hoch?',
      answer:
        'Der Planer stuft in drei Schwellen ein: bis 1 % Zielband, bis 3 % Planungsgrenze, darüber Verstoß, über 4 % kritisch. Das sind dokumentierte Planungsannahmen von Werft und keine Normwerte — die Stromtragwert-Tabelle steht in DIN VDE 0298-4, Spannungsfallgrenzen kennt sie nicht.',
    },
    {
      question: 'Wie passt die Sicherung zum Kabel?',
      answer:
        'Sicherungsgröße und Stromtragwert rechnen mit demselben Derating-Faktor, damit die Kette I_B ≤ I_n ≤ I_z durch Konstruktion hält: Der Kabelstrom bleibt unter dem Sicherungsnennwert, und die Sicherung löst innerhalb dessen aus, was die Leitung dauerhaft trägt.',
    },
    {
      question: 'Ersetzt der Planer eine Elektrofachkraft?',
      answer:
        'Nein. Die Werte sind Näherungen für die Planung. Anlagen mit Wechselrichter, Landstrom oder mehr als einer Batteriebank gehören vor der Inbetriebnahme durch qualifiziertes Personal geprüft.',
    },
  ],
};

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

/**
 * Structured Data als ein einziges `@graph`-Skript pro Seite: Organization,
 * WebSite, WebPage und die seitentypischen Knoten verweisen per `@id`
 * aufeinander, statt vier lose Blöcke zu hinterlassen. Jede Seite wirft den
 * ganzen Graph — Entitätsextraktion braucht den Kontext, nicht nur den lokalen
 * Knoten.
 *
 * Absichtlich nicht enthalten: `aggregateRating`, `review`, `dateModified` und
 * `logo` — für nichts davon gibt es auf den Seiten eine belastbare Grundlage.
 * `offers` mit Preis 0 ist enthalten, weil die Werkzeuge frei und ohne Zugang
 * nutzbar sind.
 */
export function jsonLdGraph(path: SeoPath): Record<string, unknown> {
  const route = ROUTES[path];
  const url = absoluteUrl(path);
  const pageId = `${url}#webpage`;
  const faq = FAQS[path];

  const nodes: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_NAME,
      url: SITE_ORIGIN,
      description: HOME_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
      inLanguage: SITE_LOCALE.replace('_', '-'),
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'WebPage',
      '@id': pageId,
      url,
      name: `${route.title} | ${SITE_NAME}`,
      description: route.description,
      inLanguage: 'de',
      isAccessibleForFree: true,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORGANIZATION_ID },
      ...(faq ? { mainEntity: { '@id': `${url}#faq` } } : {}),
    },
  ];

  const app = SOFTWARE_APPS[path];
  if (app) {
    nodes.push({
      '@type': 'WebApplication',
      '@id': `${url}#app`,
      name: app.name,
      url,
      applicationCategory: app.category,
      operatingSystem: 'All',
      browserRequirements: 'HTML5, JavaScript',
      inLanguage: 'de',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' },
      isPartOf: { '@id': pageId },
    });
  }

  if (route.kind === 'guide') {
    nodes.push({
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: route.title,
      description: route.description,
      inLanguage: 'de',
      isAccessibleForFree: true,
      mainEntityOfPage: { '@id': pageId },
      publisher: { '@id': ORGANIZATION_ID },
    });
  }

  if (faq) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faq.map((entry, index) => ({
        '@type': 'Question',
        '@id': `${url}#faq-${index + 1}`,
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    });
  }

  if (path !== '/') {
    nodes.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumbs`,
      itemListElement: breadcrumbTrail(path).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** Für die Sitemap: nur Routen, die indexierbar sein sollen. */
export function sitemapUrls(): string[] {
  return (Object.keys(ROUTES) as SeoPath[]).filter((path) => ROUTES[path].indexable).map(absoluteUrl);
}

/**
 * Für die Robots-Aussage. robots.txt Präfix-Matching macht aus
 * `/Camp/ki-assistent` auch ohne Schrägstrich einen Block der Unterpfade —
 * ein angehängter Schrägstrich würde die ausgelieferte URL-Form verfehlen.
 */
export function disallowedPaths(): string[] {
  return (Object.keys(ROUTES) as SeoPath[]).filter((path) => !ROUTES[path].indexable);
}
