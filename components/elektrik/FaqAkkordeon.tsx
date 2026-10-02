import { ChevronDown } from 'lucide-react';

import type { FaqEntry } from './electricContent';

/**
 * Fragen und Antworten als Aufklappliste.
 *
 * Bewusst `details`/`summary` statt einer Zustandskomponente: Der Inhalt steht
 * damit schon im ausgelieferten HTML (keine Hydration nötig, kein Sprung im
 * Layout, funktioniert auch ohne JavaScript) und Tastatur- sowie
 * Screenreader-Bedienung sind Browser-Standard. Die Antworttexte kommen aus
 * `electricContent.ts` und sind dieselben, die in der strukturierten
 * Beschreibung stehen.
 */
export function FaqAkkordeon({ entries }: { entries: readonly FaqEntry[] }) {
  return (
    <div className="divide-y divide-rule border border-rule bg-bone">
      {entries.map((entry) => (
        <details key={entry.question} className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-md font-medium text-ink transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink [&::-webkit-details-marker]:hidden">
            <span>{entry.question}</span>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-ink-soft transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <p className="px-4 pb-4 text-md leading-relaxed text-ink-soft">{entry.answer}</p>
        </details>
      ))}
    </div>
  );
}
