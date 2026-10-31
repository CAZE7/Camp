/**
 * lib/seo/jsonLd.ts — EINE Stelle für die strukturierte Beschreibung.
 *
 * Vorher baute `components/elektrik/structuredData.ts` den Graphen der Seite
 * „Elektrik-Planung" von Hand; jede weitere Seite hätte dieselben Muster
 * (WebPage + Brotkrumen + Fragen) ein zweites Mal geschrieben. Hier stehen die
 * Bausteine, aus denen Seiten ihren Graphen zusammensetzen — die Regeln, die
 * der Prüfer kennt (`checkStructuredData`), gelten damit für alle Seiten
 * gleich.
 *
 * Grundsätze:
 *   - Verweise über `@id`, nicht über wiederholte Adressen.
 *   - Nur Typen, die der sichtbare Inhalt belegt: keine Bewertungen, keine
 *     Autoren, keine Angebote.
 *   - Texte kommen aus derselben Quelle wie die Anzeige; sonst beschreibt die
 *     Maschinenfassung etwas anderes als die Seite.
 *
 * Zu Preisen — hier stand früher „keine Preise, es gibt sie in Camp nicht".
 * Das stimmt seit dem Ladebooster-Vergleich nicht mehr: Neun Geräte stehen mit
 * beobachteten Straßenpreisen und Stichtag sichtbar auf der Seite. Ins Schema
 * kommen sie trotzdem nicht, und das ist eine Entscheidung, keine Lücke: Ein
 * `Offer` ist eine maschinelle Zusage, die niemand nachzieht, wenn der Preis
 * fällt — und `checkStructuredData` verbietet zusätzlich jede fremde Adresse
 * (`json-ld-adresse`), also auch `sameAs` auf Händler- oder Herstellerseiten.
 * Sichtbar mit Stand-Datum, maschinell gar nicht, ist die ehrlichere Hälfte.
 */

import { siteNodeId, siteUrl } from '@/lib/site';

import type { FaqEntry, StructuredDataType } from './types';

export type JsonLdNode = Record<string, unknown>;

export type JsonLdGraph = {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
};

/** Kennung eines Seitenknotens (`…/pfad/#webpage`). */
export const pageNodeId = (path: string, fragment: string): string => `${siteUrl(path)}#${fragment}`;

/** Setzt einen Graphen aus Knoten zusammen. */
export function jsonLdGraph(nodes: readonly JsonLdNode[]): JsonLdGraph {
  return { '@context': 'https://schema.org', '@graph': [...nodes] };
}

/** Verweis auf die Website, die der Wurzel-Layout beschreibt. */
export const websiteRef = (): { '@id': string } => ({ '@id': siteNodeId('website') });

/** Verweis auf die Organisation, die der Wurzel-Layout beschreibt. */
export const publisherRef = (): { '@id': string } => ({ '@id': siteNodeId('organization') });

/**
 * Beschreibung einer Seite. `mainEntity` ist das, was der Nutzer auf dieser
 * Seite eigentlich vorhat (Rechner, Anwendung), `hasPart` sind Teile des
 * Inhalts (Fragenblock, Brotkrumen).
 */
export function webPageNode(input: {
  path: string;
  name: string;
  description: string;
  mainEntityId?: string;
  hasPartIds?: readonly string[];
  breadcrumbId?: string;
  /** `CollectionPage` für Übersichten, sonst `WebPage`. */
  type?: Extract<StructuredDataType, 'WebPage' | 'CollectionPage'>;
}): JsonLdNode {
  const url = siteUrl(input.path);
  const node: JsonLdNode = {
    '@type': input.type ?? 'WebPage',
    '@id': pageNodeId(input.path, 'webpage'),
    url,
    name: input.name,
    description: input.description,
    inLanguage: 'de-DE',
    isPartOf: websiteRef(),
    publisher: publisherRef(),
  };
  if (input.mainEntityId) node['mainEntity'] = { '@id': input.mainEntityId };
  if (input.hasPartIds && input.hasPartIds.length > 0) {
    node['hasPart'] = input.hasPartIds.map((id) => ({ '@id': id }));
  }
  if (input.breadcrumbId) node['breadcrumb'] = { '@id': input.breadcrumbId };
  return node;
}

/** Ein Eintrag der Brotkrumenspur: Anzeigename und Ziel. */
export type BreadcrumbItem = { name: string; path: string };

/**
 * Brotkrumenspur als `BreadcrumbList`. Der letzte Eintrag IST die Seite —
 * er trägt dieselbe Adresse wie der Canonical-Verweis, damit Struktur und
 * sichtbare Navigation nicht auseinanderlaufen können.
 */
export function breadcrumbNode(input: { path: string; items: readonly BreadcrumbItem[] }): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': pageNodeId(input.path, 'breadcrumb'),
    inLanguage: 'de-DE',
    itemListElement: input.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}

/**
 * Fragenblock als `FAQPage`. Es werden ausschließlich Fragen aufgenommen, die
 * auf der Seite sichtbar beantwortet sind — die Texte sind dieselben
 * Zeichenketten wie im Akkordeon.
 */
export function faqNode(input: { path: string; entries: readonly FaqEntry[]; pageId?: string }): JsonLdNode {
  const id = pageNodeId(input.path, 'faq');
  const node: JsonLdNode = {
    '@type': 'FAQPage',
    '@id': id,
    inLanguage: 'de-DE',
    isPartOf: { '@id': input.pageId ?? pageNodeId(input.path, 'webpage') },
    mainEntity: input.entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
  return node;
}

/**
 * Beschreibung eines Rechenwerkzeugs. `offers` mit Preis 0 ist belegt: Die
 * Rechner sind ohne Anmeldung und ohne Bezahlung nutzbar (kein
 * Fantasie-Preis, sondern der tatsächliche Zugang).
 */
export function webApplicationNode(input: {
  path: string;
  name: string;
  description: string;
  subCategory?: string;
  features?: readonly string[];
  browserRequirements?: string;
}): JsonLdNode {
  const url = siteUrl(input.path);
  return {
    '@type': 'WebApplication',
    '@id': pageNodeId(input.path, 'webapplication'),
    url,
    name: input.name,
    description: input.description,
    applicationCategory: 'UtilityApplication',
    ...(input.subCategory ? { applicationSubCategory: input.subCategory } : {}),
    operatingSystem: 'All',
    ...(input.browserRequirements ? { browserRequirements: input.browserRequirements } : {}),
    inLanguage: 'de-DE',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    ...(input.features && input.features.length > 0 ? { featureList: [...input.features] } : {}),
  };
}

/**
 * Ein Produkt der Vergleichsliste. Bewusst ohne `offers`, `review` und
 * `aggregateRating` — die Begründung steht im Dateikopf.
 */
export type JsonLdProduct = {
  /** Anker des Produkts im Dokument (`p-<kennung>`) — wird zur `@id`. */
  anchor: string;
  name: string;
  brand: string;
  /** Merkmale, die sichtbar in der Tabelle oder der Produktkarte stehen. */
  properties: readonly { name: string; value: string | number; unitText?: string }[];
};

/**
 * Produktliste als `ItemList`.
 *
 * Die Produkte stehen INLINE in den Listeneinträgen, nicht als eigene Knoten im
 * `@graph`. Das ist keine Geschmacksfrage: `checkStructuredData` verlangt je
 * angekündigtem Typ genau einen Knoten (`json-ld-inventar`), neun
 * `Product`-Knoten auf oberster Ebene wären also neun. Inline ist
 * schema.org-konform und lässt die Zusage des Prüfers unverändert.
 *
 * Die Reihenfolge kommt sortiert vom Aufrufer (`lib/seo/comparisons/schema.ts`)
 * und ist dieselbe wie in der Rangliste der Seite.
 */
export function itemListNode(input: {
  path: string;
  name: string;
  description: string;
  products: readonly JsonLdProduct[];
}): JsonLdNode {
  return {
    '@type': 'ItemList',
    '@id': pageNodeId(input.path, 'geraeteliste'),
    url: siteUrl(input.path),
    name: input.name,
    description: input.description,
    inLanguage: 'de-DE',
    numberOfItems: input.products.length,
    itemListElement: input.products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        '@id': pageNodeId(input.path, product.anchor),
        name: product.name,
        brand: { '@type': 'Brand', name: product.brand },
        additionalProperty: product.properties.map((property) => ({
          '@type': 'PropertyValue',
          name: property.name,
          value: property.value,
          ...(property.unitText ? { unitText: property.unitText } : {}),
        })),
      },
    })),
  };
}

/**
 * Serialisiert den Graphen für die Einbettung in ein `<script>`-Element.
 *
 * `<` wird als `\u003c` ausgegeben: Eine Zeichenfolge wie `</script>` in einem
 * Textfeld würde das Skriptelement sonst vorzeitig beenden. Die Ersetzung ist
 * für JSON-Werkzeuge bedeutungsgleich.
 */
export function serializeJsonLd(graph: JsonLdGraph): string {
  return JSON.stringify(graph).replaceAll('<', '\\u003c');
}
