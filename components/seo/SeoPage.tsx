import Link from 'next/link';

import { FaqAkkordeon } from '@/components/elektrik/FaqAkkordeon';
import { CalculatorRenderer } from '@/components/rechner/CalculatorRenderer';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';
import {
  breadcrumbNode,
  faqNode,
  jsonLdGraph,
  pageNodeId,
  serializeJsonLd,
  webApplicationNode,
  webPageNode,
} from '@/lib/seo/jsonLd';
import { topicOf } from '@/lib/seo/topics';
import type { ContentSection, SeoPageContent } from '@/lib/seo/types';

import { Breadcrumbs, breadcrumbsFor } from './Breadcrumbs';
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

/** Beschreibung dieser Seite als `@graph` — Texte aus derselben Quelle wie die Anzeige. */
export function jsonLdFor(page: SeoPageContent) {
  const breadcrumb = breadcrumbsFor(page);
  const pageId = pageNodeId(page.path, 'webpage');
  const hasCalculator = page.sections.some((section) => section.calculator !== undefined);
  const calculatorId = page.sections.find((section) => section.calculator)?.calculator;

  const faqEntries = page.faq ?? [];

  return jsonLdGraph([
    webPageNode({
      path: page.path,
      name: page.h1,
      description: page.description,
      breadcrumbId: pageNodeId(page.path, 'breadcrumb'),
      mainEntityId: hasCalculator ? pageNodeId(page.path, 'webapplication') : undefined,
      hasPartIds: [
        ...(faqEntries.length > 0 ? [pageNodeId(page.path, 'faq')] : []),
        pageNodeId(page.path, 'breadcrumb'),
      ],
    }),
    breadcrumbNode({ path: page.path, items: breadcrumb }),
    ...(hasCalculator && calculatorId
      ? [
          webApplicationNode({
            path: page.path,
            name: page.h1,
            description: page.description,
            subCategory:
              calculatorId === 'batteriekapazitaet'
                ? 'Batterieauslegung'
                : calculatorId === 'solaranlage'
                  ? 'Solarauslegung'
                  : calculatorId === 'spannungsabfall'
                    ? 'Spannungsfall'
                    : 'Leitungsbemessung',
          }),
        ]
      : []),
    ...(faqEntries.length > 0 ? [faqNode({ path: page.path, entries: faqEntries, pageId })] : []),
  ]);
}

export function SeoPage({
  page,
  children,
}: {
  page: SeoPageContent;
  /** Zusätzlicher Inhalt zwischen Abschnitten und Fragen (z. B. Themenverzeichnis). */
  children?: React.ReactNode;
}) {
  const breadcrumb = breadcrumbsFor(page);
  const topic = topicOf(page.topicId);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdFor(page)) }}
      />
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="container-page space-y-14">
          <header className="prose-measure">
            <Breadcrumbs items={breadcrumb} />
            <p className="label-eyebrow mt-6 text-copper">{topic.label}</p>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">{page.h1}</h1>
            <p className="mt-4 text-md leading-relaxed text-ink-soft">
              <RichText text={page.lead} />
            </p>
          </header>

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
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/elektrik-planung/#planer"
                className="inline-flex min-h-11 items-center bg-oxide px-4 py-2 text-sm font-medium text-on-signal transition-colors hover:bg-oxide/90"
              >
                Camper-Elektroplaner öffnen
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
      </main>

      <SiteFooter />
    </div>
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
            className="overflow-x-auto border border-rule bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-oxide"
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
        und Grenzen stehen offen, siehe <Link href="/ueber-werft/">Über Werft</Link>.
      </p>
    </section>
  );
}
