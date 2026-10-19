import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { PageStructuredData } from '@/components/seo/PageStructuredData';

import { HeizungErklaerung } from './HeizungErklaerung';

/**
 * app/tools/heizung/layout.tsx — Rahmen und Erklärung der Heizlast-Seite.
 *
 * Kopfdaten und strukturierte Beschreibung der Client-Route.
 *
 * Das Layout trägt zusätzlich den erklärenden Text. Zwei Gründe:
 *
 *  1. Der Text bleibt eine Server-Komponente. Würde er in der Client-Seite
 *     stehen, läge der Text als JavaScript im Bündel — und die Prüfung der
 *     initialen Skriptgröße schlägt dann für die Werkzeugseiten an.
 *  2. Der Text gehört in den Hauptinhalt (`main`). Als Layout-Kind steht er
 *     unter dem Werkzeug und über dem Seitenfuß.
 */
export const metadata: Metadata = metadataForPage('/tools/heizung/');

export default function HeizungLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageStructuredData path="/tools/heizung/" />
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <SiteHeader />
        <main id="main" className="flex flex-1 flex-col">
          {children}
          <HeizungErklaerung />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
