import Link from 'next/link';

import { pageByPath } from '@/lib/seo/inventory';

/**
 * app/tools/dach/DachErklaerung.tsx — der erklärende Text unter dem Werkzeug.
 *
 * Warum der Text ausgerechnet hier steht: Der Dach-Planer war bis jetzt ein
 * reines Werkzeug — Bedienung oben, Zahlen in der Kopfzeile, sonst nichts.
 * Als eigene Route hat die Seite damit zwar einen Titel und eine Beschreibung,
 * aber keinen eigenen Text: Für Suchmaschinen und für Menschen, die erst
 * verstehen wollen, was die Zahl „400 W" bedeutet, fehlte die Erklärung.
 *
 * Der Block ist Teil der Werkzeugseite (im `main`, unterhalb der Werkfläche)
 * und redet über genau das, was das Werkzeug tut — nicht über Dachplanung im
 * Allgemeinen. Jede Zahl im Text ist aus dem Werkzeug abgeleitet: die
 * Fahrzeugmaße aus `lib/vehicleTemplates.ts`, die Sicherheitsränder aus
 * `app/tools/dach/validation.ts`, die Panelmaße aus der Seitenleiste.
 *
 * Er bleibt bewusst kurz genug, um nicht die Werkfläche zu verdrängen: Die
 * Zeichenfläche behält ihre Mindesthöhe, der Text steht darunter.
 */

const SEITE = pageByPath('/tools/dach/');

export function DachErklaerung() {
  return (
    <section aria-labelledby="dach-erklaerung" className="w-full border-t border-rule bg-paper">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 md:py-12">
        <p className="label-eyebrow text-copper">Werkzeug erklärt</p>
        <h2 id="dach-erklaerung" className="mt-2 font-display text-xl font-semibold text-ink">
          Der Dach-Planer: Fläche, Belegung und Solarleistung
        </h2>

        <div className="mt-4 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Der Dach-Planer beantwortet eine Frage, die auf dem Papier schnell falsch beantwortet ist: Passt
            die Kombination aus Solarpanels, Dachluke und Kabeldurchlass überhaupt auf das Dach meines
            Fahrzeugs — und wie viel Leistung kommt dabei heraus? Du arbeitest auf der maßstäblichen
            Dachfläche deines Fahrzeugs, setzt Module und Dachfenster darauf, siehst sofort, ob die Belegung
            den Sicherheitsbereich einhält, und liest die Gesamtleistung in Watt ab.
          </p>
          <p>
            Was der Planer <em>nicht</em> kann: die Statik deines Fahrzeugs prüfen, entscheiden, ob ein
            Kabeldurchlass an der richtigen Stelle sitzt, oder die tatsächliche Leistung des Panels unter den
            Bedingungen deines Stellplatzes. Er ist die Flächen- und Mengenrechnung. Die Montageentscheidung
            bleibt bei dir.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">So planst du in drei Schritten</h3>
        <ol className="mt-3 space-y-2 pl-5 text-md text-ink-soft">
          <li>
            <span className="font-medium text-ink">Fahrzeug wählen.</span> Die nutzbare Dachfläche wechselt
            mit dem Modell. Für den Ducato L1H1 sind es 140 × 267 cm, für den Sprinter L1 135 × 260 cm.
          </li>
          <li>
            <span className="font-medium text-ink">Panels und Dachfenster setzen.</span> Ziehen oder „Aufs
            Dach" tippen. Größe und Wattzahl änderst du danach am ausgewählten Element.
          </li>
          <li>
            <span className="font-medium text-ink">Belegung prüfen, Watt ablesen.</span> Die Summe oben rechts
            ist die Nennleistung deiner Belegung — sie ist die Vorgabe für Laderegler und Flächenbedarf im
            Schaltplan.
          </li>
        </ol>

        <h3 className="mt-8 text-lg font-semibold text-ink">Fläche, Panel-Watt und was die Summe bedeutet</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Ein Standardmodul aus der Seitenleiste hat 200 W und 100 × 60 cm Fläche. Auf 140 cm Breite ist
            damit nur Platz für eine Reihe: Zwei Module nebeneinander brauchen 200 cm und passen in einen
            Ducato-Dach nicht. In der Länge ist mehr Luft — nach den Sicherheitsrändern bleiben rund 247 cm,
            in die zwei Module in Reihe passen.
          </p>
          <p>
            Die Wattzahl ist eine Nennleistung unter Testbedingungen. Was daraus im Jahr wird, hängt von
            Einstrahlung, Ausrichtung, Neigung, Temperatur und Verschmutzung ab. Der Planer rechnet mit der
            Nennleistung, weil das die Zahl ist, die auch auf dem Datenblatt steht — er rechnet bewusst keine
            Ertragsprognose.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">Praxisbeispiel: zwei Module, ein Fenster</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Zwei Module mit je 200 W und ein Dachfenster (40 × 40 cm) auf einem Ducato L1H1: Die Module liegen
            in Reihe (200 × 60 cm), das Fenster dahinter. Der Sicherheitsbereich — 15 cm vorn, je 5 cm an den
            Seiten und hinten — bleibt frei, die Anzeige bestätigt „Alle Elemente liegen sicher und ohne
            Überlappung in der Safe Zone&quot;.
          </p>
          <p>
            Dasselbe Fenster passt <em>neben</em> einem 100-cm-Modul nicht: Neben dem Modul bleiben nach den
            Rändern nur 30 cm, das Dachfenster braucht 40 cm. Genau solche Fälle zeigt der Planer, bevor du
            ein Panel gekauft hast.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">Grenzen des Modells</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-md text-ink-soft">
          <li>
            Kein Statiknachweis: Gewicht, Windlast und die Art der Befestigung (Klebebefestigung, Schrauben,
            Ballastierung) sind nicht Teil der Rechnung.
          </li>
          <li>
            Der Sicherheitsbereich ist eine Faustregel für die Belegung, keine Herstellerfreigabe und keine
            Garantie für die Dichtheit.
          </li>
          <li>
            Kabelwege, Durchdringungen und die Länge bis zum Laderegler zeigt der Planer nicht — er rechnet
            Flächen, keine Leitungen.
          </li>
        </ul>

        <h3 className="mt-8 text-lg font-semibold text-ink">Weiter im Schaltplan</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Die gefundene Wattzahl ist eine Eingabe, kein Ergebnis: Sie bestimmt Laderegler, Solarmanagement
            und den Flächenbedarf der Module im Schaltplan. Der Reihenfolge des Ausbaus stehen im{' '}
            <Link
              href="/guides/ausbau-fahrplan/"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Ausbau-Fahrplan
            </Link>
            , die Frage nach der elektrischen Seite beantwortet der{' '}
            <Link
              href="/camper-elektrik/"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Elektrik-Hub
            </Link>
            . Wenn aus dem Dach erst einmal ein Raum werden soll, helfen der{' '}
            <Link
              href="/guides/holzausbau/"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Holzausbau
            </Link>{' '}
            und der{' '}
            <Link
              href="/guides/camper-ausbauguide/"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Camper-Ausbauguide
            </Link>
            .
          </p>
        </div>

        {SEITE?.contentRevision && (
          <p className="mt-8 text-sm text-ink-soft">Inhaltlicher Stand: {SEITE.contentRevision}.</p>
        )}
      </div>
    </section>
  );
}
