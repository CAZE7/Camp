import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * components/brand/GuideCard.tsx — eine Karte für einen Leitfaden.
 *
 * Bewusst breiter und ruhiger als die Werkzeugkarte: Ein Guide wird gelesen,
 * nicht geklickt und wieder verlassen. Die Karte trägt deshalb eine Ordnungs-
 * zahl (die Reihenfolge, in der die Guides gedacht sind), eine Einordnung und
 * ein Maß — damit die Auswahl vor dem Klick möglich ist.
 *
 * Die Ordnungszahl steht in der Werteschrift (Mono) und im Akzent: Mono ist
 * im Projekt den Werten vorbehalten, und eine Zahl ist ein Wert.
 */
export interface GuideCardProps {
  href: string;
  title: string;
  body: string;
  /** Ordnungszahl als Text — „01“ bis „99“. */
  index?: string;
  /** Einordnung rechts oben, z. B. „Reihenfolge“ oder „Technik“. */
  meta?: string;
  /** Was den Guide erwartbar macht: Länge, Schritte, Stand. */
  facts?: readonly string[];
  cta?: string;
  className?: string;
}

export function GuideCard({
  href,
  title,
  body,
  index,
  meta,
  facts,
  cta = 'Lesen',
  className,
}: GuideCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'node-card group flex h-full flex-col gap-3 rounded p-5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxide',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {index ? (
          <span className="font-mono text-xs font-medium text-oxide" aria-hidden="true">
            {index}
          </span>
        ) : null}
        {meta ? <span className="panel-title ml-auto">{meta}</span> : null}
      </div>
      <h3 className="font-display text-lg leading-snug font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
      {facts && facts.length > 0 ? (
        <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1">
          {facts.map((fact) => (
            <li key={fact} className="caption-xs text-ink-soft">
              {fact}
            </li>
          ))}
        </ul>
      ) : null}
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-copper">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
