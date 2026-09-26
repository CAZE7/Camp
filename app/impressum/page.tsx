import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
// AUDIT „Impressum-Placeholder": Die Angaben stehen in `lib/siteLegal.ts` —
// eine Stelle zum Ausfüllen, eine maschinell prüfbare Vollständigkeit
// (`npm run ci:verify-legal-notice`, Schritt im Deploy-Workflow).
import { SITE_LEGAL, isPlaceholderText, isProviderComplete } from '@/lib/siteLegal';

export const metadata = {
  title: 'Impressum — Werft',
};

export default function ImpressumPage() {
  const legal = SITE_LEGAL;
  const providerComplete = isProviderComplete(legal);
  const emailComplete = !isPlaceholderText(legal.email);
  const responsibleComplete = !isPlaceholderText(legal.contentResponsible);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main id="main" className="container-page prose-measure flex-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Impressum</h1>
        <p className="caption-sm mt-2 text-ink-soft">Angaben gemäß § 5 TMG.</p>

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
              <p>Werft — Projekt-Placeholder</p>
              <p>Bitte hier den Namen und die Anschrift des Betreibers eintragen.</p>
            </>
          )}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt</h2>
          {emailComplete ? <p>E-Mail: {legal.email}</p> : <p>E-Mail: kontakt@example.org</p>}
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Verantwortlich für den Inhalt</h2>
          {responsibleComplete ? (
            <p>Nach § 55 Abs. 2 RStV: {legal.contentResponsible}</p>
          ) : (
            <p>Nach § 55 Abs. 2 RStV: Bitte hier eintragen.</p>
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
