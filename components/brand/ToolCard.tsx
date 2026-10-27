import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * components/brand/ToolCard.tsx — eine Karte für ein Werkzeug.
 *
 * Ein Werkzeug bekommt eine Karte mit eigenem Titel (`h3`), weil die Karte
 * unter einer H2 steht: Die Ebene sagt, was zusammengehört, nicht die
 * Schriftgröße. Vorher trug der Titel ein `span` — für Screenreader war die
 * Kartenzeile damit nur ein langer Verweistext ohne Gliederung.
 *
 * Der Akzent bleibt knapp: nur das Werkzeug, mit dem ein Plan beginnt, trägt
 * die Akzentkante. Würden alle vier Karten Akzent tragen, wäre keine mehr
 * hervorgehoben (Designkonzept 2026-10, „der eine Akzent“).
 */
export interface ToolCardProps {
  href: string;
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  /** Der Einstieg: Kante und Symbol tragen den Akzent. */
  primary?: boolean;
  /** Etikett oben rechts, z. B. „Starte hier“. */
  badge?: string;
  className?: string;
}

export function ToolCard({
  href,
  title,
  body,
  cta,
  icon: Icon,
  primary = false,
  badge,
  className,
}: ToolCardProps) {
  return (
    <Link
      href={href}
      data-recommended={badge ? 'true' : undefined}
      className={cn(
        'node-card group flex h-full min-h-44 flex-col justify-between gap-4 rounded p-4',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide',
        primary && 'border-oxide/40 hover:border-oxide',
        className
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded border border-rule bg-surface-raised',
              primary ? 'border-oxide text-oxide' : 'text-ink'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="min-w-0 flex-1 text-sm font-semibold text-ink">{title}</h3>
          {badge ? (
            <span className="panel-title shrink-0 border border-oxide/40 px-1.5 py-1 text-oxide">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-copper">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
