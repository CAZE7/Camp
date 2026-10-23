import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarCheck, Calculator, Flame, Sun, Zap } from 'lucide-react';
import { metadataForPage } from '@/app/seoMetadata';
import { PageShell } from '@/components/brand/PageShell';
import { buttonVariants } from '@/components/ui/button';
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
    <PageShell
      variant="article"
      className="pb-16 md:pb-0"
      mainClassName="container-page w-full px-4 pt-4 pb-24 md:px-5 md:pt-8 md:pb-12"
      bottomNav={
        <nav
          className="fixed inset-x-0 bottom-0 z-chrome border-t border-rule bg-surface-panel md:hidden"
          aria-label="Schnellnavigation"
        >
          <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
            <Link
              href="/"
              aria-current="page"
              className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-xs leading-none"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>Magazin</span>
            </Link>
            <Link
              href="/camper-elektrik"
              className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-xs leading-none"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              <span>Elektrik</span>
            </Link>
            <Link
              href="/tools/dach"
              className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-xs leading-none"
            >
              <Sun className="h-4 w-4" aria-hidden="true" />
              <span>Dach</span>
            </Link>
            <Link
              href="/rechner"
              className="flex h-full flex-1 flex-col items-center justify-center gap-1 px-1 text-xs leading-none"
            >
              <Calculator className="h-4 w-4" aria-hidden="true" />
              <span>Rechner</span>
            </Link>
          </div>
        </nav>
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 md:gap-10">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
          <span className="panel-title border border-rule px-2 py-1">CAMP // WERKSTATT</span>
          <span className="panel-title">ELEKTRIK · DACH · HEIZUNG</span>
        </header>

        <section className="grid overflow-hidden rounded border border-rule bg-surface-panel lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
          <div className="p-5 md:p-8 lg:p-10">
            <p className="kicker mb-4">TECHNISCHE PRAXIS // CAMPER-AUSBAU</p>
            <h1 className="h1 max-w-3xl">Camper planen — erst der Plan, dann das Blech.</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
              Dach, Elektrik, Heizung und Sicherheit an einem Ort. Werkzeuge und Guides helfen dir, den
              Camper-Ausbau strukturiert vorzubereiten.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Rechnerwerte unterstützen die Vorbereitung; fachliche Prüfung und Abnahme bleiben separat.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/planer" className={buttonVariants({ variant: 'default' })}>
                Schaltplan starten
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/guides/ausbau-fahrplan" className={buttonVariants({ variant: 'outline' })}>
                Erst den Fahrplan lesen
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="caption-xs mt-4 text-ink-soft">
              Empfohlene Reihenfolge: Fahrplan lesen → Dach planen → Schaltplan zeichnen → Heizlast prüfen.
            </p>
          </div>

          <nav
            className="border-t border-rule p-5 md:p-7 lg:border-t-0 lg:border-l"
            aria-label="Inhaltsverzeichnis der Startseite"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="panel-title">AUF DIESER SEITE</p>
              <span className="panel-title">01—03</span>
            </div>
            <ol>
              {PAGE_SECTIONS.map((section, index) => (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    className="group flex min-h-16 items-center gap-3 border-b border-rule py-3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-rule bg-surface-raised text-xs font-semibold text-ink">
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
            <p className="mt-5 rounded border border-rule bg-surface-raised p-3 text-sm leading-relaxed text-ink">
              Erst den Ablauf klären. Dann die passenden Werkzeuge auswählen.
            </p>
          </nav>
        </section>

        <section aria-labelledby="werkzeuge-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="kicker">DIREKTZUGRIFF // WERKZEUGE</p>
              <h2 id="werkzeuge-heading" className="h2 mt-1">
                Fokus-Themen
              </h2>
            </div>
            <span className="panel-title">PLANEN · RECHNEN · DOKUMENTIEREN</span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="node-card group flex h-full min-h-44 flex-col justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                    {...(tool.recommended ? { 'data-recommended': 'true' } : {})}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border border-rule text-ink ${
                            tool.primary ? 'border-oxide text-oxide' : ''
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold text-ink">{tool.title}</span>
                        {tool.recommended && (
                          <span className="panel-title ml-auto border border-oxide/40 px-1.5 py-1 text-oxide">
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

        <RechnerLeiste variant="inline" className="overflow-hidden rounded" />

        <section
          aria-labelledby="guides-heading"
          className="grid gap-5 md:grid-cols-[minmax(13rem,0.65fr)_minmax(0,1.35fr)] md:gap-10"
        >
          <div className="md:pt-2">
            <p className="kicker">LESESTOFF // ANLEITUNGEN</p>
            <h2 id="guides-heading" className="h2 mt-1">
              Wissen für den Ausbau
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
              Leitfäden zu Reihenfolge, Ausbau, Heizung und Zulassung.
            </p>
            <span className="panel-title mt-4 inline-flex">{GUIDES.length} GUIDES</span>
          </div>
          <ol className="border-y border-rule">
            {GUIDES.map((guide, index) => (
              <li key={guide.href}>
                <Link
                  href={guide.href}
                  className="group flex min-h-20 items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                >
                  <span className="w-8 shrink-0 text-xs font-semibold text-oxide">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-md font-semibold text-ink">{guide.title}</span>
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

        <section className="grid gap-5 rounded border border-rule bg-soot p-5 text-paper md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-7">
          <div>
            <p className="panel-title">WERKZEUG // SCHALTPLAN</p>
            <h2 className="h2 mt-2 text-paper">Vom Überblick zum eigenen Schaltplan.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper/80">
              Bauteile verbinden, Angaben strukturieren und den Plan dokumentieren. Vor dem Einbau bleibt eine
              fachliche Prüfung wichtig.
            </p>
          </div>
          <Link href="/planer" className={buttonVariants({ variant: 'default' })}>
            Planer öffnen
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </PageShell>
  );
}
