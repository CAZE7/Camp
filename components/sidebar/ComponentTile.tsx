import React, { useRef } from 'react';
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
  const desktopDragStarted = useRef(false);
  const keyboardAddHandled = useRef(false);

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
      onPointerDown={(event) => {
        desktopDragStarted.current = handlePointerDown(event, comp);
      }}
      onClick={() => {
        // A started mouse ghost drag owns this click, even if it was released
        // outside the canvas. Every other activation (touch, pen, assistive
        // technology) adds directly at the current canvas centre.
        if (desktopDragStarted.current) {
          desktopDragStarted.current = false;
          return;
        }
        if (keyboardAddHandled.current) {
          keyboardAddHandled.current = false;
          return;
        }
        addAtVisibleCenter(comp, onMobileAdd);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          keyboardAddHandled.current = true;
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
