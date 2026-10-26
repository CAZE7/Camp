import type { ComparisonSpec } from '@/lib/seo/comparisons/types';

/**
 * components/vergleich/Einsatzfaelle.tsx — „Welcher passt zu mir?"
 *
 * Vier Zeilen: Situation, Gerät, ein Grund. Beim ersten Vergleich stand die
 * Entscheidungshilfe als „fünf Fragen" hinter Rechner und Forenbeobachtungen,
 * also dort, wo niemand mehr hinkommt. Sie steht jetzt vor dem Ratgebertext und
 * verweist auf die Produktkarte, statt die Begründung zu wiederholen.
 */
export function Einsatzfaelle({ spec }: { spec: ComparisonSpec }) {
  const nachId = new Map(spec.products.map((produkt) => [produkt.id, produkt]));

  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {spec.useCases.map((fall) => {
        const produkt = nachId.get(fall.pickId);
        return (
          <li
            key={fall.id}
            className="grid gap-1 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-baseline md:gap-6"
          >
            <div>
              <p className="font-medium text-ink">{fall.situation}</p>
              <p className="caption-xs mt-1 text-ink-soft">{fall.why}</p>
            </div>
            {produkt ? (
              <a
                href={`#p-${produkt.id}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-oxide underline-offset-2 hover:underline md:justify-self-end"
              >
                {produkt.brand} {produkt.name}
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
