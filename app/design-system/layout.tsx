import type { Metadata } from 'next';

import { pageMetadata } from '@/app/siteMetadata';

/**
 * Kopfdaten der Design-System-Ansicht.
 *
 * Die Ansicht ist ein internes Nachschlagewerk für Bausteine und Muster, kein
 * Inhalt für Ergebnislisten — sie wird deshalb nicht in den Index aufgenommen
 * und steht auch nicht in der Sitemap.
 */
export const metadata: Metadata = pageMetadata({
  title: 'Design-System',
  description: 'Interne Übersicht der Bausteine, Zustände und Typografiestufen des Planers.',
  path: '/design-system/',
  index: false,
});

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
