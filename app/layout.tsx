import './globals.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import mono400LatinUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2';
import mono500LatinUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2';
import type { Metadata, Viewport } from 'next';

import { SystemThemeSync } from '@/components/theme/SystemThemeSync';
import { SITE_NAME, SITE_ORIGIN, siteNodeId, siteUrl } from '@/lib/site';

/**
 * Kopfdaten der gesamten Auslieferung.
 *
 * `metadataBase` ist die Bezugsgröße für alle relativen Adressen; die
 * Titel-Vorlage hängt den Markennamen an jeden Seitentitel an, der nicht als
 * vollständig gekennzeichnet ist (`absoluteTitle` in `siteMetadata.ts`).
 * Website und Organisation werden hier einmal beschrieben — Seiten verweisen
 * über dieselben Kennungen (`siteNodeId`) darauf, statt eigene Knoten mit
 * abweichenden Adressen anzulegen.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: 'Camper-Ausbau planen: Elektrik, Dach und Heizlast | Werft',
    template: `%s | ${SITE_NAME}`,
  },
  applicationName: SITE_NAME,
  formatDetection: { telephone: false, address: false, email: false },
};

/**
 * `viewportFit: 'cover'` ist Voraussetzung dafür, dass `env(safe-area-inset-*)`
 * überhaupt Werte liefert — ohne das bliebe die Bottom-Navigation des Planers
 * auf iPhones unter dem Home-Indicator hängen.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Bewusst ohne `themeColor`: Die Einfärbung der Browserleiste wäre der
  // einzige Farbwert außerhalb von `app/globals.css` — die Farbquelle des
  // Projekts bleibt eine einzige Datei (Wächter: lib/designTokens.test.ts).
  // Die Systemhelligkeit meldet `color-scheme` aus dem Stylesheet.
};

/** Beschreibung von Website und Organisation — einmal für die Auslieferung. */
function siteDescriptionJsonLd() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': siteNodeId('website'),
        url: siteUrl('/'),
        name: SITE_NAME,
        inLanguage: 'de-DE',
        publisher: { '@id': siteNodeId('organization') },
      },
      {
        '@type': 'Organization',
        '@id': siteNodeId('organization'),
        name: SITE_NAME,
        url: siteUrl('/'),
        inLanguage: 'de-DE',
        logo: {
          '@type': 'ImageObject',
          url: siteUrl('/og/werft-mark.png'),
          width: 512,
          height: 512,
        },
      },
    ],
  };

  return JSON.stringify(graph).replaceAll('<', '\\u003c');
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Dark Mode vor dem ersten Paint setzen (kein Flash): Dieselbe
            System-Politik wie usePlannerDarkMode / SystemThemeSync. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteDescriptionJsonLd() }} />
        {/* Vorladen der lateinischen Schnitte der Werteschrift: ohne Preload
            beginnt ihr Download erst nach dem CSS-Parsen, und der Austausch der
            Ersatzschrift gegen IBM Plex Mono bricht denselben Text eine Zeile
            später um. Das Gate „CLS sollte 0 sein" in tests/e2e/visual-de.spec.ts
            misst genau diese Verschiebung (gemessen 0,0158 bei 375 px). */}
        <link rel="preload" as="font" type="font/woff2" href={mono400LatinUrl} crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href={mono500LatinUrl} crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen font-sans">
        <SystemThemeSync />
        {/* Skip-Link für Tastatur- und Screen-Reader-Nutzer (WCAG 2.4.1) */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-none focus:border focus:border-ink focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper focus:shadow-lg focus:outline-none"
        >
          Zum Hauptinhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
