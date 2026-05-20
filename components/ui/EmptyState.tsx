"use client";

import React from 'react';
import { Compass } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
      <div className="bg-card/80 backdrop-blur-sm border border-border p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm text-center pointer-events-auto">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Compass className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-3">
          {title}
        </h2>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
