import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { metadataFor } from '@/app/seoMetadata';
import { LadeboosterVergleich } from '@/components/seo/LadeboosterVergleich';
import { SeoPage } from '@/components/seo/SeoPage';
import { itemListNode } from '@/lib/seo/jsonLd';
import { CONTENT_PAGES } from '@/lib/seo/content';
import { ATTRIBUTE, GERAETE } from '@/lib/seo/ladeboosterGeraete';
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

  // Der Vergleich ist die Scan-Schicht der Seite und gehört deshalb unter die
  // H1, nicht hinter sämtliche Ratgeber-Abschnitte. Gemessener Befund aus der
  // Agenten-Sitzung „Ladebooster Vergleichsplan" (6.152 Wörter, nur 1 von 8
  // H3 war überhaupt ein Gerätevergleich, Vergleich stand ganz unten):
  // docs/design-2026-11/ANHAENGE-INTEGRATION-2026-11-03.md §3.
  // `afterHeader` ist genau der Slot für Inhalt VOR den Abschnitten; er wird
  // nicht mehr als `children` (nach den Abschnitten) übergeben.
  /**
   * Die Rangliste ist nicht nur sichtbares HTML, sondern ein ItemList-Knoten
   * aus derselben Datenquelle. Preise bleiben außen vor: Eine beobachtete
   * Momentaufnahme darf nicht als maschinelle Zusage veralten. `null`-Werte
   * („nicht belegt") werden gar nicht erst in `additionalProperty` geschrieben.
   */
  const ranglisteKnoten =
    slug === 'ladebooster'
      ? [
          itemListNode({
            path: page.path,
            name: 'Ladebooster im Vergleich: 30, 60 oder 90 A?',
            items: GERAETE.map((g) => ({
              id: g.id,
              name: `${g.brand} ${g.name}`,
              brand: g.brand,
              klasse: g.stromLabel,
              attribute: ATTRIBUTE.flatMap((a) => {
                const wert = g.specs[a.id];
                return wert === null ? [] : [{ label: a.label, wert }];
              }),
            })),
          }),
        ]
      : [];

  return (
    <SeoPage
      page={page}
      afterHeader={slug === 'ladebooster' ? <LadeboosterVergleich /> : null}
      extraJsonLdNodes={ranglisteKnoten}
    />
  );
}
