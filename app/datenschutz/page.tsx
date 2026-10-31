import type { Metadata } from 'next';
import Link from 'next/link';

import { metadataForPage } from '@/app/seoMetadata';

import { PageShell } from '@/components/brand/PageShell';
import { PageStructuredData } from '@/components/seo/PageStructuredData';

export const metadata: Metadata = metadataForPage('/datenschutz/');

export default function DatenschutzPage() {
  return (
    <>
      <PageStructuredData path="/datenschutz/" />
      <PageShell variant="article" mainClassName="container-page prose-measure">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Datenschutz</h1>
        <p className="caption-sm mt-2 text-ink-soft">
          Stand: 2026-10. Diese Erklärung beschreibt die Datenverarbeitung beim Besuch von
          elektroplaner-camper.de.
        </p>

        <section className="mt-8 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Verantwortlicher</h2>
          <p>
            Verantwortlich für die Datenverarbeitung ist der im{' '}
            <Link href="/impressum/" className="underline underline-offset-2 hover:text-ink">
              Impressum
            </Link>{' '}
            genannte Betreiber. Dort stehen auch Anschrift und Kontaktweg.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Hosting und Server-Logfiles</h2>
          <p>
            Die Seite wird als statischer Export über GitHub Pages ausgeliefert. Anbieter ist GitHub, Inc., 88
            Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA, ein Unternehmen der Microsoft-Gruppe.
          </p>
          <p>
            Beim Abruf einer Seite verarbeitet GitHub technisch notwendige Verbindungsdaten. Dazu können
            IP-Adresse, Datum und Uhrzeit, angeforderte Datei, übertragene Datenmenge, Browserkennung
            (User-Agent) und die zuvor besuchte Seite gehören. GitHub verarbeitet diese Daten auch zur
            Sicherheit und Stabilität des Dienstes. Rechtsgrundlage ist unser berechtigtes Interesse an der
            sicheren Auslieferung der Seite (Art. 6 Abs. 1 lit. f DSGVO).
          </p>
          <p>
            GitHub verarbeitet Daten auch außerhalb der EU. Nach eigenen Angaben stützt sich GitHub für
            Übermittlungen auf das EU-US Data Privacy Framework und auf Standardvertragsklauseln. Details
            stehen im{' '}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
              className="underline underline-offset-2 hover:text-ink"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub Privacy Statement
            </a>
            .
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Lokale Speicherung im Browser</h2>
          <p>
            Der Elektroplaner speichert Konfigurationen wie Schaltplan, Dachlayout oder Ausbau-Status im
            localStorage deines Browsers. Diese Daten bleiben auf deinem Gerät und werden nicht an einen
            Server übertragen. Die Speicherung ist für die Funktion des Planers erforderlich (§ 25 Abs. 2
            TDDDG). Du kannst sie jederzeit über die Einstellungen deines Browsers löschen; damit werden auch
            die gespeicherten Pläne entfernt.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">
            Keine Cookies, keine Analyse, keine externen Schriften
          </h2>
          <p>
            Die Seite setzt keine Cookies zu Analyse- oder Marketingzwecken und verwendet kein Web-Tracking.
            Die verwendeten Schriften werden mit der Seite ausgeliefert; es werden keine Schriftarten von
            Google oder anderen Dritten geladen.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Camper-Assistent</h2>
          <p>
            Der Camper-Assistent ist in der aktuellen Auslieferung nicht aktiv. Es gibt kein Eingabefeld und
            es werden keine Chat-Nachrichten an einen Server gesendet. Sollte künftig ein externer Assistent
            konfiguriert werden, wird diese Erklärung vorher um die dann geltenden Datenflüsse ergänzt.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Kontakt per E-Mail</h2>
          <p>
            Wenn du per E-Mail Kontakt aufnimmst, verarbeiten wir deine E-Mail-Adresse und den Inhalt der
            Nachricht, um die Anfrage zu bearbeiten. Rechtsgrundlage ist die Bearbeitung deiner Anfrage (Art.
            6 Abs. 1 lit. b DSGVO) beziehungsweise unser berechtigtes Interesse an der Beantwortung (Art. 6
            Abs. 1 lit. f DSGVO). Die Daten werden gelöscht, sobald die Anfrage abschließend bearbeitet ist
            und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Deine Rechte</h2>
          <p>
            Du hast nach der DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art.
            17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
            (Art. 21). Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77
            DSGVO). Zuständig ist die Behörde deines Wohnsitzes oder die für den Verantwortlichen zuständige
            Behörde.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Keine automatisierte Entscheidungsfindung</h2>
          <p>Es findet keine automatisierte Entscheidungsfindung mit rechtlicher Wirkung statt.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-ink-soft">
          <h2 className="text-base font-semibold text-ink">Änderungen</h2>
          <p>
            Diese Erklärung wird angepasst, wenn sich die Datenverarbeitung ändert. Der Stand steht oben auf
            dieser Seite.
          </p>
        </section>
      </PageShell>
    </>
  );
}
