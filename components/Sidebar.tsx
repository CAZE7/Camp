'use client';

import React, { useCallback, useRef, useState } from 'react';
import { SearchX } from 'lucide-react';
import {
  DEFAULT_OPEN_CATEGORY,
  deviceAssistant,
  groupByCategory,
  useComponentCatalog,
} from './sidebar/catalog';
import { CategorySection } from './sidebar/CategorySection';
import { SidebarSearch } from './sidebar/SidebarSearch';

interface SidebarProps {
  mode?: 'electric' | 'water';
  onMobileAdd?: () => void;
}

/**
 * Komponentenpalette — Werkzeugkasten des Planers, keine Kartenfläche.
 *
 * Aufbau wie in technischer Software: Kopfzeile, feste Suchzeile, darunter die
 * kategorisierte Liste mit kompakten Zeilen. Die Suche ist zentral („wechsel…“
 * → „Wechselrichter“), Tastatur inklusive: Pfeiltasten laufen durch alle
 * Treffer, Enter fügt hinzu, Escape leert den Filter. Ziehen mit der Maus ist
 * der zweite Weg, Antippen der dritte.
 *
 * Diese Datei hält nur die Schale — Suchbegriff, Kategorien-Zustand und
 * Komposition. Daten und reine Funktionen liegen in `sidebar/catalog.ts`,
 * Hinzufügen und Ghost-Drag in `sidebar/drag.ts`.
 */
export function Sidebar({ mode = 'electric', onMobileAdd }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const activeComponents = useComponentCatalog(mode);
  const isSearching = searchTerm.trim().length > 0;
  const matches = (label: string, description: string) =>
    `${label} ${description}`.toLowerCase().includes(searchTerm.toLowerCase());
  const filteredComponents = activeComponents.filter((item) => matches(item.label, item.description));
  const filteredDevices =
    mode === 'electric' ? deviceAssistant.filter((item) => matches(item.label, item.description)) : [];

  const { categories, byCategory } = groupByCategory(filteredComponents);

  const defaultOpen = DEFAULT_OPEN_CATEGORY[mode];
  const isCatOpen = (category: string) =>
    isSearching || (category in manualOpen ? manualOpen[category] === true : category === defaultOpen);
  const toggleCat = (category: string) =>
    setManualOpen((previous) => ({
      ...previous,
      [category]: !(category in previous ? previous[category] : category === defaultOpen),
    }));
  const devicesOpen = isSearching || (manualOpen.__devices ?? false);
  const hasAnyResult = filteredComponents.length > 0 || filteredDevices.length > 0;
  const resultCount = filteredComponents.length + filteredDevices.length;

  /**
   * Pfeiltasten laufen durch die Zeilen quer über die Gruppen hinweg (wie in
   * einer Liste, nicht wie in getrennten Listen) — inklusive Fokuswechsel,
   * damit der nächste Schritt ohne Maus erreichbar ist.
   */
  const navigateRows = useCallback((direction: 1 | -1) => {
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[data-testid="sidebar-item"]') ?? []
    );
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = rows[index + direction];
    (next ?? rows[0])?.focus();
  }, []);

  const focusFirstRow = useCallback(() => {
    listRef.current?.querySelector<HTMLButtonElement>('[data-testid="sidebar-item"]')?.focus();
  }, []);

  return (
    <aside
      data-testid="sidebar"
      className="cad-panel w-full border-r border-border"
      aria-label={mode === 'water' ? 'Wasser-Komponenten' : 'Elektrik-Komponenten'}
    >
      <div className="cad-panel__head">
        <h2 className="panel-title">Komponenten</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {isSearching ? `${resultCount} Treffer` : `${activeComponents.length} Bauteile`}
        </span>
      </div>

      <div className="border-b border-border p-2">
        <SidebarSearch value={searchTerm} onChange={setSearchTerm} onEnter={focusFirstRow} />
      </div>

      <div ref={listRef} className="cad-panel__body cad-scroll">
        {hasAnyResult ? (
          <>
            {categories.map((category) => (
              <CategorySection
                key={category}
                title={category}
                items={byCategory[category] ?? []}
                open={isCatOpen(category)}
                onToggle={() => toggleCat(category)}
                onMobileAdd={onMobileAdd}
                accent="default"
                onNavigate={navigateRows}
              />
            ))}
            {mode === 'electric' && filteredDevices.length > 0 && (
              <CategorySection
                title="Geräte-Vorlagen"
                items={filteredDevices}
                open={devicesOpen}
                onToggle={() =>
                  setManualOpen((previous) => ({ ...previous, __devices: !(previous.__devices ?? false) }))
                }
                onMobileAdd={onMobileAdd}
                accent="device"
                onNavigate={navigateRows}
              />
            )}
          </>
        ) : (
          <div className="cad-empty">
            <SearchX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="cad-empty__title">Keine Treffer für „{searchTerm}“</p>
            <p>Prüfe die Schreibweise oder setze den Filter zurück.</p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="cad-btn cad-btn--line mt-1 min-h-11 self-start"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
