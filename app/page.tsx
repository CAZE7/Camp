import Link from 'next/link';
import { ArrowRight, CalendarCheck, Flame, Map as MapIcon, Sun, Zap } from 'lucide-react';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

/**
 * D-7 Startseite: Hero mit klarem Nutzenversprechen, die drei Werkzeuge
 * (Elektrik/Dach/Heizung) plus Fahrplan im selben Card-System, darunter
 * die Guide-Teaser. Ein H1, konsistente CTAs, einheitliche Sektionen.
 */

const TOOLS = [
  {
    title: 'Schaltplan',
    body: '12 V- und 230 V-Anlage zeichnen, verkabeln, Stückliste erzeugen.',
    href: '/elektrik-planung',
    icon: Zap,
    cta: 'Planer öffnen',
    primary: true,
  },
  {
    title: 'Dach-Planer',
    body: 'Solarpanels und Dachluken auf dem Fahrzeug platzieren, Gesamt-Watt ablesen.',
    href: '/tools/dach',
    icon: Sun,
    cta: 'Dach planen',
  },
  {
    title: 'Heizlast',
    body: 'Benötigte Heizleistung aus Fahrzeug, Dämmung und Wunschtemperatur.',
    href: '/tools/heizung',
    icon: Flame,
    cta: 'Heizlast prüfen',
  },
  {
    title: 'Ausbau-Fahrplan',
    body: 'Reihenfolge und Meilensteine für den Ausbau. Starte hier, wenn du keinen Plan hast.',
    href: '/guides/ausbau-fahrplan',
    icon: CalendarCheck,
    cta: 'Fahrplan lesen',
    recommended: true,
  },
];

const GUIDES = [
  {
    title: 'Camper-Ausbauguide',
    body: 'Wissen: Karosserie, Dämmung, Elektrik, TÜV.',
    href: '/guides/camper-ausbauguide',
    icon: MapIcon,
  },
  {
    title: 'Ausbau-Fahrplan',
    body: 'Reihenfolge der Gewerke — was kommt wann?',
    href: '/guides/ausbau-fahrplan',
    icon: CalendarCheck,
  },
  {
    title: 'Holzausbau (BEDMAS)',
    body: 'Sechs Schritte für den Möbelbau.',
    href: '/guides/holzausbau',
    icon: MapIcon,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />

      <main id="main" className="container-page flex-1">
        {/* Hero — ein H1, ein Nutzenversprechen, ein primärer CTA */}
        <section className="prose-measure">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-2xl">
            Camper planen — erst der Plan, dann das Blech.
          </h1>
          <p className="mt-3 text-base text-ink-soft">
            Dach, Elektrik, Heizung und Sicherheit an einem Ort. Für Heimwerker ohne Fachwissen — mit Zahlen,
            die auch für den TÜV funktionieren.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/elektrik-planung"
              className="inline-flex min-h-11 items-center gap-2 bg-oxide px-4 py-2 text-sm font-medium text-on-signal transition-colors hover:bg-oxide/90"
            >
              Schaltplan starten
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/guides/ausbau-fahrplan"
              className="inline-flex min-h-11 items-center border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
            >
              Erst den Fahrplan lesen
            </Link>
          </div>
          <p className="caption-xs mt-4 text-ink-soft">
            Empfohlene Reihenfolge: Fahrplan lesen → Dach planen → Schaltplan zeichnen → Heizlast prüfen.
          </p>
        </section>

        {/* Werkzeuge — drei Karten im selben Card-System + Fahrplan */}
        <section aria-labelledby="werkzeuge-heading" className="mt-12">
          <h2 id="werkzeuge-heading" className="panel-title">
            Werkzeuge
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="node-card group flex h-full flex-col justify-between gap-4 p-4 hover:bg-surface-hover focus-visible:outline-none"
                    {...(tool.recommended ? { 'data-recommended': 'true' } : {})}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center border border-rule text-ink">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="font-medium text-ink">{tool.title}</span>
                        {tool.recommended && (
                          <span className="caption-xs ml-auto inline-flex items-center border border-rule px-2 py-0.5 font-semibold uppercase tracking-wider text-copper">
                            Starte hier
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-ink-soft">{tool.body}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-copper">
                      {tool.cta}
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Guides — Teaser im selben Raster */}
        <section aria-labelledby="guides-heading" className="mt-12">
          <h2 id="guides-heading" className="panel-title">
            Guides
          </h2>
          <ul className="mt-3 divide-y divide-rule border border-rule bg-bone">
            {GUIDES.map((guide) => {
              const Icon = guide.icon;
              return (
                <li key={guide.href}>
                  <Link
                    href={guide.href}
                    className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 text-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-oxide"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                      <div>
                        <div className="font-medium text-ink">{guide.title}</div>
                        <p className="caption-xs mt-0.5 text-ink-soft">{guide.body}</p>
                      </div>
                    </div>
                    <span aria-hidden="true" className="text-copper">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
