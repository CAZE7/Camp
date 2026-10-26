import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Repeat2 } from 'lucide-react';
import type { RoutingStatusTone, RoutingStatusView } from './routingStatusView';

/**
 * Kabeltrassen-Teil des gemeinsamen Prüfberichts.
 *
 * Er zeigt dieselben Aussagen wie früher die eigene Plakette in der
 * Werkzeugleiste (AUDIT F-07, ROUTE-BUG-36, Spec #19) — nur im Bericht statt
 * als zweite Zahl neben der Planungsprüfung. Die Kennungen
 * (`routing-status-valid`, `-invalid`, `-not-converged`, `-error`, …) bleiben
 * unverändert; sie hängen jetzt am Berichtsteil statt am Chip.
 */
const TONE: Record<
  RoutingStatusTone,
  { wrap: string; icon: ReactNode; labelClass: string; heading: string }
> = {
  ok: {
    wrap: 'border-success/40 bg-success/10',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />,
    labelClass: 'text-success',
    heading: 'Kabeltrassen',
  },
  warn: {
    wrap: 'border-oxide/50 bg-oxide/10',
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-oxide" aria-hidden="true" />,
    labelClass: 'text-oxide',
    heading: 'Kabeltrassen',
  },
  bad: {
    wrap: 'border-error/50 bg-error/10',
    icon: <Repeat2 className="text-error h-4 w-4 shrink-0" aria-hidden="true" />,
    labelClass: 'text-error',
    heading: 'Kabeltrassen',
  },
  neutral: {
    wrap: 'border-border bg-accent',
    icon: <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
    labelClass: 'text-foreground',
    heading: 'Kabeltrassen',
  },
};

export function RoutingStatusSummary({ view }: { view: RoutingStatusView }) {
  const tone = TONE[view.tone];
  return (
    <section
      data-testid={view.testId}
      aria-label={view.label}
      title={view.details.join(' — ')}
      className={`rounded border border-l-4 p-3 text-sm ${tone.wrap}`}
    >
      <div className="flex items-center gap-2">
        {tone.icon}
        <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{tone.heading}</h4>
      </div>
      <p className={`mt-1 font-bold ${tone.labelClass}`}>{view.label}</p>
      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs text-foreground">
        {view.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </section>
  );
}
