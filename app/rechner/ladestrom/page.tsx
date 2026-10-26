import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { LADESTROM_CONTENT } from '@/lib/seo/content/ladestrom';

/** app/rechner/ladestrom/page.tsx — Rechner für den Ladestrom des Boosters. */
export const metadata: Metadata = metadataFor(LADESTROM_CONTENT);

export default function LadestromPage() {
  return <SeoPage page={LADESTROM_CONTENT} />;
}
