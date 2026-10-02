import './globals.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import type { Metadata, Viewport } from 'next';
import { SystemThemeSync } from '@/components/theme/SystemThemeSync';
import { HOME_DESCRIPTION, HOME_TITLE, OG_IMAGE, SITE_LOCALE, SITE_NAME, SITE_ORIGIN } from '@/lib/seo/site';

/**
 * Root-Metadaten: alles, was für jede Route gilt. Titel und Description einer
 * einzelnen Seite stehen in `lib/seo/pages.ts` — hier nur die Schablone.
 *
 * `metadataBase` muss die Auslieferungs-URL inklusive Base-Path sein, sonst
 * werden relative Canonicals und OG-Bilder auf dem Host ins Leere gestellt.
 */
export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_ORIGIN}/`),
  title: {
    default: `${HOME_TITLE} | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_ORIGIN }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    type: 'website',
    url: `${SITE_ORIGIN}/`,
    images: [{ ...OG_IMAGE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${HOME_TITLE} | ${SITE_NAME}`,
    description: HOME_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
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
};

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
