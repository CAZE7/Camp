import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { SOLARANLAGE_CONTENT } from '@/lib/seo/content/solaranlage';

/** app/rechner/solaranlage/page.tsx — Rechner für die Solarinsel. */
export const metadata: Metadata = metadataFor(SOLARANLAGE_CONTENT);

export default function SolaranlagePage() {
  return <SeoPage page={SOLARANLAGE_CONTENT} />;
}
