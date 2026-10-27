import { cn } from '@/lib/utils';

/**
 * components/brand/SiteSection.tsx — ein Abschnitt mit genau einer H2.
 *
 * Vorher baute jede Seite ihre Abschnittsköpfe selbst: mal `h2` mit
 * `text-lg`, mal ein `div` mit `panel-title`, mal gar keine Überschrift. Die
 * Folge war eine Hierarchie, die pro Seite neu erfunden wurde — und Anker,
 * die mal auf die Überschrift, mal auf den Abschnitt zeigten.
 *
 * Hier steht die eine Form:
 *   - der Abschnitt trägt `id`, die Überschrift `id + '-heading'`,
 *   - damit zeigt ein Verweis (`#werkzeuge-heading`) immer auf die
 *     Überschrift und springt mit `scroll-mt` unter die Kopfleiste,
 *   - Kicker (Versalien, Akzent), H2 und eine kurze Einleitung,
 *   - rechts daneben Platz für einen Stempel (Anzahl, Maß, Stand).
 *
 * Kein Zustand, kein Client: reines Gerüst, das ohne JavaScript steht.
 */
export interface SiteSectionProps {
  /** Anker des Abschnitts OHNE `#` — die Überschrift bekommt `${id}-heading`. */
  id: string;
  /** Versalien über der Überschrift (Thema // Einordnung). */
  kicker?: string;
  /** Die einzige H2 des Abschnitts. */
  title: string;
  /** Ein bis zwei Sätze unter der Überschrift. */
  lead?: string;
  /** Stempel rechts neben der Überschrift (z. B. „4 WERKZEUGE“). */
  aside?: React.ReactNode;
  /** Versteckt die Linie unter dem Kopf (z. B. direkt nach dem Hero). */
  bare?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function SiteSection({
  id,
  kicker,
  title,
  lead,
  aside,
  bare = false,
  className,
  bodyClassName,
  children,
}: SiteSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className={cn('scroll-mt-20', className)}>
      <div
        className={cn(
          'flex flex-wrap items-end justify-between gap-x-4 gap-y-2',
          !bare && 'border-b border-rule pb-3'
        )}
      >
        <div className="min-w-0">
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h2 id={headingId} className="h2 mt-1">
            {title}
          </h2>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {lead ? <p className="prose-measure mt-4 text-sm leading-relaxed text-ink-soft">{lead}</p> : null}
      <div className={cn('mt-5', bodyClassName)}>{children}</div>
    </section>
  );
}
