import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { RECHNER_HUB_CONTENT } from '@/lib/seo/content/rechner-hub';

/** app/rechner/page.tsx — Übersicht aller Rechenwerkzeuge der Auslieferung. */
export const metadata: Metadata = metadataFor(RECHNER_HUB_CONTENT);

export default function RechnerPage() {
  return <SeoPage page={RECHNER_HUB_CONTENT} />;
}
