import Link from 'next/link';

import { FaqAkkordeon } from '@/components/elektrik/FaqAkkordeon';
import { CalculatorRenderer } from '@/components/rechner/CalculatorRenderer';
import { PageShell } from '@/components/brand/PageShell';
import { Vergleichszone } from '@/components/vergleich/Vergleichszone';
import { vergleichsProdukte } from '@/lib/seo/comparisons/schema';
import {
  breadcrumbNode,
  faqNode,
  itemListNode,
  jsonLdGraph,
  pageNodeId,
  serializeJsonLd,
  webApplicationNode,
  webPageNode,
} from '@/lib/seo/jsonLd';
import { topicOf } from '@/lib/seo/topics';
import type { CalculatorId, ContentSection, SeoPageContent } from '@/lib/seo/types';

import { breadcrumbsFor } from './Breadcrumbs';
import { RichText } from './RichText';

/**
 * components/seo/SeoPage.tsx — das Gerüst jeder inhaltsgetriebenen Seite.
 *
 * Warum zentral und nicht je Seite: Eine SEO-Seite hat immer dieselben Teile
 * (Brotkrumen, eine Hauptüberschrift, Abschnitte, Fragen, Quellen, Annahmen,
 * Grenzen, verwandte Themen, Weg in den Planer). Wären sie je Seite
 * geschrieben, würde die Prüfung an jeder Kopie neu ansetzen und die
 * strukturierte Beschreibung bei jeder Änderung abweichen.
 *
 * Der Inhalt kommt aus `lib/seo/content/` — hier steht nur, WIE er erscheint.
 */

/**
 * Fachgebiet des Rechners für `applicationSubCategory`. Als erschöpfendes
 * `Record` statt einer Verzweigung: Ein neuer Rechner ohne Eintrag fällt dann
 * im Typecheck auf, statt stillschweigend ein falsches Gebiet zu erben.
 */
const CALCULATOR_SUBCATEGORY: Record<CalculatorId, string> = {
  kabelquerschnitt: 'Leitungsbemessung',
  spannungsabfall: 'Spannungsfall',
  batteriekapazitaet: 'Batterieauslegung',
  solaranlage: 'Solarauslegung',
  ladestrom: 'Ladeauslegung',
};

/** Beschreibung dieser Seite als `@graph` — Texte aus derselben Quelle wie die Anzeige. */
export function jsonLdFor(page: SeoPageContent) {
  const breadcrumb = breadcrumbsFor(page);
  const pageId = pageNodeId(page.path, 'webpage');
  const hasCalculator = page.sections.some((section) => section.calculator !== undefined);
  const calculatorId = page.sections.find((section) => section.calculator)?.calculator;

  const faqEntries = page.faq ?? [];
  const vergleich = page.comparison;

  return jsonLdGraph([
    webPageNode({
      path: page.path,
      name: page.h1,
      description: page.description,
      breadcrumbId: pageNodeId(page.path, 'breadcrumb'),
      mainEntityId: hasCalculator ? pageNodeId(page.path, 'webapplication') : undefined,
      hasPartIds: [
        ...(vergleich ? [pageNodeId(page.path, 'geraeteliste')] : []),
        ...(faqEntries.length > 0 ? [pageNodeId(page.path, 'faq')] : []),
        pageNodeId(page.path, 'breadcrumb'),
      ],
    }),
    breadcrumbNode({ path: page.path, items: breadcrumb }),
    ...(vergleich
      ? [
          itemListNode({
            path: page.path,
            name: vergleich.heading,
            description: vergleich.tableCaption,
            products: vergleichsProdukte(vergleich),
          }),
        ]
      : []),
    ...(hasCalculator && calculatorId
      ? [
          webApplicationNode({
            path: page.path,
            name: page.h1,
            description: page.description,
            subCategory: CALCULATOR_SUBCATEGORY[calculatorId],
          }),
        ]
      : []),
    ...(faqEntries.length > 0 ? [faqNode({ path: page.path, entries: faqEntries, pageId })] : []),
  ]);
}

export function SeoPage({
  page,
  children,
  afterHeader,
}: {
  page: SeoPageContent;
  /** Zusätzlicher Inhalt zwischen Abschnitten und Fragen (z. B. Themenverzeichnis). */
  children?: React.ReactNode;
  /**
   * Inhalt direkt unter der Kopfzeile (Überschrift und Einleitung) und VOR den
   * Abschnitten — gedacht für den Schnellzugriff auf die Einzelrechner
   * (`RechnerLeiste`). Bewusst ein eigener Slot und nicht Teil der Abschnitte:
   * Die Reihenfolge „was ist das hier zuerst, was kann ich hier rechnen" ist
   * eine Layout-, keine Inhaltsentscheidung.
   */
  afterHeader?: React.ReactNode;
}) {
  const breadcrumb = breadcrumbsFor(page);
  const topic = topicOf(page.topicId);

  // Jede inhaltsgetriebene Seite teilt das Gerüst (PageShell): Kopf,
  // Brotkrumen unter dem Kopf, Lesespalte an derselben Kante, Fuß.
  return (
    <PageShell variant="article" breadcrumbs={breadcrumb}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdFor(page)) }}
      />
      <div className="container-page space-y-14">
        <header className="prose-measure">
          <p className="kicker">{topic.label}</p>
          <h1 className="h1 mt-3">{page.h1}</h1>
          <p className="mt-4 text-md leading-relaxed text-ink-soft">
            <RichText text={page.lead} />
          </p>
        </header>

        {/*
          Der Vergleich steht VOR den Abschnitten, und das ist eine Inhalts-
          entscheidung, keine Geschmacksfrage: Wer „X Vergleich" sucht, will die
          Geräte sehen und nicht erst 3.000 Wörter Auslegung lesen. Gate G4
          (`components/vergleich/Vergleichszone.test.tsx`) prüft die Reihenfolge,
          damit sie nicht bei der nächsten Umstellung versehentlich kippt.
        */}
        {page.comparison ? <Vergleichszone spec={page.comparison} /> : null}

        {afterHeader}

        {page.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {children}

        {(page.faq?.length ?? 0) > 0 && (
          <section aria-labelledby="faq-titel" className="scroll-mt-20">
            <h2 id="faq-titel" className="font-display text-xl font-semibold text-ink">
              Häufige Fragen
            </h2>
            <div className="mt-5 max-w-3xl">
              <FaqAkkordeon entries={page.faq ?? []} />
            </div>
          </section>
        )}

        <TrustBlock page={page} />

        <section aria-labelledby="weiter-titel">
          <h2 id="weiter-titel" className="font-display text-xl font-semibold text-ink">
            Weiter im Thema
          </h2>
          <ul className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {page.related.map((link) => (
              <li key={link.href} className="border-t border-rule pt-2">
                <Link href={link.href} className="font-medium text-ink underline-offset-2 hover:underline">
                  <RichText text={link.label} />
                </Link>
                {link.description && (
                  <p className="mt-1 text-base text-ink-soft">
                    <RichText text={link.description} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Eigene Kennung, damit sie nicht mit einer Abschnittsüberschrift
              zusammenfällt, die ebenfalls „planer" heißt (§ Barrierefreiheit:
              doppelte IDs sind ungültig). */}
        <section aria-labelledby="weiter-planer-titel" className="node-card p-5 md:p-6">
          <h2 id="weiter-planer-titel" className="panel-title">
            Im Planer weiterrechnen
          </h2>
          <p className="mt-2 max-w-3xl text-md text-ink-soft">
            Der Camper-Elektroplaner prüft dieselben Zusammenhänge für die ganze Anlage: Querschnitt,
            Spannungsfall, Sicherung und Energiebilanz je Leitung — und erzeugt daraus die Stückliste. Läuft
            im Browser, ohne Anmeldung.
          </p>
          {/*
              Drei Ziele, in dieser Reihenfolge: die Zeichenanwendung (eigene
              Route `/planer/`, volles Browserfenster), die Wissensseite mit
              Rechner und Normgrundlagen (`/elektrik-planung/`) und der
              Rechner-Überblick. Der mittlere Verweis ist nicht Zierde: Die
              Linkgraph-Prüfung `rechner-ohne-planner-link` verlangt von jeder
              Seite mit eingebettetem Rechner einen kontextuellen Verweis auf
              die Elektroplaner-Wissensseite (PLANNER_PATH in
              `scripts/seo/linkGraph.ts`).
            */}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/planer/"
              className="inline-flex min-h-11 items-center bg-oxide px-4 py-2 text-sm font-medium text-on-signal transition-colors hover:bg-oxide/90"
            >
              Camper-Elektroplaner öffnen
            </Link>
            <Link
              href="/elektrik-planung/"
              className="inline-flex min-h-11 items-center border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
            >
              Rechner und Normgrundlagen
            </Link>
            <Link
              href="/rechner/"
              className="inline-flex min-h-11 items-center border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
            >
              Alle Rechner ansehen
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

/** Ein Abschnitt: Überschrift, Inhaltsteile in fester Reihenfolge, Verweise. */
function Section({ section }: { section: ContentSection }) {
  const headingId = `${section.id}-titel`;

  return (
    <section id={section.id} aria-labelledby={headingId} className="scroll-mt-20">
      <h2 id={headingId} className="font-display text-xl font-semibold text-ink">
        {section.heading}
      </h2>

      {section.body && (
        <div className="prose-measure mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          {section.body.map((paragraph, index) => (
            <p key={index}>
              <RichText text={paragraph} />
            </p>
          ))}
        </div>
      )}

      {section.calculator && (
        <div className="mt-5">
          <CalculatorRenderer calculator={section.calculator} />
        </div>
      )}

      {section.definitions && (
        <dl className="prose-measure mt-4 space-y-2 text-md">
          {section.definitions.map((entry) => (
            <div key={entry.term} className="border-t border-rule pt-2">
              <dt className="font-medium text-ink">{entry.term}</dt>
              <dd className="text-ink-soft">
                <RichText text={entry.description} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {section.list && (
        <ol
          className={`prose-measure mt-3 space-y-2 pl-5 text-md text-ink-soft ${
            section.list.ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {(section.list.items ?? []).map((item, index) => (
            <li key={index}>
              <RichText text={item} />
            </li>
          ))}
        </ol>
      )}

      {section.table && (
        <figure className="mt-4 max-w-3xl">
          {section.table.caption && (
            <figcaption className="caption-xs mb-2 text-ink-soft">{section.table.caption}</figcaption>
          )}
          {/*
            Auf schmalen Geräten ist die Tabelle breiter als der Text und wird
            seitlich scrollbar. Ohne Fokussierbarkeit wäre sie per Tastatur
            nicht erreichbar — genau das meldet die axe-Regel
            `scrollable-region-focusable` (WCAG 2.1.1) und ließ den
            Barrierefreiheitslauf rot werden. Deshalb: eigener Tab-Schritt mit
            sichtbarem Fokusring und einem Namen, der die Tabelle benennt.
            `role="group"` statt eines nackten `<div>`: Ein Element ohne Rolle
            darf kein `aria-label` tragen.
          */}
          <div
            role="group"
            aria-label={`Tabelle: ${section.heading}`}
            tabIndex={0}
            className="overflow-x-auto border border-rule bg-bone focus-visible:ring-2 focus-visible:ring-oxide focus-visible:outline-none focus-visible:ring-inset"
          >
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-rule">
                  {section.table.head.map((cell) => (
                    <th key={cell} scope="col" className="px-3 py-2 text-left font-medium text-ink">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {section.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-rule last:border-b-0">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 font-mono">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {section.table.note && (
            <p className="mt-2 text-base text-ink-soft">
              <RichText text={section.table.note} />
            </p>
          )}
        </figure>
      )}

      {section.formula && (
        <figure className="mt-4 max-w-3xl border border-rule bg-bone px-5 py-4">
          <p className="font-mono text-md text-ink">{section.formula.expression}</p>
          {section.formula.caption && (
            <figcaption className="mt-2 text-base text-ink-soft">
              <RichText text={section.formula.caption} />
            </figcaption>
          )}
        </figure>
      )}

      {section.callout && (
        <div
          className={`mt-4 max-w-3xl ${section.callout.tone === 'warning' ? 'warn-card warn-card-warning' : 'warn-card warn-card-info'}`}
        >
          <p className="text-md">
            <RichText text={section.callout.text} />
          </p>
        </div>
      )}

      {section.subsections?.map((subsection) => (
        <div key={subsection.heading} className="prose-measure mt-6">
          <h3 className="text-lg font-semibold text-ink">{subsection.heading}</h3>
          {subsection.body.map((paragraph, index) => (
            <p key={index} className="mt-2 text-md leading-relaxed text-ink-soft">
              <RichText text={paragraph} />
            </p>
          ))}
        </div>
      ))}

      {section.links && section.links.length > 0 && (
        <ul className="prose-measure mt-4 space-y-2">
          {section.links.map((link) => (
            <li key={link.href} className="border-t border-rule pt-2">
              <Link href={link.href} className="font-medium text-ink underline-offset-2 hover:underline">
                {link.label}
              </Link>
              {link.description && (
                <span className="ml-2 text-base text-ink-soft">
                  <RichText text={link.description} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Quellen, Annahmen, Grenzen und Stand — die Transparenz des Fachteils (§18). */
function TrustBlock({ page }: { page: SeoPageContent }) {
  const hasSources = (page.sources?.length ?? 0) > 0;
  const hasAssumptions = (page.assumptions?.length ?? 0) > 0;
  const hasLimits = (page.limits?.length ?? 0) > 0;
  if (!hasSources && !hasAssumptions && !hasLimits) return null;

  return (
    <section aria-labelledby="transparenz-titel" className="scroll-mt-20">
      <h2 id="transparenz-titel" className="font-display text-xl font-semibold text-ink">
        Grundlage, Annahmen und Grenzen
      </h2>
      <div className="mt-4 grid gap-8 md:grid-cols-3">
        {hasSources && (
          <div>
            <h3 className="panel-title">Quellen</h3>
            <dl className="mt-2 space-y-3 text-base">
              {page.sources!.map((source) => (
                <div key={source.label} className="border-t border-rule pt-2">
                  <dt className="font-medium text-ink">{source.label}</dt>
                  <dd className="text-ink-soft">
                    <RichText text={source.detail} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {hasAssumptions && (
          <div>
            <h3 className="panel-title">Annahmen</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-base text-ink-soft">
              {page.assumptions!.map((assumption, index) => (
                <li key={index}>
                  <RichText text={assumption} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasLimits && (
          <div>
            <h3 className="panel-title">Grenzen</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-base text-ink-soft">
              {page.limits!.map((limit, index) => (
                <li key={index}>
                  <RichText text={limit} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="caption-xs mt-4 text-ink-soft">
        Inhaltlicher Stand: {page.contentRevision}. Keine fachliche Prüfung durch Dritte — Rechenwege, Quellen
        und Grenzen stehen offen, siehe <Link href="/ueber-elektroplaner/">Über Elektroplaner</Link>.
      </p>
    </section>
  );
}
