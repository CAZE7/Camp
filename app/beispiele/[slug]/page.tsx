import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { CONTENT_PAGES } from '@/lib/seo/content';
import type { SeoPageContent } from '@/lib/seo/types';

/**
 * app/beispiele/[slug]/page.tsx — die drei Beispiel-Schaltpläne.
 *
 * Eine Route für alle Beispiele, Inhalte handgeschrieben in
 * `lib/seo/content/beispiele/`. Wie bei den Themenseiten gilt: Die Route
 * ist nur Zustellung — `generateStaticParams` erzeugt beim Export genau
 * die Seiten, die als Inhalt existieren.
 */

const HUB_PFAD = '/beispiele/';

const BEISPIELE: readonly SeoPageContent[] = CONTENT_PAGES.filter(
  (page) => page.path.startsWith(HUB_PFAD) && page.path !== HUB_PFAD
);

export function generateStaticParams(): { slug: string }[] {
  return BEISPIELE.map((page) => ({ slug: page.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = BEISPIELE.find((entry) => entry.slug === slug);
  if (!page) return {};
  return metadataFor(page);
}

export default async function BeispielSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = BEISPIELE.find((entry) => entry.slug === slug);
  if (!page) notFound();

  return <SeoPage page={page} />;
}
