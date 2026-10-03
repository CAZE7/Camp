import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';

/**
 * Kopfdaten der Design-System-Ansicht.
 *
 * Die Ansicht ist ein internes Nachschlagewerk für Bausteine und Muster, kein
 * Inhalt für Ergebnislisten — sie wird deshalb nicht in den Index aufgenommen
 * und steht auch nicht in der Sitemap.
 */
export const metadata: Metadata = metadataForPage('/design-system/');

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
