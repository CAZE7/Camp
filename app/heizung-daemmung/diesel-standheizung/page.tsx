import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { DIESEL_STANDHEIZUNG_CONTENT } from '@/lib/seo/content/diesel-standheizung';

/**
 * app/heizung-daemmung/diesel-standheizung/page.tsx — Spoke des Heizung-Pillars.
 */
export const metadata: Metadata = metadataFor(DIESEL_STANDHEIZUNG_CONTENT);

export default function DieselStandheizungPage() {
  return <SeoPage page={DIESEL_STANDHEIZUNG_CONTENT} />;
}
