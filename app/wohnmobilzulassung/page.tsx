import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { WOHNMOBILZULASSUNG_CONTENT } from '@/lib/seo/content/wohnmobilzulassung';

/**
 * app/wohnmobilzulassung/page.tsx — Pillar Wohnmobilzulassung.
 */
export const metadata: Metadata = metadataFor(WOHNMOBILZULASSUNG_CONTENT);

export default function WohnmobilzulassungPage() {
  return <SeoPage page={WOHNMOBILZULASSUNG_CONTENT} />;
}
