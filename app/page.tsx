import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, Flame, Map as MapIcon, Sun, Zap } from 'lucide-react';
import { metadataForPage } from '@/app/seoMetadata';
import { pageByPath } from '@/lib/seo/inventory';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { PageStructuredData } from '@/components/seo/PageStructuredData';

/**
 * D-7 Startseite: Hero mit klarem Nutzenversprechen, die drei Werkzeuge
 * (Elektrik/Dach/Heizung) plus Fahrplan im selben Card-System, darunter
 * die Guide-Teaser. Ein H1, konsistente CTAs, einheitliche Sektionen.
 */

export const metadata: Metadata = metadataForPage('/');

/**
 * Startseite: Titel, Überschrift und Beschreibung stehen im Seiteninventar
 * (`lib/seo/inventory.ts`) — dieselbe Quelle wie Canonical, Sitemap und die
 * Exportprüfung. Der inhaltliche Stand ebenso: Er ist der sichtbare
 * Gegenpart zu `dateModified` im Markup und zu `<lastmod>` in der Sitemap.
 */
const SEITE = pageByPath('/');
if (!SEITE) throw new Error('Die Startseite fehlt im SEO-Inventar.');

/** Überschrift und inhaltlicher Stand aus derselben Inventarzeile. */
const SEITEN_H1 = SEITE.h1;
const SEITEN_STAND = SEITE.contentRevision;

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

/**
 * Ausbau-Vorlagen: vollständige Ausgangslagen für typische Fahrzeuge. Jede
 * Vorlage nennt Verbrauch, Batterie, Solar, Leitungen und Stückliste — und
 * verlinkt in den Planer, mit dem sich die Werte übernehmen lassen.
 */
const VORLAGEN = [
  {
    title: 'Wochenend-Camper',
    body: 'Zwei Tage Autarkie, 200-Ah-Batterie, 500 Wp Solar — ohne 230-V-Netz.',
    href: '/vorlagen/wochenend/',
  },
  {
    title: 'Autark-Camper',
    body: 'Drei Tage ohne Landstrom, 410 Ah, 600 Wp Solar und ein 1 200-W-Wechselrichter.',
    href: '/vorlagen/autark/',
  },
  {
    title: 'Großraum-Camper',
    body: '24-V-Bordnetz, Waschmaschine, 175 Ah und 800 Wp Solar.',
    href: '/vorlagen/grossraum/',
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
      <PageStructuredData path="/" />
      <SiteHeader />

      <main id="main" className="container-page flex-1">
        {/* Hero — ein H1, ein Nutzenversprechen, ein primärer CTA */}
        <section className="prose-measure">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-2xl">
            {SEITEN_H1}
          </h1>
          <p className="mt-3 text-base text-ink-soft">
            Beim Camper-Ausbau entscheidet die Planung über Sicherheit, Kosten und Nacharbeit. Werft bündelt
            dafür die Werkzeuge an einem Ort: den 12V-/24V-Elektroplaner mit automatischer Querschnitts- und
            Sicherungsrechnung, den Dach-Planer für Solar und Luken, den Heizlast-Rechner sowie Einzelrechner
            für Batterie, Spannungsabfall und Solarertrag.
          </p>
          <div className="mt-4 space-y-3 text-base leading-relaxed text-ink-soft">
            <p>
              Die Reihenfolge ist bewusst einfach: erst den Ausbau-Fahrplan lesen, dann Dach und Elektrik
              rechnen, danach den Schaltplan zeichnen und die Heizlast prüfen. Jede Zahl kommt mit Formel,
              Annahmen und Grenzen — kein Blindvertrauen in eine schwarze Box. Dein Plan bleibt lokal im
              Browser; ein Konto brauchst du nicht.
            </p>
            <p>
              Zielgruppe sind Heimwerker ohne Elektro-Ausbildung, die trotzdem mit Normen und physikalischen
              Grenzen arbeiten wollen (u. a. Strombelastbarkeit nach DIN VDE 0298-4, Schutzorgan nahe der
              Quelle nach ISO 10133). Werft ersetzt keine Fachkraft und keine Abnahme — aber es ersetzt das
              Raten am Küchentisch.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/planer"
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
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="caption-xs text-ink-soft">
              Empfohlene Reihenfolge: Fahrplan lesen → Dach planen → Schaltplan zeichnen → Heizlast prüfen.
            </p>
            <p className="caption-xs text-ink-soft">Fachlich geprüft: {SEITEN_STAND}</p>
          </div>
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

        {/* Vorlagen — vollständige Ausbau-Vorlagen mit Stückliste */}
        <section aria-labelledby="vorlagen-heading" className="mt-12">
          <h2 id="vorlagen-heading" className="panel-title">
            Vorlagen
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Drei Ausgangslagen für typische Fahrzeuge: Verbrauch, Batterie, Solar, Leitungen und Stückliste.
            Jede Zahl stammt aus dem Rechenmodell, jede Vorlage nennt ihre Annahmen und Grenzen.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {VORLAGEN.map((vorlage) => (
              <li key={vorlage.href}>
                <Link
                  href={vorlage.href}
                  className="node-card group flex h-full flex-col justify-between gap-4 p-4 hover:bg-surface-hover focus-visible:outline-none"
                >
                  <div>
                    <div className="font-medium text-ink">{vorlage.title}</div>
                    <p className="mt-2 text-sm text-ink-soft">{vorlage.body}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-copper">
                    Vorlage öffnen
                    <ArrowRight
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
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
