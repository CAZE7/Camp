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
 * `lastModified` kommt aus derselben Quelle wie das sichtbare „Inhaltlicher
 * Stand" der Seite (`contentRevision` im Inventar). Bewusst NICHT die
 * Build-Zeit: Ein Zeitstempel aus dem Bau würde bei jedem Bau behaupten, die
 * Seite habe sich geändert — eine Aussage, die weder belegt noch gemeint ist.
 * Wo der Inhalt nicht durchgesehen wurde, steht deshalb kein Zeitstempel in
 * der Sitemap: lieber eine ehrliche Lücke als ein erfundenes Datum.
 *
 * `priority` ist eine relative Angabe innerhalb dieser Auslieferung, kein
 * Versprechen an Suchmaschinen.
 */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_ROUTES.map((route) => ({
    url: siteUrl(route.path),
    ...(route.contentRevision ? { lastModified: route.contentRevision } : {}),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
