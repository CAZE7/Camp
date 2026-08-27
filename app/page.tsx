import Link from 'next/link';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

const TOOLS = [
  {
    title: 'Ausbau-Fahrplan',
    body: 'Reihenfolge und Meilensteine für den Ausbau. Starte hier, wenn du keinen Plan hast.',
    href: '/guides/ausbau-fahrplan',
    recommended: true,
  },
  {
    title: 'Dach-Planer',
    body: 'Solarpanels und Dachluken auf dem Fahrzeug platzieren, Gesamt-Watt ablesen.',
    href: '/tools/dach',
  },
  {
    title: 'Schaltplan',
    body: '12 V- und 230 V-Anlage zeichnen, verkabeln, Stückliste erzeugen.',
    href: '/elektrik-planung',
  },
  {
    title: 'Heizlast',
    body: 'Benötigte Heizleistung aus Fahrzeug, Dämmung und Wunschtemperatur.',
    href: '/tools/heizung',
  },
  {
    title: 'KI-Assistent',
    body: 'Fragen zu Normen, Querschnitt und Ausbau — mit Sicherheits-Check der Stückliste.',
    href: '/ki-assistent',
  },
];

const GUIDES = [
  {
    title: 'Camper-Ausbauguide',
    body: 'Wissen: Karosserie, Dämmung, Elektrik, TÜV.',
    href: '/guides/camper-ausbauguide',
  },
  {
    title: 'Ausbau-Fahrplan',
    body: 'Reihenfolge der Gewerke — was kommt wann?',
    href: '/guides/ausbau-fahrplan',
  },
  { title: 'Holzausbau (BEDMAS)', body: 'Sechs Schritte für den Möbelbau.', href: '/guides/holzausbau' },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 md:py-16">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-ink">
          Camper planen — erst der Plan, dann das Blech.
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-soft">
          Dach, Elektrik, Heizung und Sicherheit an einem Ort. Für Heimwerker ohne Fachwissen — mit Zahlen,
          die auch für den TÜV funktionieren.
        </p>
        <p className="caption-xs mt-4 text-ink-soft">
          Empfohlene Reihenfolge: Fahrplan lesen → Dach planen → Schaltplan zeichnen → Heizlast prüfen → KI
          fragen.
        </p>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-ink-soft">Werkzeuge</h2>
        <ul className="mt-3 divide-y divide-rule border border-rule bg-bone">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="flex min-h-16 items-center justify-between gap-6 px-5 py-4 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{tool.title}</span>
                    {tool.recommended && (
                      <span className="caption-xs inline-flex items-center rounded-full border border-copper/40 bg-paper px-2 py-0.5 font-semibold uppercase tracking-wider text-copper">
                        Starte hier
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">{tool.body}</p>
                </div>
                <span aria-hidden="true" className="shrink-0 text-sm font-medium text-ink">
                  Öffnen →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-sm font-semibold uppercase tracking-widest text-ink-soft">Guides</h2>
        <ul className="mt-3 divide-y divide-rule border border-rule bg-bone">
          {GUIDES.map((guide) => (
            <li key={guide.href}>
              <Link
                href={guide.href}
                className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset"
              >
                <div>
                  <div className="font-medium text-ink">{guide.title}</div>
                  <p className="caption-xs mt-0.5 text-ink-soft">{guide.body}</p>
                </div>
                <span aria-hidden="true" className="text-copper">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
