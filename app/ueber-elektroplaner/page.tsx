import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { UEBER_ELEKTROPLANER_CONTENT } from '@/lib/seo/content/ueber-elektroplaner';

/**
 * app/ueber-elektroplaner/page.tsx — Vertrauensseite: Projekt, Methodik,
 * Quellen, Grenzen und Kontakt (§19).
 *
 * Der Pfad trägt den Produktnamen; die frühere Adresse `/ueber-werft/`
 * antwortet als Umleitungsseite (`app/ueber-werft/page.tsx`) und steht nicht
 * in der Sitemap.
 */
export const metadata: Metadata = metadataFor(UEBER_ELEKTROPLANER_CONTENT);

export default function UeberElektroplanerPage() {
  return <SeoPage page={UEBER_ELEKTROPLANER_CONTENT} />;
}
