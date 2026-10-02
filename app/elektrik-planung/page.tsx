import type { Metadata } from 'next';
import Link from 'next/link';

import { FaqAkkordeon } from '@/components/elektrik/FaqAkkordeon';
import { KabelquerschnittRechner } from '@/components/elektrik/KabelquerschnittRechner';
import {
  APPLICATION_FEATURES,
  ELEKTRIK_FAQ,
  PAGE_DESCRIPTION,
  PAGE_LEAD,
  PAGE_TITLE,
} from '@/components/elektrik/electricContent';
import {
  ELEKTRIK_PLANUNG_PATH,
  buildElektrikPlanungJsonLd,
  serializeJsonLd,
} from '@/components/elektrik/structuredData';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';
import {
  FUSE_MAX_UNPROTECTED_LENGTH_M,
  FUSE_MAP,
  VDE_AMPACITY,
  VDE_SIZES,
  designAmpacity,
} from '@/lib/electrical';
import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from '@/lib/materials';
import { SITE_NAME, siteUrl } from '@/lib/site';
import { VDE_BATTERY_DOD } from '@/lib/vde-standards';
import Planner from '../../components/Planner';

/**
 * Seite „Elektrik-Planung".
 *
 * Zwei Aufgaben auf einer Adresse, in dieser Reihenfolge: zuerst die
 * Einzelfrage („welche Leitung, welche Sicherung?"), die als Rechner direkt
 * beantwortet wird, darunter die zeichnende Anwendung für die gesamte Anlage.
 * Die redaktionellen Abschnitte erklären die Rechenwege hinter dem Rechner —
 * sie sind Teil der Seite und keine Zierde: Ohne sie stünde der Rechner ohne
 * nachvollziehbare Herleitung da.
 *
 * Abschnittsführung: `main` → `section` mit eigener Überschrift und
 * `article` für die in sich abgeschlossenen Beiträge; Unterthemen sind `h3`.
 * `aria-labelledby` bindet jeden Abschnitt an seine Überschrift.
 */

const DOD_LABEL: Record<string, string> = {
  LiFePO4: 'LiFePO4',
  AGM: 'AGM',
  Gel: 'Gel',
  Blei: 'Nassblei',
};

const NORMEN: readonly { norm: string; bereich: string }[] = [
  {
    norm: 'DIN VDE 0298-4',
    bereich: 'Strombelastbarkeit von Leitungen (Verlegeart B2, 30 °C, 2 belastete Adern)',
  },
  {
    norm: 'DIN VDE 0100-430',
    bereich: 'Schutz bei Überstrom: Koordination von Betriebsstrom, Sicherung und Leitungsbelastbarkeit',
  },
  {
    norm: 'DIN VDE 0100-520',
    bereich: 'Auswahl und Errichtung elektrischer Betriebsmittel, Spannungsfall',
  },
  {
    norm: 'DIN VDE 0100-721',
    bereich: 'Kleinspannungsanlagen in Caravans und Motorcaravans — 12 V und 230 V im Fahrzeug',
  },
  {
    norm: 'ISO 10133 / ABYC E-11',
    bereich: 'Schutzorgan am Quellpunkt bei Kleinspannungs-Gleichstromanlagen',
  },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: siteUrl(ELEKTRIK_PLANUNG_PATH),
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: SITE_NAME,
    url: siteUrl(ELEKTRIK_PLANUNG_PATH),
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: siteUrl('/og/elektrik-planung.png'),
        width: 1200,
        height: 630,
        alt: 'Werft — Camper-Elektrik berechnen und 12-V-Anlage sicher dimensionieren',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [siteUrl('/og/elektrik-planung.png')],
  },
};

export default function ElektrikPlanung() {
  const jsonLd = buildElektrikPlanungJsonLd();

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="container-page space-y-16">
          <section aria-labelledby="seite-titel">
            <p className="label-eyebrow text-copper">Elektroplanung</p>
            <h1 id="seite-titel" className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
              Camper-Elektrik berechnen
            </h1>
            <p className="mt-4 max-w-3xl text-md leading-relaxed text-ink-soft">{PAGE_LEAD}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="#rechner">Zum Rechner</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#planer">Schaltplan zeichnen</Link>
              </Button>
            </div>
            <ul className="mt-8 grid gap-x-8 gap-y-2 text-base text-ink-soft md:grid-cols-2">
              {APPLICATION_FEATURES.map((feature) => (
                <li key={feature} className="border-t border-rule pt-2">
                  {feature}
                </li>
              ))}
            </ul>
          </section>

          <section id="rechner" aria-labelledby="rechner-titel" className="scroll-mt-20">
            <h2 id="rechner-titel" className="font-display text-xl font-semibold text-ink">
              Kabelquerschnitt und Absicherung berechnen
            </h2>
            <p className="mt-2 max-w-3xl text-md text-ink-soft">
              Der Rechner dimensioniert eine 12-V-Leitung nach Spannungsfall und Strombelastbarkeit und nennt
              die Sicherung, die am Batteriepol sitzt. Das Ergebnis ist immer eine Normgröße aus der Reihe 1,5
              bis 70 mm².
            </p>
            <div className="mt-6">
              <KabelquerschnittRechner />
            </div>
            <p className="mt-3 text-base text-ink-soft">
              Gerechnet wird mit 3 % zulässigem Spannungsfall, κ = {COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²)
              für Kupfer und einem Derating von 0,7 auf die Tabellenwerte der DIN VDE 0298-4. Herleitung und
              Grenzwerte stehen im Abschnitt{' '}
              <Link href="#grundlagen" className="underline hover:text-ink">
                physikalische Grundlagen
              </Link>
              .
            </p>
          </section>

          <section id="grundlagen" aria-labelledby="grundlagen-titel" className="scroll-mt-20">
            <h2 id="grundlagen-titel" className="font-display text-xl font-semibold text-ink">
              Physikalische Grundlagen
            </h2>

            <article aria-labelledby="formel-titel" className="mt-6 max-w-3xl">
              <h3 id="formel-titel" className="text-lg font-semibold text-ink">
                Leitungsquerschnitt über den Spannungsfall
              </h3>
              <p className="mt-2 text-md leading-relaxed text-ink-soft">
                Jede Leitung hat einen Widerstand. Bei Hin- und Rückleitung fällt über beiden Leitern Spannung
                ab — das ist der Spannungsfall ΔU. Der Widerstand sinkt mit größerem Querschnitt, deshalb
                ergibt sich der kleinste zulässige Querschnitt, indem die Formel nach A aufgelöst wird:
              </p>
              <figure className="mt-4 border border-rule bg-bone px-5 py-4">
                <p className="font-mono text-md text-ink">A = (2 · L · I) / (κ · ΔU)</p>
                <figcaption className="mt-2 text-base text-ink-soft">
                  Kleinster Leitungsquerschnitt, damit bei Strom I über die Länge L höchstens ΔU abfällt.
                </figcaption>
              </figure>
              <dl className="mt-4 grid gap-x-8 gap-y-2 text-md md:grid-cols-2">
                <div className="border-t border-rule pt-2">
                  <dt className="font-mono text-ink">A</dt>
                  <dd className="text-ink-soft">Leitungsquerschnitt in mm²</dd>
                </div>
                <div className="border-t border-rule pt-2">
                  <dt className="font-mono text-ink">L</dt>
                  <dd className="text-ink-soft">
                    einfache Leitungslänge in Metern (der Faktor 2 steht für Hin- und Rückleitung)
                  </dd>
                </div>
                <div className="border-t border-rule pt-2">
                  <dt className="font-mono text-ink">I</dt>
                  <dd className="text-ink-soft">Betriebsstrom in Ampere</dd>
                </div>
                <div className="border-t border-rule pt-2">
                  <dt className="font-mono text-ink">κ</dt>
                  <dd className="text-ink-soft">
                    Leitfähigkeit des Leiters, für Kupfer {COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²) bei 20 °C
                  </dd>
                </div>
                <div className="border-t border-rule pt-2">
                  <dt className="font-mono text-ink">ΔU</dt>
                  <dd className="text-ink-soft">zulässiger Spannungsfall in Volt</dd>
                </div>
              </dl>
              <p className="mt-4 text-md leading-relaxed text-ink-soft">
                Für das 12-V-Bordnetz rechnet der Planer mit 3 % von 12 V, also 0,36 V. Für empfindliche
                Verbraucher — Kompressor-Kühlschrank, Funkgerät, Laderegler — ist die 2-%-Grenze die bessere
                Zielmarke; sie liegt bei 0,24 V und wird in Tabellenwerken häufig auf 0,25 V gerundet. Der
                Unterschied ist erheblich: 10 A über 5 m ergeben mit 3 % einen Querschnitt von 4,79 mm²
                (gewählt: 6 mm²), mit 2 % von 7,19 mm² (gewählt: 10 mm²).
              </p>
              <p className="mt-3 text-md leading-relaxed text-ink-soft">
                Zur Leitfähigkeit gibt es zwei gebräuchliche Zahlen: κ = 58 m/(Ω·mm²), der Kehrwert des
                spezifischen Widerstands ρ = 0,0175 Ω·mm²/m, und κ = 56 m/(Ω·mm²) in älteren Tabellen. Beide
                beschreiben dasselbe Kupfer bei 20 °C; mit 56 statt 58 wächst der gerechnete Querschnitt um
                rund 3,6 %. Der Planer rechnet mit 58 m/(Ω·mm²) und damit auf der knapperen Seite — wer auf
                Nummer sicher gehen will, wählt die nächstgrößere Normstufe.
              </p>
            </article>

            <article aria-labelledby="belastbarkeit-titel" className="mt-10 max-w-3xl">
              <h3 id="belastbarkeit-titel" className="text-lg font-semibold text-ink">
                Strombelastbarkeit der Normquerschnitte
              </h3>
              <p className="mt-2 text-md leading-relaxed text-ink-soft">
                Der Spannungsfall bestimmt nur, wie viel Spannung am Verbraucher ankommt. Zusätzlich muss der
                Leiter den Strom thermisch tragen. Die Tabelle nennt die Werte des Modells für Kupfer,
                Verlegeart B2, 30 °C und zwei belastete Adern — ohne Häufung mehrerer Leitungen.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-md">
                  <caption className="sr-only">
                    Strombelastbarkeit, Design-Belastbarkeit und größte Normsicherung je Querschnitt
                  </caption>
                  <thead>
                    <tr className="border-b border-rule-strong text-left">
                      <th scope="col" className="py-2 pr-4 font-medium text-ink">
                        Querschnitt
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium text-ink">
                        Belastbarkeit (Tabelle)
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium text-ink">
                        Design-Belastbarkeit (0,7 ×)
                      </th>
                      <th scope="col" className="py-2 font-medium text-ink">
                        Größte Sicherung
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-soft">
                    {VDE_SIZES.map((size) => (
                      <tr key={size} className="border-b border-rule">
                        <th scope="row" className="py-2 pr-4 font-mono font-normal text-ink">
                          {size.toFixed(1).replace('.', ',')} mm²
                        </th>
                        <td className="py-2 pr-4 font-mono">{VDE_AMPACITY[size] ?? '—'} A</td>
                        <td className="py-2 pr-4 font-mono">
                          {designAmpacity(size).toFixed(1).replace('.', ',')} A
                        </td>
                        <td className="py-2 font-mono">{FUSE_MAP[size] ?? '—'} A</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-base text-ink-soft">
                Die Design-Belastbarkeit ist der Tabellenwert mit dem Derating 0,7; sie deckt
                Umgebungstemperaturen über 30 °C und Bündelung pauschal ab. Die letzte Spalte ist die größte
                Sicherung, die den Leiter nach diesem Modell noch schützt — nicht die Sicherung, die zu einem
                Verbraucher passt.
              </p>
            </article>

            <article aria-labelledby="kapazitaet-titel" className="mt-10 max-w-3xl">
              <h3 id="kapazitaet-titel" className="text-lg font-semibold text-ink">
                Nutzbare Batteriekapazität
              </h3>
              <p className="mt-2 text-md leading-relaxed text-ink-soft">
                Die Nennkapazität einer Batterie ist nicht die Kapazität, die du entnehmen kannst. Nutzbar ist
                nur der Anteil bis zur zulässigen Entladetiefe (Depth of Discharge, DoD):
              </p>
              <figure className="mt-4 border border-rule bg-bone px-5 py-4">
                <p className="font-mono text-md text-ink">C_nutz = C_nenn · DoD</p>
                <figcaption className="mt-2 text-base text-ink-soft">
                  Nutzbare Kapazität als Produkt aus Nennkapazität und Entladetiefe.
                </figcaption>
              </figure>
              <dl className="mt-4 grid gap-x-8 gap-y-2 text-md md:grid-cols-2">
                {Object.entries(VDE_BATTERY_DOD).map(([chemie, dod]) => (
                  <div
                    key={chemie}
                    className="flex items-baseline justify-between gap-4 border-t border-rule pt-2"
                  >
                    <dt className="text-ink">{DOD_LABEL[chemie] ?? chemie}</dt>
                    <dd className="font-mono text-ink-soft">{Math.round(dod * 100)} %</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-md leading-relaxed text-ink-soft">
                Beispiel: Eine 100-Ah-LiFePO4-Batterie liefert 90 Ah, eine 100-Ah-AGM-Batterie dagegen nur 50
                Ah. Bei hohen Entladeströmen kommt der Peukert-Effekt hinzu — die entnehmbare Kapazität sinkt
                weiter, weil der Innenwiderstand mit dem Strom steigt. Der Planer rechnet ihn für die
                Batteriebilanz mit.
              </p>
            </article>
          </section>

          <section id="absicherung" aria-labelledby="absicherung-titel" className="scroll-mt-20">
            <h2 id="absicherung-titel" className="font-display text-xl font-semibold text-ink">
              Absicherung und Normen
            </h2>

            <article aria-labelledby="sicherung-titel" className="mt-6 max-w-3xl">
              <h3 id="sicherung-titel" className="text-lg font-semibold text-ink">
                Die Sicherung sitzt am Batteriepol — und schützt die Leitung
              </h3>
              <p className="mt-2 text-md leading-relaxed text-ink-soft">
                Ein Kurzschluss in einer ungeschützten Leitung wird zur Heizung: Der Strom einer
                100-Ah-LiFePO4 ist hoch genug, um eine 2,5-mm²-Leitung in Sekunden in Brand zu setzen. Deshalb
                sitzt das Schutzorgan unmittelbar am Pluspol der Batterie, bevor die erste Leitung ungeschützt
                geführt wird. Der Planer prüft dafür {FUSE_MAX_UNPROTECTED_LENGTH_M * 100} cm ab der Quelle —
                der Wert aus ISO 10133:2000 § 8.1, der für kleine Boote und damit für einen großen Teil der
                Camper-Praxis gilt. DIN VDE 0100-721 verlangt den Überstromschutz ebenfalls nahe der Batterie,
                nennt aber keine Länge.
              </p>
              <p className="mt-3 text-md leading-relaxed text-ink-soft">
                Bemessen wird die Sicherung nicht nach dem Gerät, sondern nach dem Kabel. Maßgeblich ist die
                Kette I<sub>B</sub> ≤ I<sub>n</sub> ≤ I<sub>z</sub>: Der Betriebsstrom I<sub>B</sub> darf die
                Nennstromstärke der Sicherung I<sub>n</sub> nicht überschreiten, und die Sicherung darf die
                Belastbarkeit des Leiters I<sub>z</sub> nicht überschreiten. Ein zu dünnes Kabel ist daher
                kein „Puffer", sondern bestimmt die Obergrenze der Sicherung — dickere Leitung ist der
                günstigere Weg zu einer größeren Sicherung als eine Sicherung, die im Kurzschlussfall nicht
                mehr schützt.
              </p>
              <div className="warn-card warn-card-info mt-4">
                <p className="text-md">
                  Die 230-V-Seite des Fahrzeugs ist ein eigener Fall: Für Landstromanschlüsse gilt die Prüfung
                  nach DIN VDE 0100-721 durch eine Elektrofachkraft. Der Planer hilft beim Aufbau, er ersetzt
                  keine Abnahme.
                </p>
              </div>
            </article>

            <article aria-labelledby="normen-titel" className="mt-10 max-w-3xl">
              <h3 id="normen-titel" className="text-lg font-semibold text-ink">
                Normen, auf die sich das Modell bezieht
              </h3>
              <dl className="mt-4 space-y-2 text-md">
                {NORMEN.map((entry) => (
                  <div key={entry.norm} className="border-t border-rule pt-2">
                    <dt className="font-mono text-ink">{entry.norm}</dt>
                    <dd className="text-ink-soft">{entry.bereich}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-md leading-relaxed text-ink-soft">
                Die Tabellen des Planers folgen DIN VDE 0298-4, Verlegeart B2. Leitungen im Fahrzeug werden
                überwiegend nach ISO 6722 (FLRY) ausgeführt — dieser Nachweis wird hier nicht getrennt
                geführt; die Werte der verwendeten Spalte liegen damit auf der konservativen Seite.
                Normaussagen dieses Abschnitts sind Referenzen auf den Geltungsbereich der genannten
                Regelwerke, keine Rechtsprüfung.
              </p>
            </article>
          </section>

          <section id="planer" aria-labelledby="planer-titel" className="scroll-mt-20">
            <h2 id="planer-titel" className="font-display text-xl font-semibold text-ink">
              Schaltplan zeichnen und automatisch verdrahten
            </h2>
            <p className="mt-2 max-w-3xl text-md text-ink-soft">
              Der Planer nimmt dir die Rechnung auf der ganzen Anlage ab: Bauteile setzen, verbinden lassen —
              Querschnitt, Sicherung und Längen landen gleichzeitig in der Stückliste. Der Plan liegt lokal im
              Browser, du kannst ihn also unterbrechen und später weiterführen.
            </p>
            {/* Feste Höhe hält den Layoutsprung beim Nachladen des Planers bei null (CLS);
                auf dem Handy läuft die Zeichenfläche über die Seitenränder hinaus, damit
                der Canvas die volle Bildschirmbreite behält. */}
            <div className="-mx-5 mt-6 h-dvh overflow-hidden border-y border-rule bg-bone md:mx-0 md:h-[46rem] md:border">
              <Planner />
            </div>
          </section>

          <section id="faq" aria-labelledby="faq-titel" className="scroll-mt-20">
            <h2 id="faq-titel" className="font-display text-xl font-semibold text-ink">
              Häufige Fragen zur Wohnmobil-Elektrik
            </h2>
            <div className="mt-6 max-w-3xl">
              <FaqAkkordeon entries={ELEKTRIK_FAQ} />
            </div>
            <nav aria-label="Weiterführende Themen" className="mt-6">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-md">
                <li>
                  <Link href="/guides/camper-ausbauguide" className="underline hover:text-ink">
                    Elektrik im Ausbau-Guide
                  </Link>
                </li>
                <li>
                  <Link href="/tools/heizung" className="underline hover:text-ink">
                    Heizlast berechnen
                  </Link>
                </li>
                <li>
                  <Link href="/tools/dach" className="underline hover:text-ink">
                    Dachfläche belegen
                  </Link>
                </li>
              </ul>
            </nav>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
