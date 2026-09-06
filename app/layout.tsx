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
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Werft — Erst der Plan. Dann das Blech.',
  description:
    'Werkstatt für den Camper-Ausbau. 12V-Schaltplan, Dachfläche, Heizlast und Normen — geplant, bevor gebohrt wird.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
