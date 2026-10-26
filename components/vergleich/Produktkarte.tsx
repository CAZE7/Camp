import type { ComparisonProduct, ComparisonSpec } from '@/lib/seo/comparisons/types';
import { cn } from '@/lib/utils';

import { CHIP, preisText, TON_KLASSE } from './anzeige';

/**
 * components/vergleich/Produktkarte.tsx — die Schicht zur Tiefe.
 *
 * Zeigt die Merkmale, die nicht in der Rangliste stehen, dazu Langtext und
 * Belege in einem `<details>`. Auf Geräten unter 768 px gibt es keine Tabelle,
 * deshalb trägt die Karte dort zusätzlich die Scan-Merkmale — gesteuert über
 * eine Media Query, nicht über JavaScript, damit beide Darstellungen ohne
 * Skript dieselben Daten zeigen.
 *
 * Ein fehlender Merkmalswert (`null`) lässt die Zeile weg statt einen Strich zu
 * zeigen: Eine Karte mit sechs Strichen ist Rauschen. Dass `null` ausdrücklich
 * dasteht und nicht vergessen wurde, prüft Gate G2 in der Datendatei.
 */
export function Produktkarte({ spec, produkt }: { spec: ComparisonSpec; produkt: ComparisonProduct }) {
  return (
    <article
      id={`p-${produkt.id}`}
      data-vergleich-klasse={produkt.classId}
      data-vergleich-produkt={produkt.id}
      data-sort-strom={produkt.stromA ?? ''}
      data-sort-preis={produkt.priceEur ?? ''}
      className="scroll-mt-20 border border-rule bg-bone p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <p className="caption-xs text-ink-soft">{produkt.brand}</p>
          <h3 className="font-display text-lg font-semibold text-ink">{produkt.name}</h3>
        </div>
        <p className="font-medium whitespace-nowrap text-ink tabular-nums">
          ab {preisText(produkt.priceEur)}
        </p>
      </div>

      <p className="mt-2">
        <span className={cn(CHIP, TON_KLASSE[produkt.fit.tone])}>{produkt.fit.label}</span>
      </p>

      <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
        {spec.attributes.map((attribut) => {
          const wert = produkt.specs[attribut.id];
          if (wert === null) return null;
          return (
            <div
              key={attribut.id}
              className={cn(
                'flex justify-between gap-3 border-b border-rule py-1 text-sm',
                attribut.inTable && 'md:hidden'
              )}
            >
              <dt className="text-ink-soft">{attribut.label}</dt>
              <dd className="text-right font-medium text-ink tabular-nums">
                {wert}
                {attribut.unit ? ` ${attribut.unit}` : ''}
              </dd>
            </div>
          );
        })}
      </dl>

      {produkt.caveats.map((hinweis) => (
        <p key={hinweis.text} className={cn('caption-xs mt-2', TON_KLASSE[hinweis.tone])}>
          {hinweis.text}
        </p>
      ))}

      {(produkt.detail.length > 0 || produkt.links.length > 0) && (
        <details className="mt-3 border-t border-rule pt-2">
          <summary className="cursor-pointer text-sm font-medium text-oxide">Details und Belege</summary>
          <div className="prose-measure mt-2 space-y-2 text-sm text-ink-soft">
            {produkt.detail.map((absatz) => (
              <p key={absatz}>{absatz}</p>
            ))}
            {produkt.links.length > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {produkt.links.map((verweis) => (
                  <li key={verweis.href}>
                    <a
                      href={verweis.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="text-oxide underline underline-offset-2"
                    >
                      {verweis.label}
                      <span className="sr-only"> (öffnet eine fremde Seite)</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}
    </article>
  );
}
