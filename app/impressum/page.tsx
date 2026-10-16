import type { Metadata } from 'next';

import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
// AUDIT „Impressum-Placeholder": Die Angaben stehen in `lib/siteLegal.ts` —
// eine Stelle zum Ausfüllen, eine maschinell prüfbare Vollständigkeit
// (`npm run ci:verify-legal-notice`, Schritt im Deploy-Workflow).
import {
  SITE_LEGAL,
  hasPhone,
  hasVatId,
  isCompany,
  isContentResponsibleComplete,
  isEmailComplete,
  isProviderComplete,
} from '@/lib/siteLegal';

import { metadataForPage } from '@/app/seoMetadata';

export const metadata: Metadata = metadataForPage('/impressum/');

/**
 * app/impressum/page.tsx — die Anbieterkennzeichnung nach § 5 DDG.
 *
 * Die sichtbaren Zitate wurden am 2026-10-16 auf den geltenden Normstand
 * umgestellt: § 5 DDG (Anbieterkennzeichnung, Nachfolger von § 5 TMG) und
 * § 18 Abs. 2 MStV (Inhaltsverantwortung, Nachfolger von § 55 Abs. 2 RStV).
 * Die Meta-Beschreibung nannte den § 5 DDG schon, während die sichtbare
 * Überschrift noch das TMG nannte — eine Seite, die zwei Normen nennt, ist
 * eine Seite, die eine Norm zitiert, die es nicht mehr gibt.
 *
 * Die Pflichtangaben hängen an der Rechtsform (`lib/siteLegal.ts`): Name,
 * ladungsfähige Anschrift, E-Mail und verantwortliche Person immer; bei
 * einem Unternehmen zusätzlich Vertretungsberechtigte und Registerangaben.
 * Telefon und USt-IdNr. sind freiwillig und erscheinen nur, wenn sie
 * angegeben sind.
 *
 * Solange Angaben fehlen, zeigt die Seite ihre Aufforderungstexte statt einer
 * halben Anschrift. Das ist Absicht: Ein halb ausgefülltes Impressum sieht
 * vollständig aus und wird deshalb nicht nachgeprüft. Der Deploy-Wächter
 * meldet denselben Zustand an der Stelle, an der er riskant wird.
 */
export default function ImpressumPage() {
  const legal = SITE_LEGAL;
  const providerComplete = isProviderComplete(legal);
  const emailComplete = isEmailComplete(legal);
  const responsibleComplete = isContentResponsibleComplete(legal);
  const company = isCompany(legal);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <PageStructuredData path="/impressum/" />
      <SiteHeader />
      <main id="main" className="container-page prose-measure flex-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Impressum</h1>
        <p className="caption-sm mt-2 text-ink-soft">Angaben gemäß § 5 DDG.</p>

        <section className="mt-8 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Anbieter</h2>
          {providerComplete ? (
            <>
              <p>{legal.providerName}</p>
              <p>{legal.street}</p>
              <p>{legal.postalCodeAndCity}</p>
              <p>Deutschland</p>
            </>
          ) : (
            <>
              {/* Solange die Angaben fehlen, steht hier die Aufforderung an den
                  Betreiber. Dieser Zweig ist Teil der eingefrorenen Baseline
                  (`tests/e2e/visual.spec.ts-snapshots/route-impressum-*.png`) —
                  er wurde am 2026-10-16 mit dem Normwechsel (DDG/MStV) neu
                  gezogen; wer den Text ändert, verschiebt das visuelle Gate
                  und braucht UI-Freigabe. */}
              <p>Werft — Projekt-Placeholder</p>
              <p>Bitte hier den Namen und die Anschrift des Betreibers eintragen.</p>
            </>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt</h2>
          {emailComplete ? (
            <>
              <p>E-Mail: {legal.email}</p>
              {hasPhone(legal) && <p>Telefon: {legal.phone}</p>}
            </>
          ) : (
            <p>E-Mail-Adresse noch nicht eingetragen.</p>
          )}
        </section>

        {company && (
          <section className="mt-6 space-y-2 text-sm text-ink-soft">
            <h2 className="text-base font-semibold text-ink">Vertretung und Register</h2>
            <p>Vertreten durch: {legal.representative}</p>
            <p>Registergericht: {legal.registerCourt}</p>
            <p>Registernummer: {legal.registerNumber}</p>
          </section>
        )}

        {hasVatId(legal) && (
          <section className="mt-6 space-y-2 text-sm text-ink-soft">
            <h2 className="text-base font-semibold text-ink">Umsatzsteuer-Identifikationsnummer</h2>
            <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {legal.vatId}</p>
          </section>
        )}

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
            Werft ist ein Planungswerkzeug für den Camper-Ausbau. Berechnungen (Heizlast, Kabelquerschnitt,
            Solarleistung) sind Näherungen und ersetzen keine Elektrofachkraft. Für Landstrom-Anlagen ist eine
            Prüfung durch qualifiziertes Personal nach DIN VDE 0100-721 Pflicht.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
