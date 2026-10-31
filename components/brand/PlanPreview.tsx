import { cn } from '@/lib/utils';

/**
 * components/brand/PlanPreview.tsx — was der Planer ausgibt, als Gerüst.
 *
 * Bewusst KEIN Bild: Die Startseite steht bildfrei im Testvertrag
 * (`app/page.test.tsx` erwartet `document.querySelector('img') === null`),
 * und ein Screenshot des Planers wäre nach der nächsten Layout-Runde veraltet.
 * Die Vorschau besteht deshalb aus dem, was der Planer wirklich zeichnet:
 * Bauteile, eine Trasse und die Beschriftung daran.
 *
 * Fachlich enthält sie bewusst keine Zahlen: Werte rechnet der Planer aus dem
 * Plan. Hier stünden sonst Beispielwerte ohne Prüfung — und ein Beispielwert
 * ohne Zusammenhang liest sich als Empfehlung.
 */
const REIHE: readonly { label: string; rolle: string }[] = [
  { label: 'Solar', rolle: 'Quelle' },
  { label: 'Laderegler', rolle: 'Ladetechnik' },
  { label: 'Batterie', rolle: 'Speicher' },
  { label: 'Verbraucher', rolle: 'Last' },
];

export function PlanPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded border border-rule bg-surface-canvas p-4', className)}
      // Reine Veranschaulichung: die Liste darunter nennt dieselben Bauteile
      // als Text, die Grafik wiederholt sie nur.
      aria-hidden="true"
    >
      <div className="relative pl-1">
        {/* Trasse: eine 1-px-Linie hinter den Bauteilen, wie auf der
            Zeichenfläche — kein Deko-Raster, sondern die Leitung selbst. */}
        <span className="absolute top-4 bottom-4 left-[0.3125rem] w-px bg-rule-strong" aria-hidden="true" />
        <ul className="space-y-2.5">
          {REIHE.map((element) => (
            <li key={element.label} className="relative flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-oxide bg-surface-panel" />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded border border-rule bg-surface-raised px-2 py-1.5">
                <span className="truncate text-xs font-medium text-ink">{element.label}</span>
                <span className="caption-xs shrink-0 text-ink-soft">{element.rolle}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {/* Beschriftung an der Leitung: im Planer stehen hier Querschnitt und
          Länge — hier nur die Form, keine Werte. */}
      <p className="mt-3 border-t border-rule pt-2">
        <span className="inline-flex items-center gap-1.5 rounded border border-rule bg-surface-panel px-2 py-1 font-mono text-xs text-ink">
          Querschnitt · Länge
        </span>
      </p>
    </div>
  );
}
