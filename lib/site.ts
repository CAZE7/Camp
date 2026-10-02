/**
 * lib/site.ts — Herkunft und Basis-Pfad der Auslieferung an genau einer Stelle.
 *
 * Die Anwendung wird als statischer Export über GitHub Pages unter einem
 * Repository-Pfad ausgeliefert (`/Camp`). Absolute Adressen entstehen an
 * mehreren Stellen: Canonical-Verweis, Open-Graph-URL, Sitemap-Eintrag und
 * der Sitemap-Verweis in `robots.txt`. Wären das vier eigene
 * Zeichenketten-Verkettungen, würde ein geänderter Basis-Pfad an genau einer
 * davon hängen bleiben — und eine Sitemap, die auf nicht ausgelieferte
 * Adressen zeigt, ist schlimmer als keine.
 *
 * Der Basis-Pfad kommt aus derselben Umgebungsvariablen, die
 * `next.config.ts` als `basePath` setzt; ohne gesetzte Variable ist er leer
 * (Entwicklung und Prüfbau ohne Basis-Pfad).
 */

/** Öffentliche Herkunft der Auslieferung, ohne abschließenden Schrägstrich. */
export const SITE_ORIGIN = 'https://caze7.github.io';

/** Anzeigename der Seite (Open Graph, Sitemap-Kontext, JSON-LD). */
export const SITE_NAME = 'Werft';

/** Basis-Pfad des Exports, z. B. `/Camp`; leer bei Auslieferung unter `/`. */
export const SITE_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');

/**
 * Setzt eine absolute Adresse aus Herkunft, Basis-Pfad und Seitenpfad
 * zusammen. Der Seitenpfad darf mit oder ohne führenden Schrägstrich
 * übergeben werden; der Basis-Pfad ist als Parameter überschreibbar, damit
 * die Zusammensetzung ohne Umbau der Umgebung prüfbar bleibt.
 */
export const siteUrl = (path = '/', basePath: string = SITE_BASE_PATH): string => {
  const origin = SITE_ORIGIN.replace(/\/+$/, '');
  const base = basePath.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${base}${suffix}`;
};
