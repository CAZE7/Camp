import type { MetadataRoute } from 'next';

import { freigegebeneBilder, bildIstFreigegeben, type Produktionsbild } from '@/lib/seo/bildSitemap';
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
 *
 * Bilder (P3/P4): `images` kommt aus `lib/seo/bildSitemap.ts`, derselben
 * Liste wie das WebPage-Schema. Solange keine eigene Aufnahme mit geklärten
 * Rechten eingetragen ist, wird KEIN Bild behauptet — die Sitemap bleibt dann
 * exakt wie vorher. P2 liefert die Fotos, nicht dieses Modul.
 */
export const dynamic = 'force-static';

export function sitemapEintraege(
  bilder: readonly Produktionsbild[] = freigegebeneBilder()
): MetadataRoute.Sitemap {
  const gueltigeSeiten = new Set(SITEMAP_ROUTES.map((route) => route.path));
  const bilderNachSeite = new Map<string, string[]>();

  for (const bild of bilder) {
    if (!bildIstFreigegeben(bild) || !gueltigeSeiten.has(bild.seite)) continue;
    const vorhanden = bilderNachSeite.get(bild.seite) ?? [];
    vorhanden.push(siteUrl(bild.pfad));
    bilderNachSeite.set(bild.seite, vorhanden);
  }

  return SITEMAP_ROUTES.map((route) => {
    const images = bilderNachSeite.get(route.path);
    return {
      url: siteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      ...(images && images.length > 0 ? { images } : {}),
    };
  });
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEintraege();
}
