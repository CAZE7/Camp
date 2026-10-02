import type { ReactNode } from 'react';

import { JsonLd } from '@/components/seo/JsonLd';
import { jsonLdGraph, pageMetadata } from '@/lib/seo/pages';

/**
 * Metadaten für ein Segment, dessen `page.tsx` eine Client-Component ist:
 * `export const metadata` ist dort verboten, im Server-Layout desselben
 * Segments aber erlaubt. Deshalb liegt Route-Titel, Description, Canonical und
 * Structured Data hier — ohne die Seitenkomponente selbst umzubauen.
 */
export const metadata = pageMetadata('/tools/dach');

export default function DachPlanerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <JsonLd graph={jsonLdGraph('/tools/dach')} />
    </>
  );
}
