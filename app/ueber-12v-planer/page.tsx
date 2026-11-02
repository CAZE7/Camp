import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { UEBER_12V_PLANER_CONTENT } from '@/lib/seo/content/ueber-12v-planer';

/**
 * app/ueber-12v-planer/page.tsx — Vertrauensseite: Projekt, Methodik,
 * Quellen, Grenzen und Kontakt (§19).
 *
 * Die früheren Adressen `/ueber-werft/` und `/ueber-elektroplaner/`
 * antworten als Umleitungsseiten und stehen nicht in der Sitemap.
 */
export const metadata: Metadata = metadataFor(UEBER_12V_PLANER_CONTENT);

export default function Ueber12vPlanerPage() {
  return <SeoPage page={UEBER_12V_PLANER_CONTENT} />;
}
