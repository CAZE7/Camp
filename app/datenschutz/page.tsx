import type { Metadata } from 'next';
import Link from 'next/link';

import { metadataForPage } from '@/app/seoMetadata';
import { PageShell } from '@/components/brand/PageShell';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
import {
  APP_PREFERENCES_STORAGE_KEY,
  LEGACY_APP_PREFERENCES_STORAGE_KEY,
  LEGACY_PLANNER_STORAGE_KEY,
  PLANNER_STORAGE_KEY,
} from '@/lib/storageKeys';
import { SITE_LEGAL } from '@/lib/siteLegal';

export const metadata: Metadata = metadataForPage('/datenschutz/');

/**
 * Datenschutzerklärung — Art. 13 DSGVO, für das, was diese Seite WIRKLICH tut.
 *
 * Warum die Seite neu geschrieben wurde (2026-10-28): Sie war bis dahin eine
 * Kurzfassung mit 134 Wörtern und dem sichtbaren Satz „bitte den finalen Text
 * mit einer Rechtsberatung abgleichen" — also eine Notiz an den Betreiber, die
 * im Internet stand. Art. 13 DSGVO verlangt konkrete Angaben: Verantwortlicher,
 * Zwecke, Rechtsgrundlagen, Empfänger, Speicherdauer, Rechte und den Weg zur
 * Aufsichtsbehörde.
 *
 * Grundsatz dieser Fassung: Jeder Satz ist am Baum prüfbar.
 *   - „keine Cookies, keine Analyse" — es gibt weder `document.cookie` noch
 *     einen Analyse-Client (`grep` über `app/`, `components/`, `lib/`).
 *   - „keine externen Verbindungen" — alle Schriften liegen im Export
 *     (`@fontsource`), die Content-Security-Policy erlaubt `connect-src` nur
 *     auf die eigene Herkunft, und der KI-Assistent ist am 2026-10-28 entfernt
 *     (ADR 0021).
 *   - Die genannten Speicherschlüssel stehen in `lib/storageKeys.ts` und werden
 *     von dort importiert, nicht abgeschrieben: Ändert sich ein Schlüssel, ist
 *     diese Seite falsch, und der Fehler fällt beim nächsten Lesen des Codes auf
 *     — nicht erst beim Nutzer.
 *   - Anbieterangaben kommen aus `lib/siteLegal.ts` (dieselbe Quelle wie das
 *     Impressum), damit hier kein zweiter Name gepflegt wird.
 *
 * Was diese Seite NICHT tut: eine Rechtsberatung ersetzen. Der Text beschreibt
 * den technischen Stand; die rechtliche Bewertung bleibt beim Betreiber.
 */

/** Stand der Erklärung — bei inhaltlichen Änderungen mitziehen. */
const STAND = '28.10.2026';

const ABSCHNITTE = [
  { id: 'verantwortlich', titel: 'Wer verantwortlich ist' },
  { id: 'kurzfassung', titel: 'Das Wichtigste in drei Sätzen' },
  { id: 'hosting', titel: 'Hosting und Server-Logs' },
  { id: 'speicherung', titel: 'Was im Browser gespeichert wird' },
  { id: 'keine-verfolgung', titel: 'Was diese Seite nicht tut' },
  { id: 'kontakt', titel: 'Wenn du eine E-Mail schreibst' },
  { id: 'dauer', titel: 'Wie lange Daten bleiben' },
  { id: 'rechte', titel: 'Deine Rechte' },
  { id: 'beschwerde', titel: 'Beschwerderecht' },
  { id: 'aenderungen', titel: 'Änderungen dieser Erklärung' },
] as const;

export default function DatenschutzPage() {
  return (
    <>
      <PageStructuredData path="/datenschutz/" />
      <PageShell variant="article" mainClassName="container-page prose-measure">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Datenschutz</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Diese Erklärung gilt für <strong className="text-ink">elektroplaner-camper.de</strong> und
          beschreibt, welche Daten beim Besuch und bei der Nutzung des Planers anfallen. Stand: {STAND}.
        </p>

        <nav aria-labelledby="inhalt-titel" className="mt-6 border border-rule bg-bone p-4">
          <p id="inhalt-titel" className="kicker text-ink-soft">
            Auf dieser Seite
          </p>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {ABSCHNITTE.map((abschnitt, index) => (
              <li key={abschnitt.id}>
                <a
                  href={`#${abschnitt.id}`}
                  className="inline-flex min-h-9 items-center text-ink-soft hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                >
                  <span aria-hidden="true" className="mr-2 font-mono text-xs text-copper">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {abschnitt.titel}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <section id="verantwortlich" className="mt-10 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">1. Wer verantwortlich ist</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Verantwortlich für die Datenverarbeitung auf dieser Seite ist:
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {SITE_LEGAL.providerName}
            <br />
            {SITE_LEGAL.street}
            <br />
            {SITE_LEGAL.postalCodeAndCity}
            <br />
            E-Mail:{' '}
            <a
              href={`mailto:${SITE_LEGAL.email}`}
              className="font-medium text-copper underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
            >
              {SITE_LEGAL.email}
            </a>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Ein Datenschutzbeauftragter ist nicht bestellt; die gesetzlichen Voraussetzungen dafür (Art. 37
            DSGVO, § 38 BDSG) liegen bei diesem Angebot nicht vor. Die vollständige Anbieterkennzeichnung
            steht im <Link href="/impressum/">Impressum</Link>.
          </p>
        </section>

        <section id="kurzfassung" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">2. Das Wichtigste in drei Sätzen</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
            <li>
              Es gibt <strong className="text-ink">kein Konto, keine Anmeldung und keinen Server</strong>, auf
              dem deine Pläne liegen: Alles, was du eingibst, bleibt im Speicher deines Browsers.
            </li>
            <li>
              Diese Seite setzt <strong className="text-ink">keine Cookies</strong>, verwendet keine Analyse-
              oder Werbedienste und lädt keine Inhalte von fremden Servern — auch die Schriften kommen aus der
              Auslieferung selbst.
            </li>
            <li>
              Die einzigen Daten, die dein Gerät verlassen, sind die technisch notwendigen Verbindungsdaten
              beim Abruf der Seite (IP-Adresse im Server-Log des Hosters) und das, was du selbst in einer
              E-Mail schreibst.
            </li>
          </ul>
        </section>

        <section id="hosting" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">3. Hosting und Server-Logs</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Die Seite wird als statische Dateisammlung über <strong className="text-ink">GitHub Pages</strong>{' '}
            ausgeliefert (Anbieter: GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA).
            Beim Abruf einer Seite verarbeitet der Hoster technisch notwendige Verbindungsdaten — insbesondere
            deine IP-Adresse, Datum und Uhrzeit, die abgerufene Adresse, die übertragene Datenmenge, den
            Referrer sowie Browser- und Betriebssystemkennung. Diese Verarbeitung ist für die Auslieferung der
            Seite erforderlich; Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und
            stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Wir haben auf diese Logs keinen Zugriff und werten sie nicht aus. Da der Anbieter in den USA
            sitzt, können Daten in ein Drittland übertragen werden. Wie GitHub dabei Daten verarbeitet und auf
            welche Garantien sich die Übermittlung stützt, steht in der{' '}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
              rel="noopener noreferrer external"
              className="font-medium text-copper underline-offset-4 hover:underline"
            >
              Datenschutzerklärung von GitHub
            </a>
            .
          </p>
        </section>

        <section id="speicherung" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">4. Was im Browser gespeichert wird</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Der Planer speichert seinen Zustand im <code>localStorage</code> deines Browsers. Diese Daten
            verlassen dein Gerät nicht und sind für uns nicht lesbar. Es werden ausschließlich die folgenden
            Schlüssel verwendet (Quelle: <code>lib/storageKeys.ts</code>):
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-ink-soft">
              <caption className="sr-only">
                Im Browser gespeicherte Schlüssel, ihr Zweck und ihre Herkunft
              </caption>
              <thead>
                <tr className="border-b border-rule-strong text-ink">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Schlüssel
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Inhalt und Zweck
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-rule">
                  <td className="py-2 pr-4 font-mono text-xs">{PLANNER_STORAGE_KEY}</td>
                  <td className="py-2">
                    Dein Schaltplan (Bauteile, Leitungen, errechnete Querschnitte) — damit er einen Neustart
                    überlebt.
                  </td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="py-2 pr-4 font-mono text-xs">{APP_PREFERENCES_STORAGE_KEY}</td>
                  <td className="py-2">
                    Anzeigeeinstellungen wie Theme und Raster — damit die Seite so aussieht, wie du sie
                    eingestellt hast.
                  </td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="py-2 pr-4 font-mono text-xs">{LEGACY_PLANNER_STORAGE_KEY}</td>
                  <td className="py-2">
                    Übernommener Stand aus dem früheren Produktnamen. Wird nur gelesen, um alte Pläne nicht zu
                    verlieren, und beim ersten Speichern auf den aktuellen Schlüssel umgezogen.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">{LEGACY_APP_PREFERENCES_STORAGE_KEY}</td>
                  <td className="py-2">Dasselbe für die Anzeigeeinstellungen des früheren Namens.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Diese Speicherung ist <strong className="text-ink">unbedingt erforderlich</strong>, damit die von
            dir aufgerufene Funktion — ein Plan, der bleibt — überhaupt bereitgestellt werden kann. Sie ist
            deshalb nach § 25 Abs. 2 Nr. 2 TDDDG ohne Einwilligung zulässig; Rechtsgrundlage der Verarbeitung
            ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der Funktion, die du nutzt).
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Löschen kannst du die Daten jederzeit selbst: über „Clear site data“ in den Entwicklerwerkzeugen
            deines Browsers, über die Einstellungen für Websitedaten oder indem du den Plan im Planer
            zurücksetzt. Ein geteilter Link trägt den Plan im Adressfragment (<code>#plan=…</code>). Ein
            Fragment überträgt der Browser nicht an den Server; er wertet es selbst aus.
          </p>
        </section>

        <section id="keine-verfolgung" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">5. Was diese Seite nicht tut</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
            <li>
              <strong className="text-ink">Keine Cookies</strong> — weder eigene noch die von Dritten. Es gibt
              deshalb auch kein Cookie-Banner.
            </li>
            <li>
              <strong className="text-ink">Keine Reichweitenmessung</strong> — kein Google Analytics, kein
              Matomo, keine Pixel, keine A/B-Test-Dienste.
            </li>
            <li>
              <strong className="text-ink">Keine Werbung und kein Profiling</strong> — es werden keine
              Nutzungsprofile gebildet.
            </li>
            <li>
              <strong className="text-ink">Keine fremden Server</strong> — Schriften, Symbole und Bilder
              liegen in der Auslieferung; es gibt kein Content-Delivery-Netzwerk, keine Karten, keine Embeds
              von YouTube, Twitter oder Ähnlichem.
            </li>
            <li>
              <strong className="text-ink">Keine Chat-Schnittstelle</strong> — der frühere Assistent ist
              entfernt (ADR 0021). Die Seite sendet keine Eingaben an ein Sprachmodell.
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Verweise zu anderen Seiten (etwa in den Leitfäden oder in dieser Erklärung) führen dich erst dann
            zu einem anderen Anbieter, wenn du sie anklickst. Ab diesem Moment gilt dessen
            Datenschutzerklärung.
          </p>
        </section>

        <section id="kontakt" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">6. Wenn du eine E-Mail schreibst</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Schreibst du an {SITE_LEGAL.email}, verarbeiten wir deine Adresse, den Inhalt der Nachricht und
            die Zeitpunkte, um zu antworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO bei Fragen zur
            Nutzung und Art. 6 Abs. 1 lit. f DSGVO bei allgemeinen Anfragen (Interesse an einer Antwort). Die
            Nachricht wird gelöscht, sobald sie erledigt ist und keine gesetzlichen Aufbewahrungsfristen
            entgegenstehen.
          </p>
        </section>

        <section id="dauer" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">7. Wie lange Daten bleiben</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
            <li>
              <strong className="text-ink">Server-Logs des Hosters:</strong> kurzlebig; die Dauer bestimmt
              GitHub. Wir erhalten keine Kopie.
            </li>
            <li>
              <strong className="text-ink">Daten im Browser:</strong> so lange, bis du sie löschst. Ohne dein
              Zutun verschwinden sie nicht.
            </li>
            <li>
              <strong className="text-ink">E-Mail-Korrespondenz:</strong> bis zur Erledigung, danach Löschung
              — soweit keine Aufbewahrungspflicht greift.
            </li>
          </ul>
        </section>

        <section id="rechte" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">8. Deine Rechte</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Du hast nach der DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art.
            17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
            gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine erteilte Einwilligung
            kannst du jederzeit widerrufen (Art. 7 Abs. 3).
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Für alle diese Rechte genügt eine Nachricht an{' '}
            <a
              href={`mailto:${SITE_LEGAL.email}`}
              className="font-medium text-copper underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
            >
              {SITE_LEGAL.email}
            </a>
            . Eine Besonderheit dieser Anwendung: Deine Pläne liegen ausschließlich auf deinem Gerät — eine
            Auskunftsanfrage kann sich deshalb nur auf Daten beziehen, die uns tatsächlich erreicht haben.
          </p>
        </section>

        <section id="beschwerde" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">9. Beschwerderecht</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Unabhängig davon kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).
            Für dieses Angebot zuständig ist:
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit
            <br />
            Ludwig-Erhard-Str. 22, 20459 Hamburg
            <br />
            Telefon: 040 428 54-4040 · E-Mail: mailbox@datenschutz.hamburg.de
            <br />
            <a
              href="https://datenschutz-hamburg.de"
              rel="noopener noreferrer external"
              className="font-medium text-copper underline-offset-4 hover:underline"
            >
              datenschutz-hamburg.de
            </a>
          </p>
        </section>

        <section id="aenderungen" className="mt-8 scroll-mt-20">
          <h2 className="text-base font-semibold text-ink">10. Änderungen dieser Erklärung</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Diese Erklärung beschreibt den technischen Stand vom {STAND}. Ändert sich die Anwendung — etwa
            durch einen neuen Dienst — wird sie vorher angepasst. Die frühere Fassung war eine Kurzfassung,
            die nur die lokale Speicherung nannte.
          </p>
        </section>
      </PageShell>
    </>
  );
}
