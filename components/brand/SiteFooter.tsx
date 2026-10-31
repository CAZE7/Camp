import Link from 'next/link';

import { Mark } from './Mark';

/**
 * Fußnavigation: die zweite Verbindung zwischen den Bereichen.
 *
 * Vorher standen sieben Ziele in einer Zeile — auf dem Handy ein Umbruch, auf
 * dem Tisch eine Aufzählung ohne Ordnung. Jetzt stehen sie in vier Spalten
 * (Werkzeuge, Wissen, Rechner, Über uns), jede mit eigener Überschrift: Wer
 * sucht, liest die Spalte, nicht die Liste.
 *
 * Die Ziele sind dieselben geblieben, damit kein Verweis verlorengeht: Jede
 * Seite der Auslieferung wird von hier und/oder aus dem Inhalt erreicht — eine
 * SEO-Seite ohne eingehenden Verweis kann so nicht entstehen (Wächter:
 * `scripts/seo/auditExport.ts`).
 */
const FOOTER_COLUMNS = [
  {
    title: 'Werkzeuge',
    links: [
      { href: '/planer/', label: 'Schaltplan' },
      { href: '/tools/dach/', label: 'Dach-Planer' },
      { href: '/tools/heizung/', label: 'Heizlast' },
      { href: '/elektrik-planung/', label: 'Elektro-Rechner' },
    ],
  },
  {
    title: 'Wissen',
    links: [
      { href: '/camper-elektrik/', label: 'Camper-Elektrik' },
      { href: '/guides/', label: 'Guides' },
      { href: '/camper-ausbau/', label: 'Ausbau dokumentieren' },
      { href: '/heizung-daemmung/', label: 'Heizung & Dämmung' },
      { href: '/wohnmobilzulassung/', label: 'Wohnmobilzulassung' },
    ],
  },
  {
    title: 'Rechner',
    links: [
      { href: '/rechner/', label: 'Alle Rechner' },
      { href: '/rechner/batteriekapazitaet/', label: 'Batteriekapazität' },
      { href: '/rechner/solaranlage/', label: 'Solaranlage' },
      { href: '/rechner/spannungsabfall-12v/', label: 'Spannungsabfall' },
    ],
  },
  {
    title: 'Über uns',
    links: [
      { href: '/ueber-elektroplaner/', label: 'Über Elektroplaner' },
      { href: '/impressum/', label: 'Impressum' },
      { href: '/datenschutz/', label: 'Datenschutz' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper" role="contentinfo">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <Mark />
            <p className="caption-xs mt-1 text-ink-soft">Erst der Plan. Dann das Blech.</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
              Werkstatt für den Camper-Ausbau: Schaltplan, Dachbelegung, Heizlast und die Reihenfolge der
              Gewerke — ohne Konto, im Browser gespeichert.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={`Fußnavigation ${column.title}`}>
              <p className="panel-title border-b border-rule pb-2">{column.title}</p>
              <ul className="mt-2 flex flex-col">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center text-sm text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="caption-xs mt-8 border-t border-rule pt-4 text-ink-soft">
          Elektroplaner ersetzt keine Elektrofachkraft. Alle Berechnungen sind Näherungen — für
          Landstrom-Anlagen (230 V) ist eine Abnahme nach DIN VDE 0100-721 durch eine qualifizierte Person
          Pflicht.
        </p>
      </div>
    </footer>
  );
}
