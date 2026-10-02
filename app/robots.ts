import type { MetadataRoute } from 'next';

import { BASE_PATH, SITE_ORIGIN } from '@/lib/seo/site';
import { disallowedPaths } from '@/lib/seo/pages';

/** Unter `output: 'export'` muss die Route ausdrücklich als statisch stehen. */
export const dynamic = 'force-static';

/**
 * GitHub Pages ist hier eine Project Page unter `/Camp`, ausgeliefert wird über
 * den Host `caze7.github.io`. Crawler fragen `robots.txt` ausschließlich an der
 * Host-Wurzel ab — und die gehört dem Nutzerseiten-Repo, nicht diesem. Diese
 * Datei ist die beste erreichbare Aussage (als `/Camp/robots.txt` in der Search
 * Console einreichbar), ersetzt aber kein host-weites Steuerungsfeld.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = disallowedPaths().map((path) => `${BASE_PATH}${path}`);

  return {
    rules: [{ userAgent: '*', allow: `${BASE_PATH}/`, disallow }],
    // Die Sitemap ist eine Datei, kein Verzeichnis — ohne Schrägstrich am Ende.
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
