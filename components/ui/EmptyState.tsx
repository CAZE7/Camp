'use client';

import React from 'react';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
}

export function EmptyState({ title, description, actionLabel, onAction, icon, hint }: EmptyStateProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
      <div className="pointer-events-auto mx-4 flex max-w-sm flex-col items-center rounded-xl border border-border bg-card/95 p-6 text-center shadow-2xl sm:p-8">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          {icon ?? <Compass className="h-10 w-10 text-primary" strokeWidth={1.5} />}
        </div>
        <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        {actionLabel && onAction && (
          <Button onClick={onAction} className="mt-6 min-h-[44px] px-6" size="lg">
            {actionLabel}
          </Button>
        )}
        {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
