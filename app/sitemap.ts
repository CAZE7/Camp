import type { MetadataRoute } from 'next';

import { SITEMAP_ROUTES } from '@/lib/seo/inventory';
import { siteUrl } from '@/lib/site';

/**
 * Sitemap der ausgelieferten Seiten.
 *
 * Die Liste steht NICHT mehr hier, sondern in `lib/seo/inventory.ts` — dort
 * mit Suchintention, Prioritätsstufe und Inhaltsart. Zwei Listen (eine für die
 * Sitemap, eine für die Prüfung) sind zwei Gelegenheiten, eine Seite zu
 * vergessen; eine Liste mit zwei Lesern kann das nicht.
 *
 * `lastModified` steht nur dort, wo das Inventar ein belegtes Datum trägt
 * (`lastReviewed`): ein Tag, an dem ein Commit den sichtbaren Text der Seite
 * geändert hat. Kein aus der Build-Zeit abgeleiteter Zeitstempel — der würde
 * bei jedem Bau behaupten, die Seite habe sich geändert. Wo kein Datum belegt
 * ist, bleibt das Feld weg; das ist ehrlicher als ein geratener Wert und für
 * Suchmaschinen unschädlich (der Eintrag bleibt gültig).
 *
 * `priority` ist eine relative Angabe innerhalb dieser Auslieferung, kein
 * Versprechen an Suchmaschinen.
 */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_ROUTES.map((route) => ({
    url: siteUrl(route.path),
    ...('lastReviewed' in route && route.lastReviewed
      ? { lastModified: new Date(`${route.lastReviewed}T00:00:00Z`) }
      : {}),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
