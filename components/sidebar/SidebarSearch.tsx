import React from 'react';
import { Search, XCircle } from 'lucide-react';

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Suchfeld der Bauteil-Katalog-Spalte. Bewusst kontrolliert: Der
 * Suchbegriff und damit das Filterergebnis bleiben in der Sidebar, das
 * Feld rendert nur.
 */
export function SidebarSearch({ value, onChange }: SidebarSearchProps) {
  return (
    <div className="relative flex items-center">
      <label htmlFor="component-search" className="sr-only">Komponenten durchsuchen</label>
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <input
        id="component-search"
        data-testid="sidebar-search"
        type="search"
        placeholder="Suchen..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-border bg-card pl-9 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter zurücksetzen"
        >
          <XCircle className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
