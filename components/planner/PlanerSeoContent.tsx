import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { RechnerLeiste } from '@/components/seo/RechnerLeiste';
import { pageByPath } from '@/lib/seo/inventory';

import { PLANER_FAQ, PLANER_FUNKTIONEN, PLANER_SCHRITTE } from './planerSeoContent';
import { PLANNER_TEMPLATES } from './templates';

/**
 * Name der Seite in der sichtbaren Brotkrume — aus dem Seiteninventar
 * (`lib/seo/inventory.ts`), nicht als zweite Zeichenkette. Die Exportprüfung
 * vergleicht die sichtbare Brotkrume mit dem Inventar; zwei Schreibweisen
 * derselben Überschrift wären genau der Fall, den sie melden würde.
 */
const PLANER_SEITE = pageByPath('/planer/');
if (!PLANER_SEITE) throw new Error('Route "/planer/" fehlt im SEO-Inventar.');

/** Name der aktuellen Seite in der sichtbaren Brotkrume. */
const PLANER_BROTKRUME = PLANER_SEITE.h1;

/**
 * Die vier Wissensseiten, die zu den Fragen unter der Zeichenfläche passen.
 * Jeder Eintrag nennt die Frage als Ankertext; das Ziel steht als Pfad aus
 * derselben Ordnung wie das Seiteninventar (`/camper-elektrik/…`).
 */
const PLANER_WISSENSLINKS: readonly { href: string; label: string; description?: string }[] = [
  {
    href: '/camper-elektrik/kabelquerschnitt/',
    label: 'Kabelquerschnitt im Camper richtig wählen',
    description: 'warum Strom und Länge gemeinsam den Querschnitt bestimmen.',
  },
  {
    href: '/camper-elektrik/sicherungen/',
    label: 'Sicherungen und Schutzorgane im 12-V-Kreis',
    description: 'welche Sicherung zu welcher Leitung gehört — und wo sie sitzt.',
  },
  {
    href: '/camper-elektrik/ladebooster/',
    label: 'Ladebooster im Camper auslegen',
    description: 'Ladung aus der Lichtmaschine: Trennrelais oder DC-DC, 30 A oder 50 A.',
  },
  {
    href: '/camper-elektrik/schaltplan/',
    label: 'Camper-Schaltplan aufbauen und prüfen',
    description: 'die Reihenfolge vom Batteriepol bis zum Verbraucher.',
  },
];

/**
 * Statischer Inhalt unterhalb des Planers auf `/planer/` (siehe
 * `planerSeoContent.ts` für das Warum).
 *
 * Bewusst eine Server-Komponente ohne Zustand: Der Text steht im
 * ausgelieferten HTML, bevor irgendein JavaScript läuft — für Crawler,
 * für Besucher ohne JavaScript und für alle, die unter der Anwendung
 * weiterlesen wollen. Die Anwendung selbst füllt den ersten Bildschirm;
 * dieser Teil beginnt erst darunter und nimmt ihr keine Höhe weg.
 */
export function PlanerSeoContent() {
  return (
    <div className="border-t border-border bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12 sm:px-6">
        {/* Sichtbare Entsprechung der BreadcrumbList im JSON-LD — die
            Exportprüfung verlangt, dass Schema und Anzeige übereinstimmen. */}
        <nav aria-label="Pfad">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="underline-offset-2 hover:text-foreground hover:underline">
                Startseite
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              {PLANER_BROTKRUME}
            </li>
          </ol>
        </nav>

        <section aria-labelledby="planer-anleitung-titel">
          <h2 id="planer-anleitung-titel" className="font-display text-2xl font-semibold tracking-tight">
            Camper-Schaltplan online zeichnen — so funktioniert der Elektroplaner
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
            Ein kostenloses Programm für den Camper-Schaltplan ist dieser Elektroplaner: Er zeichnet die
            komplette 12V- und 24V-Anlage deines Campers als Schaltplan und rechnet dabei elektrisch mit. Jede
            Leitung bekommt ihren Kabelquerschnitt aus Spannungsabfall und Strombelastbarkeit, jede Quelle
            ihre Sicherung, jede Batterie ihre Energiebilanz. Ohne Konto, ohne Installation, ohne Download —
            der Plan bleibt lokal in deinem Browser.
          </p>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {PLANER_SCHRITTE.map((schritt, index) => (
              <li key={schritt.titel} className="border border-border bg-surface-panel p-4">
                <p className="text-sm font-semibold text-muted-foreground">Schritt {index + 1}</p>
                <h3 className="mt-1 font-semibold">{schritt.titel}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{schritt.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="planer-funktionen-titel">
          <h2 id="planer-funktionen-titel" className="font-display text-xl font-semibold tracking-tight">
            Was der Planer berechnet und zeichnet
          </h2>
          <ul className="mt-4 grid gap-x-8 gap-y-2 md:grid-cols-2">
            {PLANER_FUNKTIONEN.map((funktion) => (
              <li key={funktion} className="border-t border-border pt-2 text-sm leading-relaxed">
                {funktion}
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Herleitung, Normgrenzen und Einzelrechner zu Querschnitt, Batteriekapazität und Solar stehen auf
            der Seite{' '}
            <Link href="/elektrik-planung/" className="underline underline-offset-2 hover:text-foreground">
              Camper-Elektrik berechnen
            </Link>{' '}
            — der Planer oben wendet dieselben Regeln auf die ganze Anlage an.
          </p>
          {/*
            Vier Verweise in die Wissensseiten des Themas. Sie sind nicht
            Zierde: Die Linkgraph-Prüfung (`planner-ohne-wissenslink`) verlangt,
            dass die Planer-Seite kontextuell in das Cluster führt, und die
            Ankertexte benennen jeweils die Frage, die dort beantwortet wird —
            nicht „hier klicken".
          */}
          <ul className="mt-6 grid gap-x-8 gap-y-2 md:grid-cols-2">
            {PLANER_WISSENSLINKS.map((eintrag) => (
              <li key={eintrag.href} className="border-t border-border pt-2 text-sm leading-relaxed">
                <Link href={eintrag.href} className="font-medium underline underline-offset-2">
                  {eintrag.label}
                </Link>
                {eintrag.description && (
                  <span className="text-muted-foreground"> — {eintrag.description}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="planer-vorlagen-titel">
          <h2 id="planer-vorlagen-titel" className="font-display text-xl font-semibold tracking-tight">
            Nicht mit leerer Fläche starten: Vorlagen laden
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
            Beim ersten Besuch liegt das klassische Kastenwagen-Setup bereits verkabelt auf der Zeichenfläche.
            Die drei Ausbaustufen laden per Klick — auch direkt aus dem Ratgeber heraus:
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PLANNER_TEMPLATES.map((template) => (
              <article key={template.id} className="border border-border bg-surface-panel p-4">
                <h3 className="font-semibold">{template.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{template.description}</p>
                <Link
                  href={template.href}
                  className="mt-3 inline-block text-sm font-medium underline underline-offset-2 hover:text-muted-foreground"
                >
                  {template.label} im Planer öffnen
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="planer-rechner-titel">
          <h2 id="planer-rechner-titel" className="font-display text-xl font-semibold tracking-tight">
            Erst rechnen, dann zeichnen
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
            Nicht jede Frage braucht einen ganzen Schaltplan. Die fünf Einzelrechner beantworten die Größen,
            die in den Plan hineingehen — und der Planer prüft danach dieselben Werte im Zusammenhang.
          </p>
          <div className="mt-5">
            <RechnerLeiste variant="inline" titelId="planer-rechner-leiste-titel" />
          </div>
        </section>

        <section aria-labelledby="planer-faq-titel">
          <h2 id="planer-faq-titel" className="font-display text-xl font-semibold tracking-tight">
            Häufige Fragen zum Camper-Schaltplan
          </h2>
          <div className="mt-4 divide-y divide-border border border-border">
            {PLANER_FAQ.map((entry) => (
              <details key={entry.question} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-medium transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span>{entry.question}</span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{entry.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
