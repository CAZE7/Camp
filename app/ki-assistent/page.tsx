import Chat from '@/components/Chat';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

export const metadata = {
  title: 'KI-Assistent — Werft',
};

export default function KiAssistent() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main id="main" className="relative flex-1">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            KI-Assistent
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Antworten zu Normen, Kabelquerschnitt und typischen Fehlern im
            Camper-Ausbau. Der Chat öffnet unten links.
          </p>
          <div className="warn-card warn-card-info mt-6">
            <span aria-hidden="true" className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn-info text-paper text-xs font-bold">i</span>
            <p className="text-sm leading-relaxed">
              <strong>Hinweis:</strong> Der Assistent gibt Orientierung, aber keine Elektrofreigabe. Für Landstrom-Anlagen (230 V) ist eine Prüfung durch eine Elektrofachkraft nach DIN VDE 0100-721 Pflicht.
            </p>
          </div>
        </div>
        <Chat defaultOpen />
      </main>
      <SiteFooter />
    </div>
  );
}
