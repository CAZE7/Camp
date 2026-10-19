import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { PageStructuredData } from '@/components/seo/PageStructuredData';

import { DachErklaerung } from './DachErklaerung';

/**
 * app/tools/dach/layout.tsx — Rahmen und Erklärung der Dach-Seite.
 *
 * Die Seite selbst ist eine Client-Komponente (React Flow); Metadaten und
 * strukturierte Beschreibung stehen deshalb im Server-Layout.
 *
 * Das Layout trägt zusätzlich den erklärenden Text. Zwei Gründe:
 *
 *  1. Der Text bleibt eine Server-Komponente. Würde er in der Client-Seite
 *     stehen, läge der Text als JavaScript im Bündel — und die Prüfung der
 *     initialen Skriptgröße schlägt dann für die Werkzeugseiten an.
 *  2. Der Text gehört in den Hauptinhalt (`main`). Als Layout-Kind steht er
 *     zwischen Werkfläche und Seitenfuß, ohne die Werkfläche zu verdrängen:
 *     Sie behält ihre Mindesthöhe, der Text steht darunter.
 */
export const metadata: Metadata = metadataForPage('/tools/dach/');

export default function DachLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageStructuredData path="/tools/dach/" />
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <SiteHeader />
        <main id="main" className="flex flex-1 flex-col">
          {children}
          <DachErklaerung />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
