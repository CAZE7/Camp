import type { Metadata } from 'next';

import { PageShell } from '@/components/brand/PageShell';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
// AUDIT „Impressum-Placeholder": Die Angaben stehen in `lib/siteLegal.ts` —
// eine Stelle zum Ausfüllen, eine maschinell prüfbare Vollständigkeit
// (`npm run ci:verify-legal-notice`, Schritt im Deploy-Workflow).
import { SITE_LEGAL, isPlaceholderText, isProviderComplete } from '@/lib/siteLegal';

import { metadataForPage } from '@/app/seoMetadata';

export const metadata: Metadata = metadataForPage('/impressum/');

export default function ImpressumPage() {
  const legal = SITE_LEGAL;
  const providerComplete = isProviderComplete(legal);
  const emailComplete = !isPlaceholderText(legal.email);
  const responsibleComplete = !isPlaceholderText(legal.contentResponsible);

  return (
    <>
      <PageStructuredData path="/impressum/" />
      <PageShell variant="article" mainClassName="container-page prose-measure">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Impressum</h1>
        <p className="caption-sm mt-2 text-ink-soft">Angaben gemäß § 5 DDG.</p>

        <section className="mt-8 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Anbieter</h2>
          {providerComplete ? (
            <>
              <p>{legal.providerName}</p>
              <p>{legal.street}</p>
              <p>{legal.postalCodeAndCity}</p>
            </>
          ) : (
            <>
              {/* Solange die Angaben fehlen, steht hier die Aufforderung an den
                  Betreiber. Dieser Zweig ist zeichen- und pixelidentisch mit der
                  eingefrorenen Baseline (tests/e2e/visual.spec.ts-snapshots/
                  route-impressum-{light,dark}.png) — ein Textwechsel hier
                  verschiebt das visuelle Gate und braucht UI-Freigabe. */}
              <p>Elektroplaner — Betreiberangaben werden ergänzt.</p>
              <p>Name und Anschrift des Betreibers werden vor der Veröffentlichung ergänzt.</p>
            </>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt</h2>
          {emailComplete ? <p>E-Mail: {legal.email}</p> : <p>E-Mail: wird ergänzt.</p>}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Verantwortlich für den Inhalt</h2>
          {responsibleComplete ? (
            <p>Nach § 18 Abs. 2 MStV: {legal.contentResponsible}</p>
          ) : (
            <p>Nach § 18 Abs. 2 MStV: wird ergänzt.</p>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Haftungshinweis</h2>
          <p>
            Elektroplaner ist ein Planungswerkzeug für den Camper-Ausbau. Berechnungen (Heizlast,
            Kabelquerschnitt, Solarleistung) sind Näherungen und ersetzen keine Elektrofachkraft. Für
            Landstrom-Anlagen gehören Errichtung und Erstprüfung in die Hände einer Elektrofachkraft; die
            Errichtung folgt DIN VDE 0100-721, die Erstprüfung DIN VDE 0100-600.
          </p>
        </section>
      </PageShell>
    </>
  );
}
