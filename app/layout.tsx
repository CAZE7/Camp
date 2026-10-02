import './globals.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import type { Metadata, Viewport } from 'next';

import { SystemThemeSync } from '@/components/theme/SystemThemeSync';
import { SITE_NAME, SITE_ORIGIN, siteNodeId, siteUrl } from '@/lib/site';

import { DEFAULT_PREVIEW_IMAGE, INDEXABLE_ROBOTS } from './siteMetadata';

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
  description:
    'Werkstatt für den Camper-Ausbau: Schaltplan mit Kabelquerschnitt und Absicherung, Dachbelegung, Heizlast und die Reihenfolge der Gewerke.',
  applicationName: SITE_NAME,
  alternates: { canonical: siteUrl('/') },
  robots: INDEXABLE_ROBOTS,
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: SITE_NAME,
    url: siteUrl('/'),
    title: 'Camper-Ausbau planen: Elektrik, Dach und Heizlast',
    description:
      'Werkstatt für den Camper-Ausbau: Schaltplan mit Kabelquerschnitt und Absicherung, Dachbelegung, Heizlast und die Reihenfolge der Gewerke.',
    images: [
      {
        url: siteUrl(DEFAULT_PREVIEW_IMAGE.path),
        width: DEFAULT_PREVIEW_IMAGE.width,
        height: DEFAULT_PREVIEW_IMAGE.height,
        alt: DEFAULT_PREVIEW_IMAGE.alt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: siteUrl(DEFAULT_PREVIEW_IMAGE.path), alt: DEFAULT_PREVIEW_IMAGE.alt }],
  },
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
