'use client';

import React, { useCallback, useRef, useState } from 'react';
import { SearchX, X } from 'lucide-react';
import {
  DEFAULT_OPEN_CATEGORY,
  deviceAssistant,
  groupByCategory,
  useComponentCatalog,
} from './sidebar/catalog';
import { CategorySection } from './sidebar/CategorySection';
import { SidebarSearch } from './sidebar/SidebarSearch';
import { searchRank } from './sidebar/catalog';
import { addAtVisibleCenter } from './sidebar/drag';
import { Box } from 'lucide-react';

interface SidebarProps {
  mode?: 'electric' | 'water';
  onMobileAdd?: () => void;
  /**
   * Schließt das Blatt auf dem Handy. Der Knopf erscheint nur dort
   * (`md:hidden`): Ab Tablet ist der Katalog eine Spalte mit eigenem
   * Einklapp-Griff an der Panelkante.
   */
  onCloseMobile?: () => void;
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
export function Sidebar({ mode = 'electric', onMobileAdd, onCloseMobile }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  // Die Kategorien sind einzelne listbox-Gruppen, teilen sich aber genau eine
  // aktive Katalogoption. So bleibt die zuletzt fokussierte/aktivierte Zeile
  // auch nach dem Hinzufügen sichtbar ausgewählt.
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeComponents = useComponentCatalog(mode);
  const isSearching = searchTerm.trim().length > 0;
  // R8-07: Synonyme + Rang (Name vor Beschreibung) statt reiner
  // Enthalten-Suche über Label+Beschreibung in einem String.
  const ranked = <T extends { label: string; description: string }>(items: readonly T[]): T[] =>
    items
      .map((item) => ({ item, rank: searchRank(item, searchTerm) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.item);
  const filteredComponents = isSearching ? ranked(activeComponents) : activeComponents;
  const filteredDevices =
    mode === 'electric' ? (isSearching ? ranked(deviceAssistant) : deviceAssistant) : [];

  // „Eigenes Gerät anlegen“ bei 0 Treffern (R8-07): Watt + Stunden/Tag,
  // dann liegt das Gerät wie jedes andere auf der Fläche.
  const [customWatts, setCustomWatts] = useState(50);
  const [customHours, setCustomHours] = useState(2);
  const addCustomDevice = () => {
    const label = searchTerm.trim();
    if (!label) return;
    addAtVisibleCenter(
      {
        type: 'consumer',
        label,
        category: 'Geräte-Vorlagen',
        description: 'Eigenes Gerät',
        icon: Box,
        watts: customWatts,
        hours: customHours,
      },
      onMobileAdd
    );
    setSearchTerm('');
  };

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
        <span className="flex items-center gap-2">
          <span
            className="text-xs text-muted-foreground tabular-nums"
            title="So viele Bauteile stehen im Katalog zur Auswahl — nicht die Anzahl im Plan"
          >
            {isSearching ? `${resultCount} Treffer` : `${activeComponents.length} im Katalog`}
          </span>
          {onCloseMobile && (
            <button
              type="button"
              data-testid="sidebar-close"
              onClick={onCloseMobile}
              className="cad-btn h-11 w-11 justify-center md:hidden"
              aria-label="Bauteilkatalog schließen"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      <div className="border-b border-border p-2">
        <SidebarSearch value={searchTerm} onChange={setSearchTerm} onEnter={focusFirstRow} />
      </div>

      <div
        ref={listRef}
        /* Scroll-Körper des Katalogs: E2E-Vertrag für „das Panel scrollt nur
           sich selbst" (tests/e2e/scroll-architecture.spec.ts). */
        data-testid="sidebar-scroll"
        className="cad-panel__body cad-scroll"
      >
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
                selectedKey={selectedComponent}
                onSelect={setSelectedComponent}
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
                selectedKey={selectedComponent}
                onSelect={setSelectedComponent}
                onNavigate={navigateRows}
              />
            )}
          </>
        ) : (
          <div className="cad-empty">
            <SearchX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="cad-empty__title">Keine Treffer für „{searchTerm}“</p>
            <p>Prüfe die Schreibweise oder setze den Filter zurück.</p>
            {mode === 'electric' && (
              <div className="mt-3 space-y-2 text-left">
                <p className="text-sm font-medium text-foreground">
                  Oder lege „{searchTerm.trim()}“ als eigenes Gerät an:
                </p>
                <label className="block text-xs text-muted-foreground">
                  Leistung (Watt)
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={customWatts}
                    onChange={(event) => setCustomWatts(Number(event.target.value) || 0)}
                    className="mt-1 min-h-11 w-full rounded border border-border bg-card px-2 text-sm text-foreground"
                  />
                </label>
                <label className="block text-xs text-muted-foreground">
                  Nutzung (Stunden pro Tag)
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={customHours}
                    onChange={(event) => setCustomHours(Number(event.target.value) || 0)}
                    className="mt-1 min-h-11 w-full rounded border border-border bg-card px-2 text-sm text-foreground"
                  />
                </label>
                <button
                  type="button"
                  onClick={addCustomDevice}
                  data-testid="sidebar-custom-device"
                  className="cad-btn cad-btn--primary min-h-11 w-full justify-center"
                >
                  Eigenes Gerät „{searchTerm.trim()}“ anlegen
                </button>
              </div>
            )}
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
