import type { Metadata } from 'next';

import { pageMetadata } from '@/app/siteMetadata';

/**
 * Kopfdaten der Dach-Planer-Route.
 *
 * Die Seite selbst ist eine Client-Komponente (React Flow); Kopfdaten können
 * deshalb nicht dort stehen. Dieser Layout trägt sie und rendert sonst nichts —
 * kein zusätzliches Element im DOM.
 */
export const metadata: Metadata = pageMetadata({
  title: 'Dach-Planer: Solarpanels und Dachluken platzieren',
  description:
    'Solarpanels, Dachluken und Kabeldurchlässe auf der Dachfläche platzieren, Belegung prüfen und die Gesamtleistung in Watt ablesen.',
  path: '/tools/dach/',
  image: {
    path: '/og/dach.png',
    width: 1200,
    height: 630,
    alt: 'Solarpanels auf dem Dach eines Campers',
  },
});

export default function DachLayout({ children }: { children: React.ReactNode }) {
  return children;
}
