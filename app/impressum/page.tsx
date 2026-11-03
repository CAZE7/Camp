import type { Metadata } from 'next';

import { PageShell } from '@/components/brand/PageShell';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
// AUDIT „Impressum-Placeholder" (erledigt 2026-10-28): Die Angaben stehen in
// `lib/siteLegal.ts` — eine Stelle zum Ausfüllen, eine maschinell prüfbare
// Vollständigkeit (`npm run ci:verify-legal-notice`, Schritt im
// Deploy-Workflow). Der Placeholder-Zweig bleibt bestehen: Er ist der Zustand,
// den der Wächter meldet, wenn die Angaben später geerbt oder geleert werden.
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
              <p>Elektroplaner — Projekt-Placeholder</p>
              <p>Bitte hier den Namen und die Anschrift des Betreibers eintragen.</p>
            </>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt</h2>
          {emailComplete ? (
            <p>
              E-Mail:{' '}
              <a
                href={`mailto:${legal.email}`}
                className="font-medium text-copper underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
              >
                {legal.email}
              </a>
            </p>
          ) : (
            <p>
              E-Mail:{' '}
              <a
                href="mailto:kontakt@example.org"
                className="font-medium text-copper underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
              >
                kontakt@example.org
              </a>
            </p>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Verantwortlich für den Inhalt</h2>
          {responsibleComplete ? (
            <p>Nach § 18 Abs. 2 MStV: {legal.contentResponsible}</p>
          ) : (
            <p>Nach § 18 Abs. 2 MStV: Bitte hier eintragen.</p>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Haftungshinweis</h2>
          <p>
            Elektroplaner ist ein Planungswerkzeug für den Camper-Ausbau. Berechnungen (Heizlast,
            Kabelquerschnitt, Solarleistung) sind Näherungen und ersetzen keine Elektrofachkraft. Für
            Landstrom-Anlagen ist eine Prüfung durch qualifiziertes Personal nach DIN VDE 0100-721 Pflicht.
          </p>
        </section>
      </PageShell>
    </>
  );
}
