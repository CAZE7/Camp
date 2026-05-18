"use client";

import React from 'react';
import { Compass, Plus } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  onAdd: () => void;
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
      <div className="bg-card/80 backdrop-blur-sm border border-border p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm text-center pointer-events-auto">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Compass className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-3">
          Dein System ist noch leer.
        </h2>
        <p className="text-muted-foreground mb-8">
          Beginne dein Abenteuer, indem du erste Komponenten zu deiner Planung hinzufügst.
        </p>
        <Button onClick={onAdd} className="w-full gap-2 text-primary-foreground font-bold" size="lg">
          <Plus className="w-5 h-5" />
          Erste Komponente hinzufügen
        </Button>
      </div>
    </div>
  );
}
