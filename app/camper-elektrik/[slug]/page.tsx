import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { CONTENT_PAGES } from '@/lib/seo/content';
import type { SeoPageContent } from '@/lib/seo/types';

/**
 * app/camper-elektrik/[slug]/page.tsx — die Themenseiten unter dem Pillar.
 *
 * Eine Route für alle Unterthemen, aber KEINE automatisch erzeugten Texte:
 * Jeder Slug hat einen handgeschriebenen Inhalt in `lib/seo/content/`. Die
 * Route ist nur die Zustellung — `generateStaticParams` erzeugt beim Export
 * genau die Seiten, die als Inhalt existieren.
 *
 * Warum eine Route statt elf Dateien: Elf Dateien mit identischem Gerüst wären
 * elf Gelegenheiten, eine Brotkrume oder die strukturierte Beschreibung zu
 * vergessen. Der Inhalt bleibt trotzdem je Seite eigenständig.
 */

const PILLAR_PFAD = '/camper-elektrik/';

const THEMEN: readonly SeoPageContent[] = CONTENT_PAGES.filter(
  // Der Pillar selbst hat seine eigene Route (`app/camper-elektrik/page.tsx`);
  // liefe er hier mit, gäbe es ihn zweimal — mit doppeltem Titel und einem
  // Canonical auf die falsche Adresse.
  (page) => page.path.startsWith(PILLAR_PFAD) && page.path !== PILLAR_PFAD
);

export function generateStaticParams(): { slug: string }[] {
  return THEMEN.map((page) => ({ slug: page.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = THEMEN.find((entry) => entry.slug === slug);
  if (!page) return {};
  return metadataFor(page);
}

export default async function Themenseite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = THEMEN.find((entry) => entry.slug === slug);
  if (!page) notFound();

  return <SeoPage page={page} />;
}
