import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { BATTERIEKAPAZITAET_CONTENT } from '@/lib/seo/content/batteriekapazitaet';

/** app/rechner/batteriekapazitaet/page.tsx — Rechner für die Aufbaubatterie. */
export const metadata: Metadata = metadataFor(BATTERIEKAPAZITAET_CONTENT);

export default function BatteriekapazitaetPage() {
  return <SeoPage page={BATTERIEKAPAZITAET_CONTENT} />;
}
