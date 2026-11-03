import { rangfolge } from '@/lib/seo/comparisons/rangfolge';
import type { ComparisonSpec } from '@/lib/seo/comparisons/types';

import { Einsatzfaelle } from './Einsatzfaelle';
import { Produktkarte } from './Produktkarte';
import { Rangliste } from './Rangliste';
import { Vergleichssteuerung } from './Vergleichssteuerung';

/**
 * components/vergleich/Vergleichszone.tsx — der Vergleich, vor dem Ratgebertext.
 *
 * Drei Abschnitte in fester Reihenfolge: Rangliste zum Scannen, Einsatzfälle zur
 * Entscheidung, Karten zur Tiefe. Die Reihenfolge ist eine Zusage — Gate G4
 * prüft, dass die Rangliste im Dokument vor dem ersten Ratgeber-Abschnitt steht.
 *
 * Server Component ohne Zustand: Alles ist ohne JavaScript lesbar
 * (`tests/e2e/seo-nojs.spec.ts` prüft genau das). Filter und Sortierung legt
 * `Vergleichssteuerung` nach, und die Steuerknöpfe bleiben ohne Skript
 * ausgeblendet.
 */
export function Vergleichszone({ spec }: { spec: ComparisonSpec }) {
  const geraete = rangfolge(spec.products);
  const rangliste = `${spec.id}-rangliste`;
  const einsatzfaelle = `${spec.id}-einsatzfaelle`;
  const geraeteTitel = `${spec.id}-geraete`;

  return (
    <div id={`vergleich-${spec.id}`} data-vergleich={spec.id} className="space-y-12">
      <Vergleichssteuerung zone={spec.id} />

      <section id={rangliste} aria-labelledby={`${rangliste}-titel`} className="scroll-mt-20">
        <p className="kicker">Vergleich</p>
        <h2 id={`${rangliste}-titel`} className="h2 mt-3">
          {spec.heading}
        </h2>
        <p className="caption-xs mt-2 text-ink-soft">{spec.priceAsOf}</p>
        <p className="prose-measure mt-3 text-md leading-relaxed text-ink-soft">{spec.noRatingNote}</p>
        <Rangliste spec={spec} geraete={geraete} />
      </section>

      <section id={einsatzfaelle} aria-labelledby={`${einsatzfaelle}-titel`} className="scroll-mt-20">
        <h2 id={`${einsatzfaelle}-titel`} className="h2">
          Welcher passt zu mir?
        </h2>
        <div className="mt-4">
          <Einsatzfaelle spec={spec} />
        </div>
      </section>

      <section id={geraeteTitel} aria-labelledby={`${geraeteTitel}-titel`} className="scroll-mt-20">
        <h2 id={`${geraeteTitel}-titel`} className="h2">
          Die Geräte im Detail
        </h2>
        <div data-vergleich-liste="karten" className="mt-4 grid gap-3 md:grid-cols-2">
          {geraete.map((produkt) => (
            <Produktkarte key={produkt.id} spec={spec} produkt={produkt} />
          ))}
        </div>

        <details className="mt-4 border border-rule bg-bone p-4">
          <summary className="panel-title cursor-pointer">Quellen, Preise und Transparenz</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {spec.sources.map((gruppe) => (
              <div key={gruppe.group}>
                <h3 className="caption-xs font-semibold text-ink">{gruppe.group}</h3>
                <ol className="mt-2 space-y-1">
                  {gruppe.entries.map((eintrag) => (
                    <li key={eintrag.href} className="caption-xs">
                      <a
                        href={eintrag.href}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="text-oxide underline underline-offset-2"
                      >
                        {eintrag.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
