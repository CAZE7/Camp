import type { Metadata } from 'next';

import { metadataFor } from '@/app/seoMetadata';
import { SeoPage } from '@/components/seo/SeoPage';
import { TopicIndex } from '@/components/seo/TopicIndex';
import { CAMPER_ELEKTRIK_PILLAR } from '@/lib/seo/content/pillar';

/**
 * app/camper-elektrik/page.tsx — die Pillar-Seite des Themas.
 *
 * Sie rendert den Inhalt aus `lib/seo/content/pillar.ts` mit dem gemeinsamen
 * Gerüst (`SeoPage`) und hängt das Themenverzeichnis an: Jedes Unterthema mit
 * eigener Seite wird dort automatisch verlinkt — die Pillar→Cluster-Verbindung
 * entsteht damit aus dem Themenbaum und nicht aus einer gepflegten Liste.
 */

export const metadata: Metadata = metadataFor(CAMPER_ELEKTRIK_PILLAR);

export default function CamperElektrikPage() {
  return (
    <SeoPage page={CAMPER_ELEKTRIK_PILLAR}>
      <TopicIndex topicId="camper-elektrik" />
    </SeoPage>
  );
}
