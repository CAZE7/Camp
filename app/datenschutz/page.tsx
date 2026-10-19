import type { Metadata } from 'next';
import Link from 'next/link';

import { metadataForPage } from '@/app/seoMetadata';

import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
import { SITE_LEGAL, isEmailComplete, isProviderComplete } from '@/lib/siteLegal';

export const metadata: Metadata = metadataForPage('/datenschutz/');

/**
 * app/datenschutz/page.tsx — die Verarbeitungshinweise der Seite.
 *
 * Zwei Punkte, die am 2026-10-16 ergänzt wurden, weil sie vorher fehlten und
 * die Seite damit unvollständig war:
 *
 *   1. Die Seite bindet Google Analytics 4 ein (`gtag.js` im Wurzel-Layout).
 *      Ein Reichweitenmesswerkzeug, das in der Erklärung nicht vorkommt, ist
 *      eine Erklärung, die etwas verschweigt — und genau dort entstehen die
 *      Abmahnungen. Was der Code tut, steht hier; die Konfiguration der
 *      Google-Eigenschaft (Einwilligung, IP-Anonymisierung, Aufbewahrung)
 *      liegt beim Betreiber und ist als offener Punkt benannt.
 *   2. Der Kontaktweg nennt den Anbieter, sobald die Impressumsangaben
 *      eingetragen sind — statt dauerhaft auf ein Impressum zu verweisen, das
 *      noch Platzhalter trägt.
 *
 * Der Text ist bewusst eine Kurzfassung; die verbindliche Fassung ist mit
 * einer Rechtsberatung abzugleichen (Hinweis unter der Überschrift).
 */
export default function DatenschutzPage() {
  const legal = SITE_LEGAL;
  const providerNamed = isProviderComplete(legal);
  const emailComplete = isEmailComplete(legal);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <PageStructuredData path="/datenschutz/" />
      <SiteHeader />
      <main id="main" className="container-page prose-measure flex-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Datenschutz</h1>
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
          <h2 className="text-base font-semibold text-ink">Reichweitenmessung</h2>
          <p>
            Diese Seite bindet Google Analytics 4 ein (gtag.js, Mess-ID G-Q7E3XL4T34). Beim Aufruf der Seite
            wird ein Aufruf an Google gesendet; dabei werden unter anderem IP-Adresse, Browser- und
            Geräteangaben, Bildschirmauflösung, Sprache, verweisende Seite und der Zeitpunkt des Aufrufs an
            Google übertragen. Die geplanten Schaltpläne, die Dachbelegung und deine Eingaben in den Rechnern
            werden nicht übertragen — sie bleiben im Browser.
          </p>
          <p>
            Einwilligungs-Banner, IP-Anonymisierung und Aufbewahrungsfristen sind Eigenschaften der
            Google-Analytics-Verwaltung und vor dem Produktivbetrieb zu prüfen. Die Einzelheiten der
            Verarbeitung durch Google stehen in der Datenschutzerklärung von Google.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Camper-Assistent</h2>
          <p>
            Der Assistent (Ansicht „Camper-Assistent" in der Navigation) arbeitet ohne Anmeldung. Ist ein
            externer Assistenten-Endpunkt konfiguriert, wird deine Frage dorthin übertragen und die Antwort
            dort erzeugt; ohne diese Konfiguration antwortet die Seite lokal ohne Chat. Welcher Endpunkt aktiv
            ist, steht in der Kopfzeile des Assistenten.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt & Rechte</h2>
          {providerNamed ? (
            <>
              <p>
                Auskunfts-, Korrektur- und Löschanfragen richtest du an{' '}
                <strong className="font-medium text-ink">{legal.providerName}</strong>.
              </p>
              {emailComplete && <p>E-Mail: {legal.email}</p>}
            </>
          ) : (
            <p>
              Auskunfts-, Korrektur- und Löschanfragen richtest du an den Anbieter, der im{' '}
              <Link href="/impressum/">Impressum</Link> genannt ist.
            </p>
          )}
          <p>
            Die vollständige Anschrift steht im <Link href="/impressum/">Impressum</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
