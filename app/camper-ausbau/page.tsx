import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { AUSAUS_DOKUMENTATION_CONTENT } from '@/lib/seo/content/ausbau-dokumentation';

/**
 * app/camper-ausbau/page.tsx — Ausbau-Dokumentation des eigenen Campers.
 */
export const metadata: Metadata = metadataFor(AUSAUS_DOKUMENTATION_CONTENT);

export default function AusbauDokumentationPage() {
  return <SeoPage page={AUSAUS_DOKUMENTATION_CONTENT} />;
}
