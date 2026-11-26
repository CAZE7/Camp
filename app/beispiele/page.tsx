import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { pageNodeId, type JsonLdNode } from '@/lib/seo/jsonLd';
import { BEISPIELE_HUB_CONTENT, BEISPIELE_LISTE } from '@/lib/seo/content/beispiele/hub';
import { siteUrl } from '@/lib/site';

/**
 * app/beispiele/page.tsx — der Hub der drei Beispiel-Schaltpläne.
 *
 * Die drei Beispiele stehen sichtbar als Verweisliste im ersten Abschnitt
 * und maschinenlesbar als ItemList im JSON-LD — aus derselben Liste
 * (`BEISPIELE_LISTE`), damit Schema und Anzeige nicht auseinanderlaufen.
 * Das Inventar kündigt den ItemList-Knoten für genau diesen Pfad an
 * (`lib/seo/inventory.ts`), sonst meldet das Gate `json-ld-inventar`.
 */
export const metadata: Metadata = metadataFor(BEISPIELE_HUB_CONTENT);

const BEISPIELE_ITEMLIST: JsonLdNode = {
  '@type': 'ItemList',
  '@id': pageNodeId(BEISPIELE_HUB_CONTENT.path, 'itemlist'),
  name: BEISPIELE_HUB_CONTENT.h1,
  numberOfItems: BEISPIELE_LISTE.length,
  itemListElement: BEISPIELE_LISTE.map((beispiel, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: beispiel.label,
    item: siteUrl(beispiel.href),
  })),
};

export default function BeispieleHub() {
  return <SeoPage page={BEISPIELE_HUB_CONTENT} extraJsonLdNodes={[BEISPIELE_ITEMLIST]} />;
}
