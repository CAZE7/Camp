import './globals.css';
import './ladebooster-vergleich.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import mono400LatinUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2';
import mono500LatinUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2';
import interLatinUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
import outfitLatinUrl from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2';
import type { Metadata, Viewport } from 'next';
import { preload } from 'react-dom';

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
    default: 'Camper-Ausbau planen: Elektrik, Dach und Heizlast | Elektroplaner',
    template: `%s | ${SITE_NAME}`,
  },
  applicationName: SITE_NAME,
  referrer: 'strict-origin-when-cross-origin',
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
          url: siteUrl('/og/elektroplaner-mark.png'),
          width: 512,
          height: 512,
        },
      },
    ],
  };

  return JSON.stringify(graph).replaceAll('<', '\\u003c');
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Vier Schriften stehen über der Falz jeder Seite: zwei Schnitte der
  // Werteschrift (Zahlen im Planer) und je ein variabler Schnitt für Fließtext
  // (Inter) und Überschriften (Outfit). Ohne Preload beginnt der Download erst
  // nach dem CSS-Parsen, und der Austausch der Ersatzschrift bricht den Text um
  // (`tests/e2e/visual-de.spec.ts` misst CLS; gemessen 0,0158 bei 375 px).
  //
  // Warum `preload()` aus `react-dom` und nicht <link> im <head>: React 19
  // behandelt ein `<link rel="preload">` als Ressourcen-Hinweis und gibt es
  // ZUSÄTZLICH zu der Stelle aus, an der es steht — gemessen im Export standen
  // vier Schriften achtmal im Kopf. `preload()` dedupliziert über den Pfad und
  // erzeugt genau ein Element je Datei.
  //
  // Vorgeladen wird die lateinische Datei: Die übrigen Subsets (kyrillisch,
  // griechisch, vietnamesisch) liegen im Export, werden für deutsche Inhalte
  // aber nie angefordert (`unicode-range`).
  preload(mono400LatinUrl, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  preload(mono500LatinUrl, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  preload(interLatinUrl, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  preload(outfitLatinUrl, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* M11-7 / N11: Content-Security-Policy auf Dokumentebene für Static
            Hosting (GitHub Pages liefert keine benutzerdefinierten HTTP-Header;
            ergänzende HTTP-Header inkl. frame-ancestors liegen in public/_headers,
            siehe ADR 0038). */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' https: ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'"
        />
        {/* Dark Mode vor dem ersten Paint setzen (kein Flash): Dieselbe
            System-Politik wie usePlannerDarkMode / SystemThemeSync. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteDescriptionJsonLd() }} />
        {/* Kurzübersicht für Sprachmodell-Agenten (app/llms.txt/route.ts).
            Der Verweis steht im Kopf, weil eine Datei, auf die nichts zeigt,
            auch nicht abgerufen wird — Agent-Readiness-Messungen führen fast
            alle llms.txt-Aufrufe auf einen Link zurück, nicht auf einen
            geratenen Pfad. Kein sichtbarer Link: Für Menschen ist die Datei
            ohne Nutzen, und die Fußzeile ist voll genug. */}
        <link rel="alternate" type="text/plain" href={`${siteUrl('/llms.txt')}`} title="llms.txt" />
      </head>
      <body className="min-h-dvh font-sans">
        <SystemThemeSync />
        {/* Skip-Link für Tastatur- und Screen-Reader-Nutzer (WCAG 2.4.1) */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:rounded-none focus:border focus:border-ink focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper focus:shadow-lg focus:outline-none"
        >
          Zum Hauptinhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
