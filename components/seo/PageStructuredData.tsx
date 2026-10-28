import {
  breadcrumbNode,
  faqNode,
  jsonLdGraph,
  pageNodeId,
  serializeJsonLd,
  webApplicationNode,
  webPageNode,
  type BreadcrumbItem,
} from '@/lib/seo/jsonLd';
import { pageByPath } from '@/lib/seo/inventory';
import { topicOf } from '@/lib/seo/topics';
import type { FaqEntry } from '@/lib/seo/types';

/**
 * Strukturierte WebPage-/WebApplication-Knoten für bestehende statische Seiten.
 *
 * Die sichtbare H1, die Beschreibung, der Pfad und die erwarteten Schema-Typen
 * kommen aus dem SEO-Inventar. Kein `WebApplication` wird auf Seiten ergänzt,
 * die nicht als Anwendung inventarisiert sind.
 *
 * FAQ und Brotkrumen sind opt-in pro Aufruf und nur dann ehrlich, wenn das
 * Inventar sie ankündigt UND die Seite sie sichtbar zeigt: Die FAQ-Texte
 * übergibt der Aufrufer aus derselben Quelle wie seine sichtbare
 * Aufklappliste (eine Zeichenkette für Anzeige und Schema).
 */
export function PageStructuredData({
  path,
  faqEntries,
  breadcrumbItems,
}: {
  path: string;
  faqEntries?: readonly FaqEntry[];
  breadcrumbItems?: readonly BreadcrumbItem[];
}) {
  const page = pageByPath(path);
  if (!page) throw new Error(`Strukturierte Daten: Route "${path}" fehlt im SEO-Inventar.`);
  if (page.indexability !== 'index' || !page.structuredData.includes('WebPage')) return null;

  const hasApplication = page.structuredData.includes('WebApplication');
  const applicationId = hasApplication ? pageNodeId(page.path, 'webapplication') : undefined;
  const hasFaq = page.structuredData.includes('FAQPage') && faqEntries !== undefined && faqEntries.length > 0;
  const faqId = hasFaq ? pageNodeId(page.path, 'faq') : undefined;
  const hasBreadcrumb =
    page.structuredData.includes('BreadcrumbList') &&
    breadcrumbItems !== undefined &&
    breadcrumbItems.length > 0;
  const breadcrumbId = hasBreadcrumb ? pageNodeId(page.path, 'breadcrumb') : undefined;

  const hasPartIds = [
    ...(applicationId ? [applicationId] : []),
    ...(faqId ? [faqId] : []),
    ...(breadcrumbId ? [breadcrumbId] : []),
  ];

  const nodes = [
    webPageNode({
      path: page.path,
      name: page.h1,
      description: page.description,
      ...(page.lastReviewed ? { lastReviewed: page.lastReviewed } : {}),
      ...(applicationId ? { mainEntityId: applicationId } : {}),
      ...(hasPartIds.length > 0 ? { hasPartIds } : {}),
      ...(breadcrumbId ? { breadcrumbId } : {}),
    }),
    ...(hasApplication
      ? [
          webApplicationNode({
            path: page.path,
            name: page.h1,
            description: page.description,
            subCategory: topicOf(page.topicId).label,
          }),
        ]
      : []),
    ...(hasFaq
      ? [faqNode({ path: page.path, entries: faqEntries, pageId: pageNodeId(page.path, 'webpage') })]
      : []),
    ...(hasBreadcrumb ? [breadcrumbNode({ path: page.path, items: breadcrumbItems })] : []),
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdGraph(nodes)) }}
    />
  );
}
