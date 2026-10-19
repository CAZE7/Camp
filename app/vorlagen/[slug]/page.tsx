import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { CONTENT_PAGES } from '@/lib/seo/content';
import type { SeoPageContent } from '@/lib/seo/types';

/**
 * app/vorlagen/[slug]/page.tsx — die Ausbau-Vorlagen.
 *
 * Eine Route für alle Vorlagen, aber KEINE automatisch erzeugten Texte: Jeder
 * Slug hat einen handgeschriebenen Inhalt in `lib/seo/content/`. Die Route ist
 * nur die Zustellung — `generateStaticParams` erzeugt beim Export genau die
 * Seiten, die als Inhalt existieren.
 *
 * Warum eine eigene Route und nicht ein Abschnitt auf dem Pillar: Vorlagen
 * sind keine Wissensseite, sondern ein eigener Produkttyp — der Nutzer kommt
 * mit „wie baue ich das" und erwartet eine Stückliste, keine Erklärung.
 */

const VORLAGEN_PFAD = '/vorlagen/';

const VORLAGEN: readonly SeoPageContent[] = CONTENT_PAGES.filter((page) =>
  page.path.startsWith(VORLAGEN_PFAD)
);

export function generateStaticParams(): { slug: string }[] {
  return VORLAGEN.map((page) => ({ slug: page.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = VORLAGEN.find((entry) => entry.slug === slug);
  if (!page) return {};
  return metadataFor(page);
}

export default async function Vorlagenseite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = VORLAGEN.find((entry) => entry.slug === slug);
  if (!page) notFound();

  return <SeoPage page={page} />;
}
