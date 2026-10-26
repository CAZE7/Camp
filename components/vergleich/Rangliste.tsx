import type { ComparisonProduct, ComparisonSpec } from '@/lib/seo/comparisons/types';
import { cn } from '@/lib/utils';

import { CHIP, preisText, STEUERKNOPF, TON_KLASSE } from './anzeige';

/**
 * components/vergleich/Rangliste.tsx — die Schicht zum Scannen.
 *
 * Zeigt nur die Merkmale mit `inTable: true` plus Preis, Einsatzfall und Haken.
 * Alles Weitere steht in `Produktkarte` — beide lesen dieselbe `ComparisonSpec`,
 * und Gate G1 verbietet, dass dieselbe Aussage in beiden steht.
 *
 * Ohne JavaScript ist die Tabelle vollständig lesbar und steht in Rangreihenfolge
 * (`lib/seo/comparisons/rangfolge.ts`). Die Steuerknöpfe sind deshalb ohne
 * JavaScript ausgeblendet: Ein Filter, der nichts tut, ist schlechter als keiner.
 */
export function Rangliste({
  spec,
  geraete,
}: {
  spec: ComparisonSpec;
  /** Geräte in Rangreihenfolge — die Reihenfolge, die ohne JavaScript gilt. */
  geraete: readonly ComparisonProduct[];
}) {
  const spalten = spec.attributes.filter((attribut) => attribut.inTable);
  const legenden = spec.attributes.filter((attribut) => attribut.legend);

  return (
    <>
      <div
        data-vergleich-steuerung=""
        role="group"
        aria-label="Geräte filtern und sortieren"
        className="hidden flex-wrap gap-2"
      >
        <button type="button" data-vergleich-filter="alle" aria-pressed="true" className={STEUERKNOPF}>
          Alle
        </button>
        {spec.classes.map((klasse) => (
          <button
            key={klasse.id}
            type="button"
            data-vergleich-filter={klasse.id}
            aria-pressed="false"
            className={STEUERKNOPF}
          >
            {klasse.label}
          </button>
        ))}
        <span aria-hidden="true" className="mx-1 hidden w-px self-stretch bg-rule md:block" />
        {spalten
          .filter((attribut) => attribut.sortierbar)
          .map((attribut) => (
            <button
              key={attribut.id}
              type="button"
              data-vergleich-sort={attribut.sortierbar}
              className={STEUERKNOPF}
            >
              {attribut.label}
              <span data-vergleich-pfeil="" aria-hidden="true">
                ↕
              </span>
            </button>
          ))}
        <button type="button" data-vergleich-sort="preis" className={STEUERKNOPF}>
          Preis
          <span data-vergleich-pfeil="" aria-hidden="true">
            ↕
          </span>
        </button>
      </div>

      <p data-vergleich-steuerung-hinweis="" className="caption-xs mt-2 hidden text-ink-soft">
        Filter und Sortierung gelten für die Tabelle und für die Karten unten.
      </p>

      {/*
        Auf schmalen Geräten ist die Tabelle breiter als die Spalte und wird
        seitlich scrollbar. Ohne eigenen Tab-Schritt wäre sie per Tastatur nicht
        erreichbar — die axe-Regel `scrollable-region-focusable` (WCAG 2.1.1)
        meldet das. `role="group"` statt eines nackten `<div>`, weil ein Element
        ohne Rolle kein `aria-label` tragen darf. Beide Regeln sind im Bestand
        schon einmal rot geworden (`components/seo/SeoPage.tsx`).
      */}
      <div
        role="group"
        aria-label={`Tabelle: ${spec.tableLabel}`}
        tabIndex={0}
        className="mt-3 hidden overflow-x-auto border border-rule bg-bone focus-visible:ring-2 focus-visible:ring-oxide focus-visible:outline-none focus-visible:ring-inset md:block"
      >
        <table className="w-full text-sm">
          <caption className="caption-xs px-3 py-2 text-left text-ink-soft">
            {spec.tableLabel} — {spec.tableCaption}
          </caption>
          <thead className="bg-surface-raised">
            <tr className="border-b border-rule-strong">
              <th scope="col" className="caption-xs px-3 py-2 text-left font-semibold text-ink">
                Gerät
              </th>
              {spalten.map((attribut) => (
                <th
                  key={attribut.id}
                  scope="col"
                  data-vergleich-spalte={attribut.sortierbar}
                  className="caption-xs px-3 py-2 text-left font-semibold whitespace-nowrap text-ink"
                >
                  {attribut.label}
                </th>
              ))}
              <th
                scope="col"
                data-vergleich-spalte="preis"
                className="caption-xs px-3 py-2 text-right font-semibold whitespace-nowrap text-ink"
              >
                Preis ab
              </th>
              <th scope="col" className="caption-xs px-3 py-2 text-left font-semibold text-ink">
                Passt für
              </th>
              <th scope="col" className="caption-xs px-3 py-2 text-left font-semibold text-ink">
                Haken
              </th>
            </tr>
          </thead>
          <tbody data-vergleich-liste="zeilen" className="text-ink-soft">
            {geraete.map((produkt) => (
              <tr
                key={produkt.id}
                data-vergleich-klasse={produkt.classId}
                data-vergleich-produkt={produkt.id}
                data-sort-strom={produkt.stromA ?? ''}
                data-sort-preis={produkt.priceEur ?? ''}
                className="border-b border-rule align-top last:border-b-0"
              >
                <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
                  <a href={`#p-${produkt.id}`} className="underline-offset-2 hover:underline">
                    {produkt.name}
                  </a>
                  <span className="caption-xs block font-normal text-ink-soft">{produkt.brand}</span>
                </th>
                {spalten.map((attribut) => (
                  <td
                    key={attribut.id}
                    className={cn(
                      'px-3 py-2',
                      attribut.sortierbar === 'strom' && 'font-medium text-ink tabular-nums'
                    )}
                  >
                    {produkt.specs[attribut.id] ?? '—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                  {preisText(produkt.priceEur)}
                </td>
                <td className="px-3 py-2">
                  <span className={cn(CHIP, TON_KLASSE[produkt.fit.tone])}>{produkt.fit.label}</span>
                </td>
                <td className="px-3 py-2">
                  {produkt.caveats.length === 0 ? (
                    '—'
                  ) : (
                    <span className="flex flex-col gap-1">
                      {produkt.caveats.map((hinweis) => (
                        <span key={hinweis.text} className={cn('caption-xs', TON_KLASSE[hinweis.tone])}>
                          {hinweis.text}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {legenden.length > 0 && (
        <details className="mt-3">
          <summary className="panel-title cursor-pointer">Was die Angaben bedeuten</summary>
          <dl className="mt-2 space-y-2">
            {legenden.map((attribut) => (
              <div key={attribut.id} className="border-t border-rule pt-2">
                <dt className="text-sm font-medium text-ink">{attribut.label}</dt>
                <dd className="caption-xs text-ink-soft">{attribut.legend}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </>
  );
}
