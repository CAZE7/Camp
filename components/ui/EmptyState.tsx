'use client';

import React from 'react';
import { MousePointerSquareDashed } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  /** Optionaler, klarer nächster Schritt (geführter Einstieg). */
  actionLabel?: string;
  onAction?: () => void;
  /** Optionales Icon (Standard: Kompass). */
  icon?: React.ReactNode;
  /** Kleiner Zusatzhinweis unter dem Button. */
  hint?: string;
  /**
   * Zusätzliche Klassen am Vollbild-Container — z. B. `pb-*`, damit die
   * Karte auf kleinen Bildschirmen über den schwebenden Canvas-Controls sitzt.
   */
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  hint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center ${className ?? ''}`.trim()}
    >
      <div className="pointer-events-auto mx-4 flex max-w-md flex-col items-start gap-2 border border-rule-strong bg-surface-panel p-4 text-left">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon ?? <MousePointerSquareDashed className="h-4 w-4" aria-hidden="true" />}
          <span className="panel-title">Leerer Plan</span>
        </span>
        <h2 className="text-md font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="cad-btn cad-btn--line mt-1 min-h-11">
            {actionLabel}
          </button>
        )}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
