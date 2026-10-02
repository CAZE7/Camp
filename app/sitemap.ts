import type { MetadataRoute } from 'next';

import { sitemapUrls } from '@/lib/seo/pages';

/** Unter `output: 'export'` muss die Route ausdrücklich als statisch stehen. */
export const dynamic = 'force-static';

/**
 * Sitemap für die Project Page. `lastmod` bleibt bewusst weg: ein hartcodierter
 * Wert wäre eine falsche Aussage über den Änderungszeitpunkt, und Google
 * ignoriert `changefreq` und `priority` ohnehin.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapUrls().map((url) => ({ url }));
}
