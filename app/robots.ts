import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * Crawler-Anweisung. Als Route statt als Datei in `public/`, damit der
 * Basis-Pfad der Auslieferung aus derselben Quelle kommt wie Canonical-Verweis
 * und Sitemap (`lib/site.ts`) — eine handgepflegte Textdatei würde bei einem
 * anderen Auslieferungspfad auf die falsche Sitemap zeigen.
 *
 * `force-static` erzwingt die Vorabberechnung beim Export; ohne das würde die
 * Route zur Laufzeit erzeugt, die es in einem statischen Export nicht gibt.
 */
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
  };
}
