import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarCheck, Flame, Hammer, Ruler, ShieldCheck, Zap } from 'lucide-react';

import { metadataForPage } from '@/app/seoMetadata';
import { breadcrumbsFor } from '@/components/seo/Breadcrumbs';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
import { GuideCard } from '@/components/brand/GuideCard';
import { PageShell } from '@/components/brand/PageShell';
import { SiteSection } from '@/components/brand/SiteSection';
import { buttonVariants } from '@/components/ui/button';
import { pageByPath } from '@/lib/seo/inventory';

/**
 * /guides/ — die Übersicht der Leitfäden.
 *
 * Vorher führte „Guides" in der Kopfleiste auf einen einzelnen Leitfaden
 * (`/guides/ausbau-fahrplan`): Die Rubrik behauptete damit, dieser eine
 * Beitrag sei die ganze Sammlung — und die zwei anderen Leitfäden waren nur
 * über die Startseite zu finden. Diese Seite ist die Ebene dazwischen.
 *
 * Die Überschrift kommt aus dem Inventar (`PAGE.h1`), nicht aus einer zweiten
 * Konstante: Die Prüfung des Exports vergleicht sichtbare H1, Titel und
 * Beschreibung mit dem Inventar — zwei Quellen könnten auseinanderlaufen.
 */

export const metadata: Metadata = metadataForPage('/guides/');

const PAGE = pageByPath('/guides/');

const GUIDES = [
  {
    href: '/guides/ausbau-fahrplan/',
    title: 'Ausbau-Fahrplan',
    body: 'Vom Entkernen bis zum Möbelbau: die Reihenfolge der Gewerke, mit den Fehlern, die dich sonst zwei Schritte zurückwerfen. Der Einstieg, wenn du noch keinen Plan hast.',
    index: '01',
    meta: 'Reihenfolge',
    facts: ['Vom Entkernen zum Möbelbau', 'Meilensteine'],
    featured: true,
  },
  {
    href: '/guides/camper-ausbauguide/',
    title: 'Camper-Ausbauguide',
    body: 'Wissen für den Ausbau: Karosserie, Dämmung, 12-V-Elektrik, Gas und TÜV — verständlich erklärt, mit Normbezug und Praxiswerten.',
    index: '02',
    meta: 'Technik',
    facts: ['Karosserie', 'Dämmung', '12 V', 'TÜV'],
  },
  {
    href: '/guides/holzausbau/',
    title: 'Holzausbau im Camper',
    body: 'Möbelbau in sechs Schritten: Unterkonstruktion, Wandverkleidung, Stauraum, Befestigung und Oberflächen — mit Materialwahl und Gewicht.',
    index: '03',
    meta: 'Möbelbau',
    facts: ['6 Schritte', 'Materialwahl'],
  },
];

/** Wohin es nach den Leitfäden geht — dieselben Ziele wie im Fuß. */
const WEITER = [
  {
    href: '/camper-elektrik/',
    title: 'Camper-Elektrik',
    body: 'Das Thema von der Leitung bis zur Absicherung, Seite für Seite.',
    icon: Zap,
  },
  {
    href: '/camper-ausbau/',
    title: 'Ausbau dokumentieren',
    body: 'Ein realer Ausbau: Elektrik-Schritte, Tabelle und Rechenbeispiel.',
    icon: Ruler,
  },
  {
    href: '/heizung-daemmung/',
    title: 'Heizung & Dämmung',
    body: 'Heizlast, Dämmung und Heizsysteme — welche Leistung passt?',
    icon: Flame,
  },
  {
    href: '/wohnmobilzulassung/',
    title: 'Wohnmobilzulassung',
    body: 'TÜV, Schaltplan und Dokumente für die Abnahme.',
    icon: ShieldCheck,
  },
];

export default function GuidesOverview() {
  if (!PAGE) throw new Error('SEO-Inventar: /guides/ fehlt.');
  const crumbs = breadcrumbsFor(PAGE);

  return (
    <PageShell
      variant="article"
      breadcrumbs={crumbs}
      mainClassName="container-page w-full px-4 pt-4 pb-12 md:px-5 md:pt-8"
    >
      <PageStructuredData path="/guides/" breadcrumbItems={crumbs} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 md:gap-14">
        <header className="border-b border-rule pb-6">
          <p className="kicker">RATGEBER // ÜBERSICHT</p>
          <h1 className="h1 mt-4 max-w-3xl">{PAGE.h1}</h1>
          <p className="prose-measure mt-6 text-base leading-relaxed text-ink-soft md:text-lg">
            Drei Leitfäden für den Selbstausbau — in der Reihenfolge, in der du sie brauchst. Sie ordnen die
            Arbeit, bevor sie ins Detail gehen: erst wann etwas passiert, dann wie.
          </p>
          <p className="prose-measure mt-4 text-sm leading-relaxed text-ink-soft">
            Alle Angaben bereiten die Entscheidung vor. Sie ersetzen keine Planung durch eine
            Elektrofachkraft.
          </p>
        </header>

        <SiteSection
          id="reihenfolge"
          kicker="LESESTOFF // AUSBAU"
          title="In dieser Reihenfolge"
          lead="Fahrplan zuerst: Wer die Reihenfolge kennt, stellt die Detailfragen zum richtigen Zeitpunkt — nicht mittendrin."
          aside={<span className="panel-title">{GUIDES.length} LEITFÄDEN</span>}
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {GUIDES.map((guide) => (
              <li key={guide.href} className={guide.featured ? 'md:col-span-2' : undefined}>
                <GuideCard
                  href={guide.href}
                  title={guide.title}
                  body={guide.body}
                  index={guide.index}
                  meta={guide.meta}
                  facts={guide.facts}
                />
              </li>
            ))}
          </ul>
        </SiteSection>

        <SiteSection
          id="vertiefung"
          kicker="WEITER // THEMEN"
          title="Wohin die Guides führen"
          lead="Jeder Leitfaden endet an einer Stelle, an der es weitergeht — in ein Thema, einen Rechner oder ein Werkzeug."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {WEITER.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="node-card group flex h-full items-start gap-3 rounded p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-rule bg-surface-raised text-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{item.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{item.body}</span>
                    </span>
                    <ArrowRight
                      className="mt-1 ml-auto h-4 w-4 shrink-0 text-copper transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-sm text-ink-soft">
            Zahlen statt Prosa:{' '}
            <Link
              href="/rechner/"
              className="font-semibold text-copper underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide"
            >
              Zu den Rechnern
            </Link>
            .
          </p>
        </SiteSection>

        <SiteSection id="haltung" kicker="MASSSTAB // HALTUNG" title="Wie diese Guides geschrieben sind">
          <div className="prose-measure flex flex-col gap-4 text-sm leading-relaxed text-ink-soft">
            <p>
              <strong className="font-semibold text-ink">Reihenfolge vor Detail.</strong> Ein Ausbau scheitert
              selten an einer fehlenden Zahl, sondern an einem Schritt, der zu früh kam: Die Verkleidung ist
              zu, bevor die Leitung liegt. Die Guides nennen deshalb zuerst die Ordnung der Arbeit und
              erklären das einzelne Gewerk danach.
            </p>
            <p>
              <strong className="font-semibold text-ink">Konservativ gerechnet.</strong> Wo eine Annahme nötig
              ist, steht die vorsichtige: lieber ein Querschnitt mehr als einer zu wenig, lieber eine
              Sicherung unter der Kabelgrenze als darüber. Die Rechner im Werkzeugteil zeigen dieselbe Haltung
              — und nennen die Annahme, die sie treffen.
            </p>
            <p>
              <strong className="font-semibold text-ink">Mit klarer Grenze.</strong> Diese Seiten bereiten
              Entscheidungen vor, sie treffen sie nicht. Für Landstrom-Anlagen (230 V) ist eine Abnahme nach
              DIN VDE 0100-721 durch eine qualifizierte Person Pflicht; die Berechnungen hier sind Näherungen
              und ersetzen keine Prüfung durch eine Elektrofachkraft.
            </p>
          </div>
        </SiteSection>

        <section className="grid gap-5 rounded border border-rule bg-soot p-5 text-paper md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
          <div>
            <p className="panel-title text-paper/70">VOM LESEN ZUM PLAN</p>
            <h2 className="h2 mt-2 text-paper">Den Fahrplan in einen Schaltplan übersetzen.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper/80">
              Bauteile auf die Fläche ziehen, verbinden lassen und Querschnitt, Absicherung und Stückliste
              ablesen. Ohne Konto, im Browser gespeichert.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/planer/" className={buttonVariants({ variant: 'default' })}>
              Planer öffnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/guides/ausbau-fahrplan/" className={buttonVariants({ variant: 'outline' })}>
              Fahrplan lesen
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <p className="caption-xs flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-4 text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {GUIDES.length} Leitfäden
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Hammer className="h-4 w-4" aria-hidden="true" />
            Für den Selbstausbau
          </span>
        </p>
      </div>
    </PageShell>
  );
}
