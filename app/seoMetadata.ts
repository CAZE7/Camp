import type { Metadata } from 'next';

import { pageMetadata } from '@/app/siteMetadata';
import type { SeoPageContent } from '@/lib/seo/types';

/**
 * app/seoMetadata.ts — Brücke zwischen dem SEO-Inhaltsmodell und der
 * bestehenden Kopfdaten-Infrastruktur (`app/siteMetadata.ts`).
 *
 * Es gibt genau EINEN Weg, Kopfdaten zu bauen: `pageMetadata`. Dieses Modul
 * setzt die Felder einer inhaltsgetriebenen Seite darauf — es dupliziert
 * nichts, es übersetzt nur. `absoluteTitle` gilt für Seiten, deren Titel
 * bereits vollständig ist; ansonsten hängt der Wurzel-Layout die Marke an.
 */
export function metadataFor(content: SeoPageContent, path: string = content.path): Metadata {
  return pageMetadata({
    title: content.title,
    description: content.description,
    path,
    absoluteTitle: content.absoluteTitle ?? false,
    ...(content.ogImage ? { image: content.ogImage } : {}),
  });
}
