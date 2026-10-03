import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { UEBER_WERFT_CONTENT } from '@/lib/seo/content/ueber-werft';

/**
 * app/ueber-werft/page.tsx — Vertrauensseite: Projekt, Methodik, Quellen,
 * Grenzen und Kontakt (§19).
 */
export const metadata: Metadata = metadataFor(UEBER_WERFT_CONTENT);

export default function UeberWerftPage() {
  return <SeoPage page={UEBER_WERFT_CONTENT} />;
}
