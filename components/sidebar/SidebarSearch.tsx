import React from 'react';
import { Search, X } from 'lucide-react';

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter: Fokus auf die erste Trefferzeile — Tastaturbedienung der Palette. */
  onEnter?: () => void;
}

/**
 * Suchfeld der Komponentenpalette. Bewusst kontrolliert: Der Suchbegriff und
 * damit das Filterergebnis bleiben in der Sidebar, das Feld rendert nur.
 * Enter springt in die Trefferliste (dort fügt Enter das Bauteil hinzu),
 * Escape leert den Filter.
 */
export function SidebarSearch({ value, onChange, onEnter }: SidebarSearchProps) {
  return (
    <div className="relative flex items-center">
      <label htmlFor="component-search" className="sr-only">
        Suche nach Komponenten
      </label>
      <Search
        className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id="component-search"
        data-testid="sidebar-search"
        type="search"
        placeholder="Komponente suchen…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter?.();
          } else if (event.key === 'Escape') {
            onChange('');
          }
        }}
        className="focus:border-accent-line min-h-9 w-full border border-rule-strong bg-surface-raised pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-0 flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter zurücksetzen"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
