import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * components/seo/RechnerLeiste.tsx — die Schnellzugriffsleiste auf die
 * Einzelrechner (Batterie, Ladestrom, Solar, Spannungsfall, Heizlast, Dach).
 *
 * Warum als eigene Komponente: Dieselbe Leiste steht an mehreren Einstiegen
 * (Startseite, Themen-Hub `/camper-elektrik/`, Rechner-Übersicht `/rechner/`
 * und unter der Zeichenfläche des Planers). Fünf handgeschriebene
 * Verweislisten wären fünf Stellen, an denen ein neuer Rechner fehlt — und
 * fünf Stellen, an denen ein Verweis auf eine nicht ausgelieferte Adresse
 * stehen bleiben kann. Die Ziele stehen deshalb EINMAL hier; die Prüfung des
 * Exports (`scripts/seo/auditExport.ts`) hält sie gegen die ausgelieferten
 * Dateien.
 *
 * Kein Zustand, keine Client-Logik: Die Leiste ist statisches HTML wie der
 * Rest der Inhaltsseiten — sie funktioniert ohne JavaScript und ist für
 * Crawler im Roh-HTML sichtbar.
 *
 * Die Farb- und Rahmenklassen stammen aus der Markenebene (`rule`, `bone`,
 * `ink`), die in `app/globals.css` auf dieselben Werte zeigen wie die
 * Anwendungsebene (`border`, `surface-panel`, `foreground`) — die Leiste
 * sieht deshalb im Website-Rahmen und unter der Planer-Anwendung gleich aus.
 */

export type RechnerEintrag = {
  /** Zielseite des Rechners. */
  href: string;
  /** Anzeigename — kurz genug für eine Zeile auf dem Handy. */
  label: string;
  /** Ein Satz, was der Rechner beantwortet. */
  detail: string;
};

/** Die sechs Rechner, die den Weg von der Frage zur Zahl abkürzen. */
export const RECHNER_LEISTE: readonly RechnerEintrag[] = [
  {
    href: '/rechner/batteriekapazitaet/',
    label: 'Batteriekapazität',
    detail: 'Tagesbedarf, Autarkietage und Entladetiefe in Ah umrechnen.',
  },
  {
    href: '/rechner/ladestrom/',
    label: 'Ladestrom',
    detail: 'Booster-Strom aus Batteriekapazität, Fahrzeit und Lichtmaschine.',
  },
  {
    href: '/rechner/solaranlage/',
    label: 'Solaranlage',
    detail: 'Modulleistung und Panelanzahl aus Bedarf und Jahreszeit.',
  },
  {
    href: '/rechner/spannungsabfall-12v/',
    label: 'Spannungsabfall',
    detail: 'Bewerten, welche Spannung eine vorhandene Leitung verliert.',
  },
  {
    href: '/tools/heizung/',
    label: 'Heizlast',
    detail: 'Benötigte Heizleistung aus Fahrzeug, Dämmung und Wunschtemperatur.',
  },
  {
    href: '/tools/dach/',
    label: 'Dachbelegung',
    detail: 'Panels und Dachluken platzieren, Gesamtleistung ablesen.',
  },
];

/**
 * Darreichung der Leiste.
 *
 * `band` ist die volle Breite mit eigener Rahmenlinie — für Seitenebenen
 * (Startseite, Themen-Hub). `inline` ist die kompakte Schachtel für den
 * Einsatz innerhalb einer bestehenden Textspalte oder Anwendungsfläche.
 */
type Variante = 'band' | 'inline';

export function RechnerLeiste({
  variant = 'band',
  className,
  titelId = 'rechner-leiste-titel',
}: {
  variant?: Variante;
  className?: string;
  /** Eigene Kennung, wenn die Leiste mehrfach im selben Dokument steht. */
  titelId?: string;
}) {
  return (
    <section
      aria-labelledby={titelId}
      className={cn(variant === 'band' && 'border-y border-rule bg-bone', className)}
    >
      <div
        className={cn(
          'flex flex-col gap-3 md:flex-row md:items-center md:justify-between',
          variant === 'band' ? 'py-5' : 'border border-rule bg-bone px-5 py-4'
        )}
      >
        <div className="md:max-w-xs">
          <h2 id={titelId} className="panel-title">
            Direkt rechnen
          </h2>
          <p className="caption-xs mt-1 text-ink-soft">
            {/* Die Zahl kommt aus der Liste selbst — ein ausgeschriebenes „Fünf"
                wäre bei jedem neuen Rechner eine stille Falschaussage. */}
            {RECHNER_LEISTE.length} Rechner für die Fragen vor dem Plan — kostenlos, ohne Anmeldung.
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {RECHNER_LEISTE.map((rechner) => (
            <li key={rechner.href}>
              <Link
                href={rechner.href}
                className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                {rechner.label}
                {/*
                  Der Zusatz steht als Text im Verweis, nicht als `title`:
                  Ein Titel-Attribut erreicht weder Screenreader zuverlässig
                  noch Geräte ohne Maus. Für die Anzeige bleibt die Zeile
                  kompakt — die Erklärung steht auf dem Rechner selbst.
                */}
                <span className="sr-only"> — {rechner.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
