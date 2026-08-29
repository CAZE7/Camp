import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/', label: 'Startseite' },
  { href: '/guides/ausbau-fahrplan', label: 'Ausbau-Fahrplan' },
  { href: '/impressum', label: 'Impressum' },
  { href: '/datenschutz', label: 'Datenschutz' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper" role="contentinfo">
      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Werft</p>
            <p className="caption-xs mt-1 text-ink-soft">Erst der Plan. Dann das Blech.</p>
          </div>
          <nav aria-label="Fußnavigation">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="caption-xs mt-6 text-ink-soft">
          Werft ersetzt keine Elektrofachkraft. Alle Berechnungen sind Näherungen — für Landstrom-Anlagen (230
          V) ist eine Abnahme nach DIN VDE 0100-721 durch eine qualifizierte Person Pflicht.
        </p>
      </div>
    </footer>
  );
}
