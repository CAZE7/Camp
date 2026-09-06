import React from 'react';
import Link from 'next/link';
import RoadTripAnimation from './RoadTripAnimation';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { cn } from '@/lib/utils';

// Outfit wird lokal über @fontsource-variable/outfit gebündelt (offline-fähiger Build).
const outfit = { className: 'font-outfit' };

export const metadata = {
  title: 'Der ultimative Camper Ausbauguide',
  description: 'Von der leeren Blechbüchse zum rollenden Zuhause. Technik, Normen und Profi-Tipps.',
};

export default function CamperAusbauguide() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <div id="ausbau-page" className="relative flex-1 overflow-hidden bg-paper px-4 pb-24 pt-12 sm:px-6">
        {/* GSAP Animation Sidebar / Background track */}
        <RoadTripAnimation />

        {/* Main Content Area - Shifted slightly to the right to make room for the fixed animation on larger screens */}
        <main id="main" className="relative z-20 mx-auto max-w-3xl lg:ml-56 xl:mx-auto">
          <Link
            href="/guides/ausbau-fahrplan"
            className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink"
          >
            ← Zurück zum Ausbau-Fahrplan
          </Link>

          {/* Paper-like container */}
          <div className="border border-rule bg-bone p-8 shadow-sm md:p-12">
            <h1
              className={cn(
                'mb-6 text-2xl font-semibold leading-tight text-ink md:text-2xl',
                outfit.className
              )}
            >
              Der ultimative Camper-Ausbau-Guide:
              <br />
              <span className="text-copper">Von der leeren Blechbüchse zum rollenden Zuhause</span>
            </h1>

            <div className="warn-card warn-card-info mb-10">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn-info text-xs font-bold text-paper"
              >
                i
              </span>
              <p className="text-sm leading-relaxed">
                <strong>Storytelling-Navigation:</strong> Auf großen Bildschirmen zeichnet sich links der Weg
                deines Vans mit — je weiter du scrollst, desto mehr Strecke wird sichtbar. Auf Mobilgeräten
                und bei aktivierter Einstellung „Bewegungen reduzieren" wird die Animation abgeschaltet.
              </p>
            </div>

            <div className="space-y-6 text-base leading-relaxed text-ink-soft md:text-lg">
              <h2 className={cn('mb-4 mt-10 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                Die Reise beginnt: Dein Traum vom Vanlife
              </h2>
              <p>
                Stell dir vor: Du wachst auf, öffnest die Hecktüren deines Vans und blickst direkt auf einen
                nebelverhangenen Bergsee. Der Kaffee brüht bereits auf dem Gasherd, und du weißt: Alles um
                dich herum hast du selbst mit deinen eigenen Händen erschaffen. Der Weg zum fertigen Camper
                ist lang, manchmal frustrierend und voller Überraschungen – aber er ist auch eines der
                erfüllendsten Projekte, die du je angehen wirst.
              </p>
              <p>
                Dieser Guide ist dein Co-Pilot. Wir gehen nicht nur durch die <em>Was</em>-Schritte, sondern
                klären vor allem das <em>Warum</em> und das <em>Wie</em>. Schluss mit Halbwissen: Hier gibt es
                handfeste Normen, exakte Materialstärken und das geballte Wissen, das du brauchst, um teure
                Anfängerfehler zu vermeiden.
              </p>

              {/* Dezenter Platzhalter statt externem Unsplash-Bild (offline-fähiger Export). */}
              <div className="my-10 flex aspect-video w-full items-center justify-center border border-rule bg-paper">
                <span className="label-eyebrow text-copper">Ausbau-Impressionen</span>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                1. Gesamtstrategie und Bauphasen
              </h2>
              <p>
                Ein Ausbau ohne Plan ist wie eine Fahrt ohne Navi: Man kommt irgendwo an, aber selten dort, wo
                man hinwollte. Wer die Reihenfolge der Gewerke missachtet, baut am Ende Dinge doppelt ab.
              </p>

              <h3 className={cn('mb-4 mt-8 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                1.1 Der perfekte Bauablauf (Chronologisch)
              </h3>
              <ol className="list-decimal space-y-3 border border-rule bg-paper p-6 pl-10 font-medium text-ink-soft">
                <li>
                  <strong>Planung & Fahrzeugkauf:</strong> Budget, Layout, Gewichtsplanung.
                </li>
                <li>
                  <strong>Entkernung & Rostvorsorge:</strong> Das Fundament muss gesund sein.
                </li>
                <li>
                  <strong>Karosseriearbeiten:</strong> Fenster, Dachluken, Landstromanschluss (Flexen tut nur
                  beim ersten Mal weh!).
                </li>
                <li>
                  <strong>Kabel- und Rohrwege planen:</strong> Leerrohre und Trassen VOR der Dämmung setzen.
                </li>
                <li>
                  <strong>Dämmung & Isolierung:</strong> Alubutyl und Armaflex (oder Alternativen).
                </li>
                <li>
                  <strong>Unterkonstruktion & Boden:</strong> Lattung, Holme verkleiden, Bodenplatte.
                </li>
                <li>
                  <strong>Technik-Installation (Rohbau):</strong> Elektrik-Verkabelung, Wasserleitungen,
                  Standheizung.
                </li>
                <li>
                  <strong>Innenausbau (Hülle):</strong> Wand- und Deckenverkleidung.
                </li>
                <li>
                  <strong>Möbelbau & Technik-Endmontage:</strong> Schränke, Bett, Anschließen der Geräte.
                </li>
                <li>
                  <strong>TÜV & Abnahme:</strong> Wohnmobilzulassung und Gasprüfung.
                </li>
              </ol>

              <div className="warn-card warn-card-warning my-10 flex-col">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 text-lg">
                    💡
                  </span>
                  <p className="text-base leading-relaxed text-warn-warning">
                    <strong>Profi-Tipp:</strong> Mach dir einen digitalen &quot;Schattenriss&quot; deines Vans
                    (z. B. in SketchUp oder Vanspace3D) und plane jeden Millimeter, besonders die Kabelwege
                    und Leerrohre.
                  </p>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 text-lg">
                    ⚠️
                  </span>
                  <p className="text-base leading-relaxed text-warn-warning">
                    <strong>Häufiger Anfängerfehler:</strong> Kabel lose in der Dämmung verlegen. Später
                    willst du einen Schrank anschrauben, triffst ein unsichtbares Kabel und darfst die halbe
                    Wand wieder aufreißen. Nutze immer Wellrohre und befestige sie am Blech!
                  </p>
                </div>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                2. Planung, Basis & Vorbereitung
              </h2>

              <h3 className={cn('mb-4 mt-8 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                2.1 Das richtige Fahrzeug finden
              </h3>
              <p>
                Die Fahrzeugklasse bestimmt den gesamten Ausbau. <strong>H2/L2</strong> (Höhe 2, Länge 2 -
                z.B. Fiat Ducato, ca. 5,40m lang) ist der Sweetspot für Alltagstauglichkeit und Platz.
              </p>
              <ul className="mb-8 mt-6 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>Stehhöhe:</strong> Achte auf H2 (ca. 1,90m - 1,93m Innenhöhe im Rohzustand). Vergiss
                  nicht: Bodenkonstruktion (ca. 3-4cm) und Deckenverkleidung (ca. 2-3cm) fressen Höhe!
                </li>
                <li>
                  <strong>Breite:</strong> Fiat Ducato / Peugeot Boxer / Citroën Jumper sind die einzigen
                  gängigen Kastenwagen, die Querbetten für Menschen bis 1,85m zulassen, ohne dass man die
                  Karosserie mit seitlichen GfK-Verbreiterungen (&quot;Flares&quot;) aufschneiden muss.
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
                  <strong>Was passiert, wenn du die Stehhöhe falsch berechnest?</strong> Du musst jahrelang in
                  deinem rollenden Zuhause den Kopf einziehen. Plane immer mit mindestens 5–7 cm Verlust durch
                  Dämmung, Boden und Decke.
                </p>
              </div>

              <h3 className={cn('mb-4 mt-10 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                2.2 Material- & Werkzeug-Checkliste
              </h3>
              <p>Ohne das richtige Spezialwerkzeug wird der Ausbau zur Qual.</p>

              <div className="mb-12 mt-8 grid gap-8 md:grid-cols-2">
                <div className="border border-rule bg-paper p-6">
                  <h4 className={cn('mb-4 text-lg font-semibold text-oxide', outfit.className)}>
                    Must-Have Werkzeuge
                  </h4>
                  <ul className="space-y-3 text-base text-ink-soft">
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-oxide">
                        ✓
                      </span>
                      <span>
                        <strong>Blechknabber / Nibbler:</strong> Für saubere Fensterausschnitte ohne
                        Blechverzug.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-oxide">
                        ✓
                      </span>
                      <span>
                        <strong>Crimpzange (hydraulisch, 16–50 mm²):</strong> Unerlässlich für dicke
                        Batteriekabel.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-oxide">
                        ✓
                      </span>
                      <span>
                        <strong>Crimpzange (0,5–6 mm²):</strong> Für Flachsteckerhülsen (niemals löten!).
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-oxide">
                        ✓
                      </span>
                      <span>
                        <strong>Nietmutternzange (M4–M8):</strong> Gewinde sicher im Blech verankern.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-oxide">
                        ✓
                      </span>
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
                        <strong>Holz:</strong> Siebdruckplatte (12–15 mm) Boden, Pappelsperrholz (12–15 mm)
                        Möbel.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-copper">
                        ◆
                      </span>
                      <span>
                        <strong>Kleber:</strong> SikaFlex 552 AT oder Dekasyl MS-5 (Konstruktion).
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-copper">
                        ◆
                      </span>
                      <span>
                        <strong>Dichtmasse:</strong> Dekaseal 8936 (abtupfbare Masse für Fenster).
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span aria-hidden="true" className="text-copper">
                        ◆
                      </span>
                      <span>
                        <strong>Rostschutz:</strong> Brantho-Korrux 3in1.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                3. Karosserie & Außenhülle
              </h2>
              <p>
                Hier wird aus dem Transporter ein Camper. Löcher ins Blech zu schneiden kostet Überwindung,
                ist aber mit der richtigen Vorbereitung machbar.
              </p>

              <h3 className={cn('mb-4 mt-8 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                3.1 Fenstereinbau & Dachluken
              </h3>
              <ul className="mb-8 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>Wie:</strong> Ausschnitt großflächig mit Kreppband abkleben. Vorbohren an den Ecken
                  (10mm Bohrer). Mit Stichsäge schneiden.
                </li>
                <li>
                  <strong>Das Wichtigste:</strong> Die Schnittkante MUSS sofort entgratet, gereinigt und mit
                  Rostschutz versiegelt werden.
                </li>
                <li>
                  <strong>Abdichten:</strong> Fenster immer mit <strong>Dekaseal 8936</strong> einsetzen.
                  Niemals Konstruktionskleber verwenden!
                </li>
              </ul>

              <div className="warn-card warn-card-warning my-8">
                <span aria-hidden="true" className="mt-0.5 text-lg">
                  ⚠️
                </span>
                <p className="text-base leading-relaxed text-warn-warning">
                  <strong>Häufiger Anfängerfehler:</strong> Den Holz-Hilfsrahmen vergessen. Das Blech ist nur
                  ~1 mm dick, Fensterklemmen brauchen aber oft 26–34 mm. Klebe einen passenden Holzrahmen von
                  innen gegen das Blech, bevor du das Fenster verschraubst.
                </p>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                4. Isolierung & Dämmung
              </h2>
              <p>
                Warum dämmen wir? Nicht nur, damit es warm bleibt, sondern um <strong>Kondenswasser</strong>{' '}
                und damit unweigerlich Rost und Schimmel zu verhindern.
              </p>

              <h3 className={cn('mb-4 mt-8 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                4.1 Materialkunde & Stärken
              </h3>
              <ul className="mb-8 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>Alubutyl (Entdröhnung):</strong> Nimmt die Schwingungen aus dem Blech. Es reicht,{' '}
                  <strong>30-50%</strong> der Flächen zu bekleben. Mehr bringt akustisch kaum Vorteile,
                  addiert aber massiv Gewicht.
                </li>
                <li>
                  <strong>Armaflex XG oder AF (Wärmedämmung):</strong> 19mm stark für Wände und Decke, 9mm für
                  Boden und Holme. Hohlräume mit Schafwolle ausstopfen.
                </li>
              </ul>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                5. Elektrik – Das Nervenzentrum
              </h2>

              <h3 className={cn('mb-4 mt-8 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                5.1 Normen & Sicherheit (DIN VDE 0100-721)
              </h3>
              <p>Der Einbau von 230V-Anlagen (Landstrom) unterliegt zwingend der Norm DIN VDE 0100-721.</p>
              <ul className="mb-8 mt-6 list-disc space-y-3 pl-6 text-ink-soft">
                <li>
                  <strong>Pflicht:</strong> Ein 2-poliger FI/LS-Schutzschalter (RCBO, 30mA, 10A-16A).
                </li>
                <li>
                  <strong>Pflicht:</strong> Kabel vom Typ <strong>H07RN-F</strong> (Gummischlauchleitung).
                  Starrkabel (NYM) brechen durch Vibrationen!
                </li>
                <li>
                  <strong>Pflicht:</strong> Aderendhülsen an den Litzenenden. Niemals verzinnen (Brandgefahr
                  durch Kaltfließen).
                </li>
              </ul>

              <h3 className={cn('mb-4 mt-8 text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                5.2 Kabelquerschnitte berechnen
              </h3>
              <p>
                Je weiter der Weg und je höher der Strom, desto dicker das Kabel. Nutze zwingend
                Online-Kabelrechner. Ein Kühlschrank auf 5 Meter benötigt bereits mind. 2,5mm²!
              </p>

              <div className="warn-card warn-card-warning my-10">
                <span aria-hidden="true" className="mt-0.5 text-lg">
                  💡
                </span>
                <p className="text-base leading-relaxed text-warn-warning">
                  <strong>Profi-Tipp:</strong> Setze Sicherungen so nah wie möglich an die Batterie. Die
                  Sicherung schützt das KABEL vor dem Durchschmoren, nicht das Endgerät!
                </p>
              </div>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                6. Klima & Heizung
              </h2>
              <p>
                Die <strong>Diesel-Standheizung (z.B. Autoterm Air 2D)</strong> ist der Favorit. Zieht Diesel
                direkt aus dem Tank. Warum 2kW und nicht 4kW? Eine 4kW-Heizung taktet in kleinen Vans zu oft,
                verrußt und geht kaputt. 2kW reichen für H2L2 völlig aus.
              </p>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                7. Innenausbau (Boden, Wände, Möbel)
              </h2>
              <p>
                Verwende für Möbelbau <strong>Pappelsperrholz</strong> (oft mit CPL-Beschichtung, da
                kratzfest). Nutze Pocketholes oder Alu-Profile. Schrauben reißen bei Erschütterung sonst
                schnell aus.
              </p>

              <hr className="my-12 border-rule" />

              <h2 className={cn('mb-4 mt-12 text-2xl font-semibold text-ink md:text-2xl', outfit.className)}>
                8. Zulassung & Sicherheit
              </h2>
              <p>
                Um dein Fahrzeug als Wohnmobil zuzulassen, fordert der TÜV: Bett, Tisch, Sitzgelegenheit,
                Stauraum und einen fest verbauten Kocher.
              </p>

              <div className="warn-card warn-card-critical my-8">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn-critical text-xs font-bold text-paper"
                >
                  !
                </span>
                <p className="text-base font-semibold leading-relaxed text-warn-critical">
                  Achtung: Ein 3,5-Tonner darf max. 3.500 kg wiegen (inkl. Passagiere). Fahre VOR dem
                  endgültigen Möbelbau auf eine Waage!
                </p>
              </div>

              <hr className="my-12 border-rule" />

              <div className="mt-24 border border-rule bg-soot p-10 text-center text-paper shadow-lg md:p-14">
                <h3 className={cn('mb-4 text-2xl font-semibold text-paper md:text-2xl', outfit.className)}>
                  Bereit für den ersten Roadtrip?
                </h3>
                <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-paper/80 md:text-lg">
                  Der Ausbau kostet Schweiß, zerschnittene Finger und Nerven. Aber der Moment, in dem du
                  abends am Bergsee die Hecktüren öffnest und das Rauschen der Wellen hörst, ist unbezahlbar.
                </p>
                <Link
                  href="/guides/ausbau-fahrplan"
                  className="inline-flex min-h-12 items-center border border-paper bg-paper px-6 py-3 text-sm font-semibold text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-soot"
                >
                  Weiter zum Ausbau-Fahrplan →
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
