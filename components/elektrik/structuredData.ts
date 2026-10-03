/**
 * components/elektrik/structuredData.ts — maschinenlesbare Beschreibung der
 * Seite „Elektrik-Planung".
 *
 * Die Bausteine (WebPage, Brotkrumen, Fragenblock, Anwendung) stehen seit der
 * SEO-Erweiterung in `lib/seo/jsonLd.ts` — EINE Stelle für alle Seiten. Dieses
 * Modul setzt daraus nur noch den Graphen DIESER Seite zusammen; die
 * öffentliche Schnittstelle (`buildElektrikPlanungJsonLd`, `serializeJsonLd`)
 * bleibt unverändert, damit die bestehende Prüfung weiter greift.
 *
 * Die Texte kommen aus `electricContent.ts`: Was im Akkordeon sichtbar steht,
 * steht auch in der strukturierten Beschreibung.
 */

import {
  breadcrumbNode,
  faqNode,
  jsonLdGraph,
  pageNodeId,
  serializeJsonLd,
  webApplicationNode,
  webPageNode,
} from '@/lib/seo/jsonLd';
import type { JsonLdGraph, JsonLdNode } from '@/lib/seo/jsonLd';
import { siteUrl } from '@/lib/site';

import { APPLICATION_FEATURES, ELEKTRIK_FAQ, PAGE_DESCRIPTION, PAGE_TITLE } from './electricContent';

export type { JsonLdGraph, JsonLdNode };
export { serializeJsonLd };

/** Pfad der Seite innerhalb der Auslieferung. */
export const ELEKTRIK_PLANUNG_PATH = '/elektrik-planung/';

/** Baut den Beschreibungsgraphen der Seite aus den Anzeigetexten. */
export function buildElektrikPlanungJsonLd(): JsonLdGraph {
  const pageId = pageNodeId(ELEKTRIK_PLANUNG_PATH, 'webpage');
  const applicationId = pageNodeId(ELEKTRIK_PLANUNG_PATH, 'webapplication');
  const faqId = pageNodeId(ELEKTRIK_PLANUNG_PATH, 'faq');
  const breadcrumbId = pageNodeId(ELEKTRIK_PLANUNG_PATH, 'breadcrumb');

  return jsonLdGraph([
    webPageNode({
      path: ELEKTRIK_PLANUNG_PATH,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      mainEntityId: applicationId,
      hasPartIds: [faqId, breadcrumbId],
      breadcrumbId,
    }),
    breadcrumbNode({
      path: ELEKTRIK_PLANUNG_PATH,
      items: [
        { name: 'Startseite', path: '/' },
        { name: 'Elektrik-Planung', path: ELEKTRIK_PLANUNG_PATH },
      ],
    }),
    webApplicationNode({
      path: ELEKTRIK_PLANUNG_PATH,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      subCategory: 'Elektroplanung',
      browserRequirements: 'HTML5, JavaScript',
      features: APPLICATION_FEATURES,
    }),
    faqNode({ path: ELEKTRIK_PLANUNG_PATH, entries: ELEKTRIK_FAQ, pageId }),
  ]);
}

/** Adresse der Seite — bleibt als Re-Export erhalten (Aufrufer von außen). */
export const ELEKTRIK_PLANUNG_URL = siteUrl(ELEKTRIK_PLANUNG_PATH);
