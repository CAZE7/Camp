import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { HEIZUNG_CONTENT } from '@/lib/seo/content/heizung';

/**
 * app/heizung-daemmung/page.tsx — Pillar Heizung & Dämmung.
 *
 * Die Zustellung zum Inhalt in `lib/seo/content/heizung.ts`; die Adresse liegt
 * außerhalb von `/camper-elektrik/`, deshalb keine Slug-Route, sondern eine
 * eigene Datei.
 */
export const metadata: Metadata = metadataFor(HEIZUNG_CONTENT);

export default function HeizungDaemmungPage() {
  return <SeoPage page={HEIZUNG_CONTENT} />;
}
