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
 * Bewusst ohne `lastModified`: Ein Zeitstempel müsste aus der Build-Zeit
 * stammen und würde damit bei jedem Bau behaupten, die Seite habe sich
 * geändert — eine Aussage, die weder belegt noch gemeint ist. Die Sitemap
 * beschreibt deshalb nur, WAS ausgeliefert wird.
 *
 * `priority` ist eine relative Angabe innerhalb dieser Auslieferung, kein
 * Versprechen an Suchmaschinen.
 */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_ROUTES.map((route) => ({
    url: siteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
