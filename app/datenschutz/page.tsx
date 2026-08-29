import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

export const metadata = {
  title: 'Datenschutz — Werft',
};

export default function DatenschutzPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Datenschutz</h1>
        <p className="caption-sm mt-2 text-ink-soft">
          Kurzfassung – bitte den finalen Text mit einer Rechtsberatung abgleichen.
        </p>

        <section className="mt-8 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Lokale Speicherung</h2>
          <p>
            Werft speichert Konfigurationen (z. B. Dach-Layout, Ausbau-Status) im Browser (LocalStorage).
            Diese Daten verlassen dein Gerät nicht.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt & Rechte</h2>
          <p>Auskunfts-, Korrektur- und Löschanfragen richtest du an die im Impressum genannte Adresse.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
