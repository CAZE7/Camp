/**
 * Single Source of Truth für Auslieferungs-Konstanten: Host, Base-Path,
 * Markenname, Standardtexte und kanonische URL-Form.
 *
 * Warum diese Datei und nicht `next.config.ts`: `metadataBase` braucht die
 * absolute URL inklusive `/Camp`, und die kanonische Form ist diejenige, die
 * der Host tatsächlich mit 200 beantwortet. Beides sind Tatsachen der
 * Auslieferung, keine Angaben der Build-Konfiguration.
 */

export const SITE_NAME = 'Werft';

export const HOST = 'https://caze7.github.io';

/** GitHub Pages: Project Page unter dem Repo-Pfad. */
export const BASE_PATH = '/Camp';

export const SITE_ORIGIN = `${HOST}${BASE_PATH}`;

export const SITE_LOCALE = 'de_DE';

export const HOME_TITLE = 'Camper Ausbau planen — Elektrik, Dach & Heizlast';

export const HOME_DESCRIPTION =
  'Werkzeuge und Guides für den Camper-Selbstausbau: 12-V- und 230-V-Schaltplan zeichnen, Solarfläche aufs Dach legen, Heizlast berechnen. Zahlen vor dem Bohren.';

export const OG_IMAGE = {
  url: `${SITE_ORIGIN}/og/werft-camper-planung.jpg`,
  width: 1200,
  height: 630,
  alt: 'Technische Zeichnung eines Campers mit 12-V-Schaltplan, Solarpanelen auf dem Dach und Kabeltrassen',
} as const;

/**
 * Kanonische Form: mit Abschluss-Schrägstrich.
 *
 * Drei Quellen sind darin einig: `next.config.ts` (`trailingSlash: true`), der
 * Export (`out/<route>/index.html`) und die internalen Links im ausgelieferten
 * HTML. `deploy.yml` lädt `./out` unverändert hoch. Canonical und Sitemap
 * folgen dieser Form, weil Abweichungen zwischen Link, Canonical und Dateiform
 * Duplikate erzeugen, die keine Seite auflösen kann.
 */
export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}/`;
}
