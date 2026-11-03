import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';
import { PageStructuredData } from '@/components/seo/PageStructuredData';

import { DACH_FAQ } from './explainerContent';

/**
 * Die Seite selbst ist eine Client-Komponente (React Flow); Metadaten und
 * strukturierte Beschreibung stehen deshalb im Server-Layout.
 */
export const metadata: Metadata = metadataForPage('/tools/dach/');

export default function DachLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageStructuredData path="/tools/dach/" faqEntries={DACH_FAQ} />
      {children}
    </>
  );
}
