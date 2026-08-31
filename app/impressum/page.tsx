import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

export const metadata = {
  title: 'Impressum — Werft',
};

export default function ImpressumPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Impressum</h1>
        <p className="caption-sm mt-2 text-ink-soft">Angaben gemäß § 5 TMG.</p>

        <section className="mt-8 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Anbieter</h2>
          <p>Werft — Projekt-Placeholder</p>
          <p>Bitte hier den Namen und die Anschrift des Betreibers eintragen.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt</h2>
          <p>E-Mail: kontakt@example.org</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Verantwortlich für den Inhalt</h2>
          <p>Nach § 55 Abs. 2 RStV: Bitte hier eintragen.</p>
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
