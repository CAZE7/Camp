import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import RoadTripAnimationLazy from './RoadTripAnimationLazy';
import { PageShell } from '@/components/brand/PageShell';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
import { breadcrumbsFor } from '@/components/seo/Breadcrumbs';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pageByPath } from '@/lib/seo/inventory';

import { metadataForPage } from '@/app/seoMetadata';

/** Brotkrumen und strukturierte Beschreibung aus dem Inventar. */
const PAGE = pageByPath('/guides/camper-ausbauguide/');

// Outfit wird lokal über @fontsource-variable/outfit gebündelt (offline-fähiger Build).
const outfit = { className: 'font-outfit' };

export const metadata: Metadata = metadataForPage('/guides/camper-ausbauguide/');

export default function CamperAusbauguide() {
  if (!PAGE) throw new Error('SEO-Inventar: /guides/camper-ausbauguide/ fehlt.');
  const crumbs = breadcrumbsFor(PAGE);

  return (
    // Dieselbe Basis wie die anderen Leitfäden: Kopf, Brotkrumen und Fuß aus
    // einem Stück. Die Reiseanimation bleibt dort, wo sie war — sie sucht
    // `#ausbau-page` und hängt an keiner Shell-Klasse.
    <PageShell variant="article" breadcrumbs={crumbs} mainClassName="flex flex-col">
      <PageStructuredData path="/guides/camper-ausbauguide/" breadcrumbItems={crumbs} />
      <div id="ausbau-page" className="relative flex-1 overflow-hidden bg-paper px-4 pt-8 pb-24 sm:px-6">
        {/* GSAP-Animation als Hintergrundspur — nachgeladen, siehe Wrapper */}
        <RoadTripAnimationLazy />

        {/* Main Content Area - Shifted slightly to the right to make room for the fixed animation on larger screens */}
        <div className="relative z-20 mx-auto max-w-3xl lg:ml-56 xl:mx-auto">
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/guides/" className="inline-flex min-h-11 items-center text-sm text-copper">
              ← Alle Guides
            </Link>
            <Link
              href="/guides/ausbau-fahrplan"
              className="inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink"
            >
              Ausbau-Fahrplan
            </Link>
          </div>

          {/* Paper-like container */}
          <div className="border border-rule bg-bone p-8 shadow-sm md:p-12">
            {/* Die Überschrift bleibt zweizeilig und trägt den Akzent im
                zweiten Teil; die Größe kommt jetzt aus der gemeinsamen
                Skala (.h1) statt aus einer eigenen. */}
            <h1 className={cn('h1 mt-2 mb-6 leading-tight', outfit.className)}>
              Camper-Ausbau: <br />
              <span className="text-copper">Planung, Technik und Zulassung</span>
            </h1>

            <div className="space-y-6 text-base leading-relaxed text-ink-soft md:text-lg">
              <h2 className={cn('mt-10 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                Worum es in diesem Guide geht
              </h2>
              <p>
                Der Ausbau eines Kastenwagens ist eine Kette von Entscheidungen: Fahrzeug, Grundriss, Dämmung,
                Leitungen, Heizung, Möbel und Zulassung. Wer eine Stufe überspringt, muss später zurückbauen.
                Dieser Guide ordnet die Arbeit und verweist für jede Zahl auf die Seite, die sie herleitet.
              </p>
              <p>
                Die Reihenfolge ist wichtiger als das einzelne Bauteil: Kabel und Leerrohre kommen vor die
                Dämmung, die Dämmung vor die Wandverkleidung, die Technik vor die Möbel. Die folgenden
                Abschnitte erklären, was wann entschieden wird — und wo eine Fachkraft gefragt ist. Maße und
                Materialangaben sind Erfahrungswerte; Herstellerangaben und die eigene Messung gehen vor.
              </p>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                1. Bauablauf und Reihenfolge
              </h2>
              <p>
                Ein Ausbau ohne Plan ist wie eine Fahrt ohne Navi: Man kommt irgendwo an, aber selten dort, wo
                man hinwollte. Wer die Reihenfolge der Gewerke missachtet, baut am Ende Dinge doppelt ab.
              </p>

              <h3 className={cn('mt-8 mb-4 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                1.1 Der Bauablauf in der richtigen Reihenfolge
              </h3>
              <ol className="list-decimal space-y-3 border border-rule bg-paper p-6 pl-10 font-medium text-ink-soft">
                <li>
                  <strong>Planung & Fahrzeugkauf:</strong> Budget, Grundriss, Gewichtsreserve.
                </li>
                <li>
                  <strong>Entkernung & Rostvorsorge:</strong> Trennwand (falls zulässig), Reinigung,
                  Rostbehandlung.
                </li>
                <li>
                  <strong>Karosseriearbeiten:</strong> Fenster, Dachluken, Landstromanschluss; Schnittkanten
                  rostschützen.
                </li>
                <li>
                  <strong>Kabel- und Rohrwege planen:</strong> Leerrohre und Trassen VOR der Dämmung setzen.
                </li>
                <li>
                  <strong>Dämmung:</strong> Entdröhnung, Wärmedämmung, Hohlräume.
                </li>
                <li>
                  <strong>Unterkonstruktion & Boden:</strong> Lattung, Holme verkleiden, Bodenplatte.
                </li>
                <li>
                  <strong>Technik-Installation (Rohbau):</strong> Elektrik, Wasserleitungen, Standheizung; 230
                  V durch eine Elektrofachkraft.
                </li>
                <li>
                  <strong>Innenausbau (Hülle):</strong> Wand- und Deckenverkleidung.
                </li>
                <li>
                  <strong>Möbelbau & Technik-Endmontage:</strong> Schränke, Bett, Anschließen der Geräte.
                </li>
                <li>
                  <strong>TÜV & Abnahme:</strong> Wohnmobilzulassung, Gasprüfung, 230-V-Erstprüfung.
                </li>
              </ol>

              <div className="warn-card warn-card-warning my-10 flex-col">
                <div className="flex items-start gap-3">
                  <p className="text-base leading-relaxed text-warn-warning">
                    <strong>Planungstipp:</strong> Zeichne einen Grundriss deines Vans (zum Beispiel in
                    SketchUp oder Vanspace3D) und plane besonders die Kabelwege und Leerrohre.
                  </p>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <p className="text-base leading-relaxed text-warn-warning">
                    <strong>Typischer Fehler:</strong> Kabel lose in der Dämmung verlegen. Später willst du
                    einen Schrank anschrauben, triffst ein unsichtbares Kabel und musst die halbe Wand wieder
                    öffnen. Nutze Wellrohre und befestige sie am Blech.
                  </p>
                </div>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                2. Fahrzeugwahl und Vorbereitung
              </h2>

              <h3 className={cn('mt-8 mb-4 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                2.1 Fahrzeuggröße und Grundriss
              </h3>
              <p>
                Die Fahrzeuggröße bestimmt Grundriss, Zuladung und Alltagstauglichkeit. Ein Kastenwagen der
                Größe <strong>H2/L2</strong> (zum Beispiel Fiat Ducato) ist ein häufiger Kompromiss: rund 5,4
                m Länge und gut 1,9 m Innenhöhe im Rohzustand. Die Maße unterscheiden sich je nach Hersteller
                und Aufbau; miss dein Fahrzeug selbst.
              </p>
              <ul className="mt-6 mb-8 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>Stehhöhe:</strong> Die Innenhöhe im Rohzustand liegt bei H2 je nach Modell bei etwa
                  1,9 m. Nach Bodenaufbau und Deckenverkleidung bleiben davon oft 5–10 cm weniger. Prüfe die
                  Stehhöhe an der Stelle, an der du später stehen willst.
                </li>
                <li>
                  <strong>Breite:</strong> Die Innenbreite entscheidet, ob ein Querbett passt. Ducato, Boxer
                  und Jumper gehören zu den breiteren Kastenwagen; auch Sprinter, Crafter und Transit können
                  je nach Modell und Ausbau ein Querbett aufnehmen. Miss die nutzbare Breite zwischen den
                  Verkleidungen und rechne die Bettlänge abzüglich Dämmung.
                </li>
              </ul>

              <div className="warn-card warn-card-critical my-8">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn-critical text-xs font-bold text-paper"
                >
                  !
                </span>
                <p className="text-base leading-relaxed text-warn-critical">
                  <strong>Stehhöhe mit Reserve planen:</strong> Dämmung, Boden und Deckenverkleidung kosten
                  mehrere Zentimeter. Wer die Höhe knapp plant, steht später mit gebeugtem Kopf.
                </p>
              </div>

              <h3 className={cn('mt-10 mb-4 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                2.2 Werkzeug und Material
              </h3>
              <p>
                Für die meisten Arbeitsschritte reichen Standardwerkzeuge; für dicke Kabel, Nietmuttern und
                Ausschnitte lohnt Spezialwerkzeug.
              </p>

              <div className="mt-8 mb-12 grid gap-8 md:grid-cols-2">
                <div className="border border-rule bg-paper p-6">
                  <h4 className={cn('mb-4 text-lg font-semibold text-oxide', outfit.className)}>
                    Wichtige Werkzeuge
                  </h4>
                  <ul className="space-y-3 text-base text-ink-soft">
                    <li className="flex gap-3">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-oxide" />
                      <span>
                        <strong>Blechknabber / Nibbler:</strong> Für saubere Fensterausschnitte ohne
                        Blechverzug.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-oxide" />
                      <span>
                        <strong>Crimpzange (hydraulisch, 16–50 mm²):</strong> Unerlässlich für dicke
                        Batteriekabel.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-oxide" />
                      <span>
                        <strong>Crimpzange (0,5–6 mm²):</strong> Für Flachsteckerhülsen; Crimpen ist bei
                        Vibrationen die übliche Verbindung.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-oxide" />
                      <span>
                        <strong>Nietmutternzange (M4–M8):</strong> Gewinde sicher im Blech verankern.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-oxide" />
                      <span>
                        <strong>Multimeter:</strong> Für Elektrik-Checks und Fehlersuche.
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="border border-rule bg-paper p-6">
                  <h4 className={cn('mb-4 text-lg font-semibold text-copper-deep', outfit.className)}>
                    Wichtige Materialien
                  </h4>
                  <ul className="space-y-3 text-base text-ink-soft">
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-copper">
                        ◆
                      </span>
                      <span>
                        <strong>Holz:</strong> Siebdruckplatte für den Boden, Pappelsperrholz für Möbel;
                        Stärke nach Last und Gewicht.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-copper">
                        ◆
                      </span>
                      <span>
                        <strong>Kleber:</strong> Konstruktionskleber, zum Beispiel SikaFlex 552 AT oder
                        Dekasyl MS-5.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-copper">
                        ◆
                      </span>
                      <span>
                        <strong>Dichtmasse:</strong> dauerelastische Dichtmasse, zum Beispiel Dekaseal 8936.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-copper">
                        ◆
                      </span>
                      <span>
                        <strong>Rostschutz:</strong> nach Herstellervorgabe, zum Beispiel Brantho-Korrux 3in1.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                3. Karosserie & Außenhülle
              </h2>
              <p>
                Ausschnitte in Fenster, Dach und Karosserie sind der Punkt, an dem aus dem Transporter ein
                Camper wird. Sie müssen sauber, rostgeschützt und dicht ausgeführt werden — ein späterer
                Wassereintritt ist aufwendiger zu beheben als der Ausschnitt selbst.
              </p>

              <h3 className={cn('mt-8 mb-4 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                3.1 Fenster und Dachluken einbauen
              </h3>
              <ul className="mb-8 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>Ausschnitt:</strong> Position anzeichnen und abkleben, an den Ecken vorbohren, mit
                  Stichsäge oder Blechknabber schneiden. Prüfe vorher, ob der Ausschnitt die Karosserie
                  versteift oder einen Rahmen braucht.
                </li>
                <li>
                  <strong>Schnittkante:</strong> Sofort entgraten, reinigen und mit Rostschutz behandeln.
                </li>
                <li>
                  <strong>Abdichten:</strong> Eine dauerelastische Dichtmasse verwenden, zum Beispiel Dekaseal
                  8936. Ein Konstruktionskleber ist zum Abdichten nicht gedacht.
                </li>
              </ul>

              <div className="warn-card warn-card-warning my-8">
                <p className="text-base leading-relaxed text-warn-warning">
                  <strong>Typischer Fehler:</strong> Den Holzrahmen vergessen. Das Blech ist dünn, die
                  Klemmbreite der Fensterrahmen liegt je nach Modell oft bei 26–34 mm. Prüfe die
                  Herstellervorgabe und setze den Rahmen von innen, bevor du das Fenster verschraubst.
                </p>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                4. Dämmung
              </h2>
              <p>
                Dämmung hält Wärme im Fahrzeug und reduziert Kondenswasser an kalten Blechflächen. Sie
                verhindert Feuchtigkeit nicht allein: Lüften, eine trockene Konstruktion und sorgfältig
                ausgeführte Anschlüsse gehören dazu.
              </p>

              <h3 className={cn('mt-8 mb-4 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                4.1 Materialien und Stärken
              </h3>
              <ul className="mb-8 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>Alubutyl (Entdröhnung):</strong> Nimmt Schwingungen aus dem Blech. Es reicht,{' '}
                  <strong>30–50 %</strong> der Flächen zu bekleben; mehr bringt akustisch oft wenig, kostet
                  aber Gewicht.
                </li>
                <li>
                  <strong>Geschlossenzellige Dämmung (Wärme):</strong> Stärke nach verfügbarem Platz und
                  Dämmziel. Hohlräume können mit geeignetem Dämmmaterial gefüllt werden; Schafwolle braucht
                  eine trockene Konstruktion.
                </li>
                <li>
                  <strong>Wärmebrücken:</strong> Blechteile, Holme und Fensterrahmen leiten Wärme besonders
                  gut. Unterbrich diese Wege, wo es möglich ist.
                </li>
              </ul>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                5. Elektrik
              </h2>

              <h3 className={cn('mt-8 mb-4 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                5.1 230-V-Anlage und Sicherheit
              </h3>
              <p>
                Für 230-V-Anlagen im Fahrzeug gilt DIN VDE 0100-721. Errichtung und Prüfung gehören in die
                Hände einer Elektrofachkraft; der Plan allein ersetzt sie nicht.
              </p>
              <ul className="mt-6 mb-8 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>FI-Schutz:</strong> Erforderlich ist ein FI-Schutz mit 30 mA; ob ein zweipoliger
                  RCBO nötig ist, legt die Elektrofachkraft nach DIN VDE 0100-721 fest.
                </li>
                <li>
                  <strong>Leitung:</strong> Für die Landstromzuleitung ist H07RN-F 2,5 mm² üblich; interne
                  Leitungen flexibel und flammwidrig ausführen. Massive NYM-Leiter sind im Fahrzeug
                  ungeeignet.
                </li>
                <li>
                  <strong>Litzenenden:</strong> Mit Aderendhülsen versehen; Verzinnen ist an Schraubklemmen
                  nicht üblich, weil die Verbindung unter Druck nachgeben kann.
                </li>
              </ul>

              <h3 className={cn('mt-8 mb-4 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                5.2 Kabelquerschnitt
              </h3>
              <p>
                Der Querschnitt folgt aus Strom, Leitungslänge und zulässigem Spannungsfall. Für eine
                Kompressor-Kühlbox mit 4–5 A sind auf 5 m 2,5 mm² eine übliche Größe; prüfe den Wert mit dem
                Rechner, weil Länge und Spannungsfall die Wahl bestimmen.
              </p>

              <div className="warn-card warn-card-warning my-10">
                <p className="text-base leading-relaxed text-warn-warning">
                  <strong>Sicherung:</strong> Sie sitzt so nah wie möglich am Batteriepol und schützt die
                  Leitung, nicht das Gerät am Ende.
                </p>
              </div>

              {/* Brücke vom Ratgeber in das Elektrik-Thema: Der Guide erklärt die
                  Reihenfolge, die Themenseiten rechnen die Werte aus (§11). */}
              <aside className="mt-10 border border-rule bg-bone p-6" aria-labelledby="guide-elektrik-titel">
                <h3
                  id="guide-elektrik-titel"
                  className={cn('text-xl font-semibold text-ink', outfit.className)}
                >
                  Weiterlesen: Elektrik im Detail
                </h3>
                <p className="mt-2 text-base leading-relaxed text-ink-soft">
                  Kabelquerschnitt, Sicherung und Spannungsfall hängen zusammen — diese Seiten rechnen sie
                  einzeln durch, mit Formel, Normreihe und Beispiel:
                </p>
                <ul className="mt-4 space-y-2">
                  <li>
                    <Link
                      href="/camper-elektrik/kabelquerschnitt/"
                      className="underline underline-offset-2 hover:text-ink"
                    >
                      Kabelquerschnitt für 12 V berechnen
                    </Link>
                    <span className="text-ink-soft"> — Formel, Normreihe und Rechner.</span>
                  </li>
                  <li>
                    <Link
                      href="/camper-elektrik/sicherungen/"
                      className="underline underline-offset-2 hover:text-ink"
                    >
                      Sicherung und Leitung richtig paaren
                    </Link>
                    <span className="text-ink-soft"> — Ort, Größe und Abschaltvermögen.</span>
                  </li>
                  <li>
                    <Link href="/planer/" className="underline underline-offset-2 hover:text-ink">
                      Anlage im Camper-Elektroplaner zeichnen
                    </Link>
                    <span className="text-ink-soft"> — jede Leitung geprüft, Stückliste inklusive.</span>
                  </li>
                </ul>
              </aside>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                6. Klima & Heizung
              </h2>
              <p>
                Eine <strong>Diesel-Standheizung mit 2 kW</strong> ist für einen gut gedämmten H2/L2 oft
                ausreichend. Eine 4-kW-Heizung ist meist überdimensioniert und taktet häufiger; ob das die
                Brennkammer belastet, hängt von der Modulationsgrenze des Geräts ab. Die nötige Leistung lässt
                sich mit dem Heizlast-Rechner abschätzen.
              </p>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                7. Innenausbau (Boden, Wände, Möbel)
              </h2>
              <p>
                Für den Möbelbau ist leichtes Sperrholz üblich, oft Pappel. Verbindungen mit Taschenloch oder
                Alu-Profilen sind vibrationsfester als einfache Schrauben. Jedes Bauteil wird an der
                Unterkonstruktion befestigt; jedes Kilogramm zählt bei der Zuladung.
              </p>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mt-12 mb-4 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                8. Zulassung & Sicherheit
              </h2>
              <p>
                Für die Umschreibung zum Wohnmobil prüft der TÜV je nach Fahrzeug und Prüfstelle eine Reihe
                von Merkmalen — unter anderem Tisch, Schlafplatz, Sitzgelegenheit, Stauraum, Kochgelegenheit,
                Fenster und Lüftung. Eine formale Stehhöhe ist keine allgemeine Voraussetzung; einzelne Prüfer
                achten auf eine nutzbare Höhe. Die genauen Anforderungen stehen auf der Seite
                Wohnmobilzulassung; kläre sie vor dem Ausbau mit der Prüfstelle.
              </p>

              <div className="warn-card warn-card-critical my-8">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn-critical text-xs font-bold text-paper"
                >
                  !
                </span>
                <p className="text-base leading-relaxed font-semibold text-warn-critical">
                  Die zulässige Gesamtmasse umfasst Fahrzeug, Ausbau, Wasser, Gepäck und Passagiere. Wiege den
                  Ausbau vor der Zulassung; eine Reserve für Wasser und Gepäck bleibt nötig.
                </p>
              </div>

              <hr className="my-12 border-rule" />

              <div className="mt-24 border border-rule bg-soot p-10 text-center text-paper shadow-lg md:p-14">
                <h3 className={cn('mb-4 text-2xl font-semibold text-paper md:text-2xl', outfit.className)}>
                  Weiter zum Ausbau-Fahrplan
                </h3>
                <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-paper/80 md:text-lg">
                  Der Fahrplan ordnet die Gewerke; der Elektroplaner rechnet die Elektrik. Beide Seiten bauen
                  auf denselben Annahmen auf.
                </p>
                <Link
                  href="/guides/ausbau-fahrplan"
                  className="inline-flex min-h-12 items-center border border-paper bg-paper px-6 py-3 text-sm font-semibold text-ink hover:bg-bone focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-soot focus-visible:outline-none"
                >
                  Weiter zum Ausbau-Fahrplan →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
