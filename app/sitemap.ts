import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * Sitemap der ausgelieferten Seiten. Als Route statt als Datei in `public/`,
 * damit die Adressen denselben Basis-Pfad benutzen wie Canonical-Verweis und
 * Betriebsanzeige (`lib/site.ts`).
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

type StaticRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const ROUTES: readonly StaticRoute[] = [
  { path: '/', changeFrequency: 'monthly', priority: 1 },
  { path: '/elektrik-planung/', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/tools/dach/', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/tools/heizung/', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/guides/ausbau-fahrplan/', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/guides/camper-ausbauguide/', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/guides/holzausbau/', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/impressum/', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/datenschutz/', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: siteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
