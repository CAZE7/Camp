import { jsonLdGraph, pageNodeId, serializeJsonLd, webApplicationNode, webPageNode } from '@/lib/seo/jsonLd';
import { pageByPath } from '@/lib/seo/inventory';
import { topicOf } from '@/lib/seo/topics';

/**
 * Strukturierte WebPage-/WebApplication-Knoten für bestehende statische Seiten.
 *
 * Die sichtbare H1, die Beschreibung, der Pfad und die erwarteten Schema-Typen
 * kommen aus dem SEO-Inventar. Kein `WebApplication` wird auf Seiten ergänzt,
 * die nicht als Anwendung inventarisiert sind.
 */
export function PageStructuredData({ path }: { path: string }) {
  const page = pageByPath(path);
  if (!page) throw new Error(`Strukturierte Daten: Route "${path}" fehlt im SEO-Inventar.`);
  if (page.indexability !== 'index' || !page.structuredData.includes('WebPage')) return null;

  const hasApplication = page.structuredData.includes('WebApplication');
  const applicationId = hasApplication ? pageNodeId(page.path, 'webapplication') : undefined;
  const nodes = [
    webPageNode({
      path: page.path,
      name: page.h1,
      description: page.description,
      ...(applicationId ? { mainEntityId: applicationId, hasPartIds: [applicationId] } : {}),
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
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdGraph(nodes)) }}
    />
  );
}
