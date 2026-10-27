import type { Metadata } from 'next';
import Link from 'next/link';

import { PageStructuredData } from '@/components/seo/PageStructuredData';
import { ArrowRight, BookOpen, CalendarCheck, Calculator, Flame, Sun, Zap } from 'lucide-react';
import { metadataForPage } from '@/app/seoMetadata';
import { GuideCard } from '@/components/brand/GuideCard';
import { PageShell } from '@/components/brand/PageShell';
import { PlanPreview } from '@/components/brand/PlanPreview';
import { SiteSection } from '@/components/brand/SiteSection';
import { ToolCard } from '@/components/brand/ToolCard';
import { buttonVariants } from '@/components/ui/button';
import { RechnerLeiste } from '@/components/seo/RechnerLeiste';

/**
 * D-7 Startseite: bildfreier, typografischer Einstieg mit direkt erreichbaren
 * Werkzeugen, Rechnern und Leitfäden. Ein H1, klare technische Einordnung.
 *
 * Aufbau (eine Kante, ein Rhythmus):
 *   1. Kopfzeile mit Einordnung — wo bin ich.
 *   2. Hero: Anspruch links, Inhaltsverzeichnis und Plan-Vorschau rechts.
 *      Rechts steht bewusst kein Bild: Die Seite bleibt bildfrei
 *      (`app/page.test.tsx`), und die Vorschau zeigt als Gerüst, was der
 *      Planer ausgibt — statt eines Screenshots, der nach der nächsten
 *      Layout-Runde veraltet ist.
 *   3. Die Abschnitte tragen ihre Überschrift über `SiteSection`: eine H2
 *      je Abschnitt, Anker auf die Überschrift, damit die Sprungziele des
 *      Inhaltsverzeichnisses und der Schnellnavigation zusammenpassen.
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
    body: 'Wissen: Karosserie, Dämmung, Elektrik, Gas und TÜV — mit Normbezug und Praxiswerten.',
    href: '/guides/camper-ausbauguide',
    meta: 'Technik',
    facts: ['Karosserie', 'Dämmung', '12 V', 'TÜV'],
  },
  {
    title: 'Ausbau-Fahrplan',
    body: 'Die Reihenfolge der Gewerke: was kommt wann, und welche Fehler dich zwei Schritte zurückwerfen.',
    href: '/guides/ausbau-fahrplan',
    meta: 'Reihenfolge',
    facts: ['Vom Entkernen zum Möbelbau'],
  },
  {
    title: 'Holzausbau (BEDMAS)',
    body: 'Sechs Schritte für den Möbelbau.',
    href: '/guides/holzausbau',
    meta: 'Möbelbau',
    facts: ['6 Schritte'],
  },
  {
    title: 'Ausbau-Dokumentation',
    body: 'Der eigene Camper: Elektrik-Schritte, Tabelle, Rechenbeispiel.',
    href: '/camper-ausbau',
    meta: 'Praxis',
    facts: ['Rechenbeispiel'],
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
      <PageStructuredData path="/" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 md:gap-14">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
          <span className="panel-title border border-rule px-2 py-1">CAMP // WERKSTATT</span>
          <span className="panel-title">ELEKTRIK · DACH · HEIZUNG</span>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:gap-12">
          <div className="lg:py-2">
            <p className="kicker">TECHNISCHE PRAXIS // CAMPER-AUSBAU</p>
            <h1 className="h1 mt-4 max-w-3xl">Camper planen — erst der Plan, dann das Blech.</h1>
            <p className="prose-measure mt-6 text-base leading-relaxed text-ink-soft md:text-lg">
              Dach, Elektrik, Heizung und Sicherheit an einem Ort. Werkzeuge und Guides helfen dir, den
              Camper-Ausbau strukturiert vorzubereiten.
            </p>
            <p className="prose-measure mt-4 text-sm leading-relaxed text-ink-soft">
              Rechnerwerte unterstützen die Vorbereitung; fachliche Prüfung und Abnahme bleiben separat.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/planer" className={buttonVariants({ variant: 'default' })}>
                Schaltplan starten
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/guides/ausbau-fahrplan" className={buttonVariants({ variant: 'outline' })}>
                Erst den Fahrplan lesen
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="caption-xs mt-5 text-ink-soft">
              Empfohlene Reihenfolge: Fahrplan lesen → Dach planen → Schaltplan zeichnen → Heizlast prüfen.
            </p>
          </div>

          <aside className="flex flex-col gap-4 lg:border-l lg:border-rule lg:pl-8">
            <nav
              aria-label="Inhaltsverzeichnis der Startseite"
              className="rounded border border-rule bg-surface-panel p-4"
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
                      className="group flex min-h-16 items-center gap-3 border-b border-rule py-3 last:border-b-0 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-rule bg-surface-raised font-mono text-xs font-medium text-oxide">
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
            </nav>

            <PlanPreview />
            <p className="caption-xs text-ink-soft">
              Der Planer beschriftet jede Leitung mit Querschnitt, Länge und Absicherung — gerechnet aus
              deinem Plan, nicht geschätzt.
            </p>
          </aside>
        </section>

        <SiteSection
          id="werkzeuge"
          kicker="DIREKTZUGRIFF // WERKZEUGE"
          title="Fokus-Themen"
          aside={<span className="panel-title">PLANEN · RECHNEN · DOKUMENTIEREN</span>}
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((tool) => (
              <li key={tool.href}>
                <ToolCard
                  href={tool.href}
                  title={tool.title}
                  body={tool.body}
                  cta={tool.cta}
                  icon={tool.icon}
                  primary={tool.primary}
                  badge={tool.recommended ? 'Starte hier' : undefined}
                />
              </li>
            ))}
          </ul>
        </SiteSection>

        <RechnerLeiste variant="inline" className="overflow-hidden rounded" />

        <SiteSection
          id="guides"
          kicker="LESESTOFF // ANLEITUNGEN"
          title="Wissen für den Ausbau"
          lead="Leitfäden zu Reihenfolge, Ausbau, Heizung und Zulassung — in der Reihenfolge, in der du sie brauchst."
          aside={<span className="panel-title">{GUIDES.length} BEITRÄGE</span>}
        >
          <ul className="grid gap-3 lg:grid-cols-2">
            {GUIDES.map((guide, index) => (
              <li key={guide.href}>
                <GuideCard
                  href={guide.href}
                  title={guide.title}
                  body={guide.body}
                  index={String(index + 1).padStart(2, '0')}
                  meta={guide.meta}
                  facts={guide.facts}
                />
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-ink-soft">
            Alle Leitfäden gesammelt:{' '}
            <Link
              href="/guides"
              className="font-semibold text-copper underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
            >
              Zur Guides-Übersicht
            </Link>
            .
          </p>
        </SiteSection>

        <section className="grid gap-5 rounded border border-rule bg-soot p-5 text-paper md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
          <div>
            <p className="panel-title text-paper/70">WERKZEUG // SCHALTPLAN</p>
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
