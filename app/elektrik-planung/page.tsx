import type { Metadata } from 'next';
import Link from 'next/link';

import { metadataForPage } from '@/app/seoMetadata';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';

/**
 * app/elektrik-planung/page.tsx — der Übergang nach dem Umzug.
 *
 * Der Inhalt dieser Seite (Kabelquerschnitt-Rechner, Normgrundlagen,
 * Absicherung, Fragen) ist nach `/camper-elektrik/` gewandert. Die alte
 * Adresse bleibt als kurzer Stub stehen, damit alte Verlinkungen und
 * gespeicherte Adressen nicht ins Leere führen.
 *
 * Was der Stub leistet — und was nicht:
 *
 *  - `noindex, follow`: Die Seite wird nicht als eigenes Ergebnis
 *    geführt, aber die Linkkraft der alten Adresse geht auf das Ziel.
 *  - Canonical auf `/camper-elektrik/`: Maschinenlesbar der ausdrückliche
 *    Hinweis, dass es hier nicht mehr um Inhalt geht.
 *  - Meta-Refresh dorthin: Der sichtbare Weg für Besucher, die die alte
 *    Adresse noch offen haben. React 19 hebt das `<meta>` in den Kopf.
 *  - EIN sichtbarer Verweis: Der Text bleibt ohne JavaScript lesbar und
 *    nutzbar — der Meta-Refresh ist nur die Automatik dahinter.
 *
 * Eine dauerhafte Umleitung (301) kann der statische Export nicht liefern;
 * sie wird in der Auslieferung eingerichtet. Anleitung:
 * `docs/seo/umzug-elektrik-planung.md`.
 */
export const metadata: Metadata = metadataForPage('/elektrik-planung/');

export default function ElektrikPlanungStub() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* React 19 hebt das Element in den Dokumentkopf. */}
      <meta httpEquiv="refresh" content="0; url=/camper-elektrik/" />

      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="container-page py-16">
          <p className="label-eyebrow text-copper">Umgezogen</p>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
            Diese Seite ist umgezogen
          </h1>
          <p className="mt-4 max-w-3xl text-md leading-relaxed text-ink-soft">
            Der Kabelquerschnitt-Rechner, die Normgrundlagen und die Absicherung stehen jetzt auf
            „Camper-Elektrik planen“. Diese Adresse bleibt für alte Verlinkungen stehen und verweist dorthin
            weiter.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/camper-elektrik/"
              className="inline-flex min-h-11 items-center bg-oxide px-4 py-2 text-sm font-medium text-on-signal transition-colors hover:bg-oxide/90"
            >
              Zur neuen Seite
            </Link>
            <Link
              href="/planer/"
              className="inline-flex min-h-11 items-center border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
            >
              Camper-Elektroplaner öffnen
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
