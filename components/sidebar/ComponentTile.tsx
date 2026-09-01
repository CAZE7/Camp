import React from 'react';
import { cn } from '@/lib/utils';
import { addAtVisibleCenter, handlePointerDown } from './drag';
import type { Comp } from './catalog';

interface ComponentTileProps {
  comp: Comp;
  onMobileAdd?: () => void;
  accent: 'default' | 'device';
}

export function ComponentTile({ comp, onMobileAdd, accent }: ComponentTileProps) {
  const Icon = comp.icon;
  return (
    <button
      type="button"
      // Stabile Selektoren für die E2E-Tests (docs/E2E-TESTS.md).
      // Der Typ steht als eigenes Attribut, weil dieselbe Komponente auch
      // als Geräte-Vorlage mehrfach vorkommt (z. B. mehrere consumer230v).
      data-testid="sidebar-item"
      data-component-type={comp.type}
      data-component-label={comp.label}
      data-accent={accent}
      className={cn(
        'flex min-h-24 w-full touch-manipulation flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:cursor-grab',
        accent === 'device'
          ? 'border-border bg-accent text-accent-foreground hover:bg-secondary'
          : 'border-border bg-card text-foreground hover:bg-accent'
      )}
      onPointerDown={(event) => handlePointerDown(event, comp, onMobileAdd)}
      onClick={() => {
        if (window.innerWidth < 1024) addAtVisibleCenter(comp, onMobileAdd);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          addAtVisibleCenter(comp, onMobileAdd);
        }
      }}
      aria-label={`${comp.label} hinzufügen. ${comp.description}`}
      title={`${comp.label}: ${comp.description}`}
    >
      <Icon className="h-5 w-5 shrink-0 text-copper" aria-hidden="true" />
      <span className="line-clamp-2 font-semibold leading-tight">{comp.label}</span>
      {comp.watts !== undefined && (
        <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-xs text-copper">
          {comp.watts} W
        </span>
      )}
    </button>
  );
}
