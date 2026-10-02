import type { Metadata } from 'next';

import { pageMetadata } from '@/app/siteMetadata';

/** Kopfdaten der Heizlast-Route (die Seite selbst ist eine Client-Komponente). */
export const metadata: Metadata = pageMetadata({
  title: 'Heizlast-Rechner für Wohnmobil und Camper',
  description:
    'Benötigte Heizleistung aus Fahrzeuggröße, Dämmung und Wunschtemperatur berechnen — inklusive Empfehlung, welches Heizgerät passt.',
  path: '/tools/heizung/',
});

export default function HeizungLayout({ children }: { children: React.ReactNode }) {
  return children;
}
