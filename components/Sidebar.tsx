'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
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
 * Linke Spalte des Planers: Bauteil-Katalog (Registry) + Geräte-Vorlagen.
 *
 * Diese Datei hält nur noch die Schale — Suchbegriff, Kategorien-Zustand und
 * die Komposition. Daten und reine Funktionen liegen in `sidebar/catalog.ts`,
 * Hinzufügen und Ghost-Drag in `sidebar/drag.ts`, Kachel, Kategorie und
 * Suchfeld in eigenen Komponenten. Ehemals 300+ Zeilen in einem File.
 */
export function Sidebar({ mode = 'electric', onMobileAdd }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
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

  return (
    <aside
      data-testid="sidebar"
      className="flex h-full w-full flex-col border-r border-border bg-paper lg:w-72"
      aria-label={mode === 'water' ? 'Wasser-Komponenten' : 'Elektrik-Komponenten'}
    >
      <div className="border-b border-border bg-accent p-4">
        <h2 className="panel-title">Komponenten</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Antippen oder per Tastatur hinzufügen; am Desktop auch ziehen.
        </p>
      </div>

      <div className="border-b border-border p-4">
        <SidebarSearch value={searchTerm} onChange={setSearchTerm} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {hasAnyResult ? (
          <div className="flex flex-col gap-3">
            {categories.map((category) => (
              <CategorySection
                key={category}
                title={category}
                items={byCategory[category] ?? []}
                open={isCatOpen(category)}
                onToggle={() => toggleCat(category)}
                onMobileAdd={onMobileAdd}
                accent="default"
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
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            <Search className="h-8 w-8" aria-hidden="true" />
            <p>Keine Treffer für „{searchTerm}“</p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="min-h-11 rounded-lg border border-border bg-card px-4 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
