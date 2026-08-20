"use client";

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
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
      <div className="bg-card/90 backdrop-blur-sm border border-border p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm text-center pointer-events-auto">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          {icon ?? <Compass className="w-10 h-10 text-primary" strokeWidth={1.5} />}
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-3">
          {title}
        </h2>
        <p className="text-muted-foreground">
          {description}
        </p>
        {actionLabel && onAction && (
          <Button onClick={onAction} className="mt-6 min-h-[44px] px-6" size="lg">
            {actionLabel}
          </Button>
        )}
        {hint && (
          <p className="text-xs text-muted-foreground mt-3">{hint}</p>
        )}
      </div>
    </div>
  );
}
