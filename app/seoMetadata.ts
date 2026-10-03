import type { Metadata } from 'next';

import { pageMetadata } from '@/app/siteMetadata';
import { pageByPath } from '@/lib/seo/inventory';
import type { SeoPageContent } from '@/lib/seo/types';

/**
 * Brücke zwischen Seiteninventar und Next-Metadaten.
 *
 * `lib/seo/inventory.ts` ist die Quelle der statischen Routenkopfdaten; Inhalte
 * aus `lib/seo/content/` liefern ihre Werte an dasselbe Inventar. Canonical,
 * robots, Open Graph und Twitter werden anschließend ausschließlich vom
 * zentralen Builder in `app/siteMetadata.ts` erzeugt.
 */
export function metadataForPage(path: string): Metadata {
  const page = pageByPath(path);
  if (!page) throw new Error(`Route "${path}" fehlt im SEO-Inventar.`);

  return pageMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    absoluteTitle: page.absoluteTitle ?? false,
    index: page.indexability === 'index',
    ...(page.ogImage ? { image: page.ogImage } : {}),
  });
}

/** Übergang für datengetriebene Routen; Inhalt und Inventar müssen übereinstimmen. */
export function metadataFor(content: SeoPageContent, path: string = content.path): Metadata {
  const page = pageByPath(path);
  if (!page) throw new Error(`Inhaltsroute "${path}" fehlt im SEO-Inventar.`);
  if (page.title !== content.title || page.description !== content.description) {
    throw new Error(`Metadaten und Inhalt für "${path}" weichen voneinander ab.`);
  }
  return metadataForPage(path);
}
