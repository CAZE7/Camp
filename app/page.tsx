import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarCheck, Calculator, Flame, Sun, Zap } from 'lucide-react';
import { metadataForPage } from '@/app/seoMetadata';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
import { RechnerLeiste } from '@/components/seo/RechnerLeiste';

/**
 * D-7 Startseite: bildfreier, typografischer Einstieg mit direkt erreichbaren
 * Werkzeugen, Rechnern und Leitfäden. Ein H1, klare technische Einordnung.
 */

export const metadata: Metadata = metadataForPage('/');

const TOOLS = [
  {
    title: 'Schaltplan',
    body: '12 V- und 230 V-Anlage zeichnen, verkabeln, Stückliste erzeugen.',
    href: '/planer',
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
  },
  {
    title: 'Ausbau-Fahrplan',
    body: 'Reihenfolge der Gewerke — was kommt wann?',
    href: '/guides/ausbau-fahrplan',
  },
  {
    title: 'Holzausbau (BEDMAS)',
    body: 'Sechs Schritte für den Möbelbau.',
    href: '/guides/holzausbau',
  },
  {
    title: 'Ausbau-Dokumentation',
    body: 'Der eigene Camper: Elektrik-Schritte, Tabelle, Rechenbeispiel.',
    href: '/camper-ausbau',
  },
  {
    title: 'Heizung & Dämmung',
    body: 'Heizlast, Dämmung und Heizsysteme — welche Leistung passt?',
    href: '/heizung-daemmung',
  },
  {
    title: 'Wohnmobilzulassung',
    body: 'TÜV, Schaltplan und Dokumente für die Abnahme.',
    href: '/wohnmobilzulassung',
  },
];

const PAGE_SECTIONS = [
  {
    title: 'Werkzeuge',
    detail: 'Schaltplan, Dachlayout und Heizlast',
    href: '#werkzeuge-heading',
  },
  {
    title: 'Rechner',
    detail: 'Schneller Zugriff auf Einzelrechner',
    href: '#rechner-leiste-titel',
  },
  {
    title: 'Guides',
    detail: 'Ausbau, Reihenfolge und Zulassung',
    href: '#guides-heading',
  },
];

export default function Home() {
  return (
    <div className="editorial-home flex min-h-screen flex-col pb-16 md:pb-0">
      <PageStructuredData path="/" />
      <SiteHeader />

      <main id="main" className="container-page w-full flex-1 px-4 pt-4 pb-24 md:px-5 md:pt-8 md:pb-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 md:gap-10">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
            <span className="editorial-kicker editorial-signal-badge px-2 py-1">CAMP // WERKSTATT</span>
            <span className="editorial-kicker text-ink-soft">ELEKTRIK · DACH · HEIZUNG</span>
          </header>

          <section className="editorial-paper-panel grid overflow-hidden rounded-xl lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
            <div className="p-5 md:p-8 lg:p-10">
              <p className="editorial-kicker mb-4 text-copper">TECHNISCHE PRAXIS // CAMPER-AUSBAU</p>
              <h1 className="editorial-headline max-w-3xl text-4xl text-ink md:text-5xl">
                Camper planen — erst der Plan, dann das Blech.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
                Dach, Elektrik, Heizung und Sicherheit an einem Ort. Werkzeuge und Guides helfen dir, den
                Camper-Ausbau strukturiert vorzubereiten.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                Rechnerwerte unterstützen die Vorbereitung; fachliche Prüfung und Abnahme bleiben separat.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/planer"
                  className="editorial-signal-badge inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                >
                  Schaltplan starten
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/guides/ausbau-fahrplan"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                >
                  Erst den Fahrplan lesen
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <p className="caption-xs mt-4 text-ink-soft">
                Empfohlene Reihenfolge: Fahrplan lesen → Dach planen → Schaltplan zeichnen → Heizlast prüfen.
              </p>
            </div>

            <nav
              className="editorial-hero-index border-t border-rule p-5 md:p-7 lg:border-t-0 lg:border-l"
              aria-label="Inhaltsverzeichnis der Startseite"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="editorial-kicker text-ink-soft">AUF DIESER SEITE</p>
                <span className="editorial-kicker editorial-signal-ink">01—03</span>
              </div>
              <ol>
                {PAGE_SECTIONS.map((section, index) => (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      className="editorial-index-link group flex min-h-16 items-center gap-3 border-b border-rule py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                    >
                      <span className="editorial-index-number flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{section.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                          {section.detail}
                        </span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-copper transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="editorial-quote mt-5 p-3 text-sm leading-relaxed text-ink">
                Erst den Ablauf klären. Dann die passenden Werkzeuge auswählen.
              </p>
            </nav>
          </section>

          <section aria-labelledby="werkzeuge-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="editorial-kicker text-copper">DIREKTZUGRIFF // WERKZEUGE</p>
                <h2 id="werkzeuge-heading" className="editorial-headline mt-1 text-2xl text-ink">
                  Fokus-Themen
                </h2>
              </div>
              <span className="editorial-kicker text-ink-soft">PLANEN · RECHNEN · DOKUMENTIEREN</span>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <li key={tool.href}>
                    <Link
                      href={tool.href}
                      className="editorial-story-card group flex h-full min-h-44 flex-col justify-between gap-4 rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                      {...(tool.recommended ? { 'data-recommended': 'true' } : {})}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`editorial-icon-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                              tool.primary ? 'editorial-icon-tile--signal' : ''
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="text-sm font-semibold text-ink">{tool.title}</span>
                          {tool.recommended && (
                            <span className="editorial-kicker editorial-signal-badge ml-auto px-1.5 py-1 text-[0.625rem]">
                              Starte hier
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{tool.body}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-copper">
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

          <RechnerLeiste variant="inline" className="editorial-rechner-panel overflow-hidden rounded-xl" />

          <section
            aria-labelledby="guides-heading"
            className="grid gap-5 md:grid-cols-[minmax(13rem,0.65fr)_minmax(0,1.35fr)] md:gap-10"
          >
            <div className="md:pt-2">
              <p className="editorial-kicker text-copper">LESESTOFF // ANLEITUNGEN</p>
              <h2 id="guides-heading" className="editorial-headline mt-1 text-2xl text-ink">
                Wissen für den Ausbau
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
                Leitfäden zu Reihenfolge, Ausbau, Heizung und Zulassung.
              </p>
              <span className="editorial-kicker mt-4 inline-flex text-ink-soft">{GUIDES.length} GUIDES</span>
            </div>
            <ol className="editorial-guide-list border-y border-rule">
              {GUIDES.map((guide, index) => (
                <li key={guide.href}>
                  <Link
                    href={guide.href}
                    className="editorial-guide-row group flex min-h-20 items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                  >
                    <span className="editorial-guide-number w-8 shrink-0 text-sm">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="editorial-headline block text-lg text-ink">{guide.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{guide.body}</span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-copper transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section className="editorial-dark-panel grid gap-5 rounded-xl p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-7">
            <div>
              <p className="editorial-kicker editorial-signal-ink">WERKZEUG // SCHALTPLAN</p>
              <h2 className="editorial-headline mt-2 text-2xl">Vom Überblick zum eigenen Schaltplan.</h2>
              <p className="editorial-dark-panel__copy mt-2 max-w-2xl text-sm leading-relaxed">
                Bauteile verbinden, Angaben strukturieren und den Plan dokumentieren. Vor dem Einbau bleibt
                eine fachliche Prüfung wichtig.
              </p>
            </div>
            <Link
              href="/planer"
              className="editorial-signal-badge inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
            >
              Planer öffnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </main>

      <SiteFooter />

      <nav
        className="editorial-bottom-nav fixed inset-x-0 bottom-0 z-50 md:hidden"
        aria-label="Schnellnavigation"
      >
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          <Link
            href="/"
            aria-current="page"
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] leading-none"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Magazin</span>
          </Link>
          <Link
            href="/camper-elektrik"
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] leading-none"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span>Elektrik</span>
          </Link>
          <Link
            href="/tools/dach"
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] leading-none"
          >
            <Sun className="h-4 w-4" aria-hidden="true" />
            <span>Dach</span>
          </Link>
          <Link
            href="/rechner"
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] leading-none"
          >
            <Calculator className="h-4 w-4" aria-hidden="true" />
            <span>Rechner</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
