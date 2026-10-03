import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { SPANNUNGSABFALL_12V_CONTENT } from '@/lib/seo/content/spannungsabfall-12v';

/**
 * app/rechner/spannungsabfall-12v/page.tsx — Rechner-Landingpage für den
 * Spannungsfall. Die Themenseite (`/camper-elektrik/spannungsabfall/`)
 * erklärt, diese Seite rechnet.
 */
export const metadata: Metadata = metadataFor(SPANNUNGSABFALL_12V_CONTENT);

export default function Spannungsabfall12VPage() {
  return <SeoPage page={SPANNUNGSABFALL_12V_CONTENT} />;
}
