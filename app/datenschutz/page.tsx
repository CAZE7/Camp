import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';

import { PageShell } from '@/components/brand/PageShell';
import { PageStructuredData } from '@/components/seo/PageStructuredData';

export const metadata: Metadata = metadataForPage('/datenschutz/');

export default function DatenschutzPage() {
  return (
    <>
      <PageStructuredData path="/datenschutz/" />
      <PageShell variant="article" mainClassName="container-page prose-measure">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Datenschutz</h1>
        <p className="caption-sm mt-2 text-ink-soft">
          Kurzfassung – bitte den finalen Text mit einer Rechtsberatung abgleichen.
        </p>

        <section className="mt-8 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Lokale Speicherung</h2>
          <p>
            Elektroplaner speichert Konfigurationen (z. B. Dach-Layout, Ausbau-Status) im Browser
            (LocalStorage). Diese Daten verlassen dein Gerät nicht.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt & Rechte</h2>
          <p>Auskunfts-, Korrektur- und Löschanfragen richtest du an die im Impressum genannte Adresse.</p>
        </section>
      </PageShell>
    </>
  );
}
