/**
 * components/elektrik/structuredData.ts — maschinenlesbare Beschreibung der
 * Seite „Elektrik-Planung" als zusammenhängender `@graph`.
 *
 * Die Knoten verweisen über `@id` aufeinander, statt dieselbe Adresse
 * dreimal zu wiederholen: Die Seite (`WebPage`) ist Teil der Website
 * (`WebSite`), ihr zentraler Inhalt ist die Anwendung (`WebApplication`) und
 * der Fragenblock (`FAQPage`) ist ein Teil der Seite. Ausgabe und Anzeige
 * speisen sich aus denselben Textkonstanten (`electricContent.ts`).
 */

import { SITE_NAME, siteUrl } from '@/lib/site';

import { APPLICATION_FEATURES, ELEKTRIK_FAQ, PAGE_DESCRIPTION, PAGE_TITLE } from './electricContent';

/** Pfad der Seite innerhalb der Auslieferung. */
export const ELEKTRIK_PLANUNG_PATH = '/elektrik-planung/';

export type JsonLdNode = Record<string, unknown>;

export type JsonLdGraph = {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
};

/** Baut den Beschreibungsgraphen der Seite aus den Anzeigetexten. */
export function buildElektrikPlanungJsonLd(): JsonLdGraph {
  const pageUrl = siteUrl(ELEKTRIK_PLANUNG_PATH);
  const siteUrl_ = siteUrl('/');

  const pageId = `${pageUrl}#webpage`;
  const applicationId = `${pageUrl}#webapplication`;
  const faqId = `${pageUrl}#faq`;
  const siteId = `${siteUrl_}#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': pageId,
        url: pageUrl,
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        inLanguage: 'de-DE',
        isPartOf: { '@id': siteId },
        mainEntity: { '@id': applicationId },
        hasPart: { '@id': faqId },
      },
      {
        '@type': 'WebSite',
        '@id': siteId,
        url: siteUrl_,
        name: SITE_NAME,
        inLanguage: 'de-DE',
      },
      {
        '@type': 'WebApplication',
        '@id': applicationId,
        url: pageUrl,
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        applicationCategory: 'UtilityApplication',
        applicationSubCategory: 'Elektroplanung',
        operatingSystem: 'All',
        browserRequirements: 'HTML5, JavaScript',
        inLanguage: 'de-DE',
        isAccessibleForFree: true,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
        },
        featureList: [...APPLICATION_FEATURES],
      },
      {
        '@type': 'FAQPage',
        '@id': faqId,
        inLanguage: 'de-DE',
        isPartOf: { '@id': pageId },
        mainEntity: ELEKTRIK_FAQ.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: entry.answer,
          },
        })),
      },
    ],
  };
}

/**
 * Serialisiert den Graphen für die Einbettung in ein `<script>`-Element.
 *
 * `<` wird als `\u003c` ausgegeben: Eine Zeichenfolge wie `</script>` in
 * einem Textfeld würde das Skriptelement sonst vorzeitig beenden. Die
 * Ersetzung ist für JSON-Werkzeuge bedeutungsgleich.
 */
export function serializeJsonLd(graph: JsonLdGraph): string {
  return JSON.stringify(graph).replaceAll('<', '\\u003c');
}
