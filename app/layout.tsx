import './globals.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource-variable/outfit';
import '@fontsource-variable/inter';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Werft — Erst der Plan. Dann das Blech.',
  description:
    'Werkstatt für den Camper-Ausbau. 12V-Schaltplan, Dachfläche, Heizlast und Normen — geplant, bevor gebohrt wird.',
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
    <html lang="de">
      <body className="min-h-screen font-sans">
        {/* Skip-Link für Tastatur- und Screen-Reader-Nutzer (WCAG 2.4.1) */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-none focus:border focus:border-ink focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper focus:shadow-lg focus:outline-none"
        >
          Zum Hauptinhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
