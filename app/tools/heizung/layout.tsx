import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';
import { PageStructuredData } from '@/components/seo/PageStructuredData';

/** Kopfdaten und strukturierte Beschreibung der Client-Route. */
export const metadata: Metadata = metadataForPage('/tools/heizung/');

export default function HeizungLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageStructuredData path="/tools/heizung/" />
      {children}
    </>
  );
}
