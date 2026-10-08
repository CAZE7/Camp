'use client';

import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InspectorSectionProps {
  /** Technische Gruppenüberschrift (Allgemein, Elektrisch, Anschluss, Berechnung). */
  title: string;
  /**
   * Schlüssel-Eigenschaften stehen offen, erweiterte Werte eingeklappt
   * (schrittweise Offenlegung statt Wertewand).
   */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Eigenschafts-Sektion des Inspectors: Titelzeile in Kapitälchen-Mono, darunter
 * die Felder. Klappbar, damit die alltäglichen Werte oben stehen und
 * Spezialwerte erst auf Klick erscheinen. Reine Ordnung — keine Karten, keine
 * Farbflächen.
 */
export function InspectorSection({ title, defaultOpen = false, children }: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section
      className="de-inspector__group"
      data-testid={`inspector-section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
      data-open={open ? 'true' : 'false'}
    >
      <h3 className="de-inspector__group-title">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="de-inspector__group-toggle"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open ? '' : '-rotate-90')}
            aria-hidden="true"
          />
          <span className="flex-1 truncate text-left">{title}</span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="de-inspector__group-body flex flex-col gap-3">
        {children}
      </div>
    </section>
  );
}
