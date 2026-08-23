"use client";

import React, { useState } from 'react';
import {
  Search, XCircle, ChevronDown, Lightbulb, Droplets,
  CookingPot, Coffee, Refrigerator, Flame, Fan, Laptop, Smartphone, Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '../store/usePlannerStore';
import { listSelectableSpecs, type ComponentSpec } from './registry';

type Comp = {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: React.ElementType;
  watts?: number;
};

/**
 * Bauteil-Katalog aus der Registry (K4).
 *
 * Vorher standen Label, Kategorie, Beschreibung und Icon hier — und dieselben
 * Labels nochmal in der Stückliste. Jetzt gibt es eine Quelle:
 * `components/registry`. Ein dort registriertes Bauteil erscheint
 * automatisch in dieser Liste.
 */
const toComp = (spec: ComponentSpec): Comp => ({
  type: spec.id,
  label: spec.label,
  category: spec.category,
  description: spec.description,
  icon: spec.icon,
});

/**
 * Der Katalog wird bei jedem Rendern aus der Registry gelesen, nicht einmalig
 * beim Laden des Moduls. Sonst wäre ein nachträglich registriertes Bauteil
 * (Plugin, Test, künftige Lazy-Registrierung) unsichtbar — genau das hat der
 * Registry-Test aufgedeckt.
 */
const useComponentCatalog = (mode: 'electric' | 'water'): Comp[] =>
  React.useMemo(() => listSelectableSpecs(mode).map(toComp), [mode]);

/**
 * Geräte-Vorlagen sind KEINE eigenen Bauteiltypen, sondern vorbelegte
 * Varianten vorhandener Typen (gleicher `type`, anderer Name und Wattwert).
 * Sie bleiben deshalb bewusst eine eigene Liste — eine Registrierung als
 * Bauteil würde doppelte IDs erzeugen.
 */
const deviceAssistant: Comp[] = [
  { type: 'consumer230v', label: 'Induktionskochfeld', watts: 2000, category: 'Geräte-Vorlagen', description: 'Typischer starker 230-V-Verbraucher.', icon: CookingPot },
  { type: 'consumer230v', label: 'Kaffeemaschine', watts: 1500, category: 'Geräte-Vorlagen', description: 'Typischer kurzzeitiger 230-V-Verbraucher.', icon: Coffee },
  { type: 'consumer', label: 'Kompressorkühlschrank', watts: 60, category: 'Geräte-Vorlagen', description: 'Effizienter 12-V-Kühlschrank.', icon: Refrigerator },
  { type: 'consumer', label: 'Standheizung', watts: 40, category: 'Geräte-Vorlagen', description: '12-V-Strombedarf einer Dieselheizung.', icon: Flame },
  { type: 'consumer', label: 'Dachventilator', watts: 30, category: 'Geräte-Vorlagen', description: 'Belüftung für den Wohnraum.', icon: Fan },
  { type: 'consumer', label: 'LED-Beleuchtung', watts: 20, category: 'Geräte-Vorlagen', description: 'Sparsame 12-V-Beleuchtung.', icon: Lightbulb },
  { type: 'consumer230v', label: 'Satelliten-Internet', watts: 50, category: 'Geräte-Vorlagen', description: 'Internet-Hardware mit Netzteil.', icon: Box },
  { type: 'consumer230v', label: 'Laptop-Ladegerät', watts: 65, category: 'Geräte-Vorlagen', description: '230-V-Netzteil für einen Laptop.', icon: Laptop },
  { type: 'consumer', label: 'Handyladegerät', watts: 18, category: 'Geräte-Vorlagen', description: 'USB-Ladeanschluss im 12-V-Netz.', icon: Smartphone },
  { type: 'consumer', label: 'Elektrische Wasserpumpe', watts: 40, category: 'Geräte-Vorlagen', description: 'Stromanschluss der Wasserpumpe.', icon: Droplets },
];

const DEFAULT_OPEN_CATEGORY: Record<'electric' | 'water', string> = {
  electric: 'Strom speichern',
  water: 'Speichern',
};

function addAtVisibleCenter(comp: Comp, onMobileAdd?: () => void) {
  const state = usePlannerStore.getState();
  const count = state.viewMode === 'water' ? state.waterNodes.length : state.nodes.length;
  // New touch-added cards start on a roomy two-column grid instead of all at
  // (0,0). This keeps their handles reachable before the user ever drags them.
  const position = { x: (count % 2) * 160, y: count * 160 };
  state.addNode(comp.type, comp.label, position, comp.watts);
  onMobileAdd?.();
  // React Flow updates its measured-node map one frame after the Zustand
  // render. Fit on the following frame so a newly added off-screen card is
  // included instead of being left unreachable with visible-elements culling.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('planner-fit-view')));
  });
}

const handlePointerDown = (event: React.PointerEvent, comp: Comp, onMobileAdd?: () => void) => {
  // Unterhalb des Desktop-Layouts wird erst der vollständige Klick ausgewertet,
  // damit ein Scrollversuch in der Liste nicht versehentlich etwas hinzufügt.
  if (window.innerWidth < 1024) return;
  event.preventDefault();

  const target = event.currentTarget as HTMLElement;
  const clone = target.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.zIndex = '9999';
  clone.style.opacity = '0.85';
  clone.style.pointerEvents = 'none';
  clone.style.width = `${target.offsetWidth}px`;
  clone.style.left = `${event.clientX - target.offsetWidth / 2}px`;
  clone.style.top = `${event.clientY - target.offsetHeight / 2}px`;
  document.body.appendChild(clone);

  const onPointerMove = (moveEvent: PointerEvent) => {
    clone.style.left = `${moveEvent.clientX - target.offsetWidth / 2}px`;
    clone.style.top = `${moveEvent.clientY - target.offsetHeight / 2}px`;
  };

  const cleanup = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', cleanup);
    clone.remove();
  };

  const onPointerUp = (upEvent: PointerEvent) => {
    const isOverCanvas = document.elementsFromPoint(upEvent.clientX, upEvent.clientY)
      .some((element) => element.classList.contains('react-flow__pane'));
    if (isOverCanvas) {
      window.dispatchEvent(new CustomEvent('custom-node-drop', {
        detail: {
          clientX: upEvent.clientX,
          clientY: upEvent.clientY,
          type: comp.type,
          label: comp.label,
          watts: comp.watts,
        },
      }));
    }
    cleanup();
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', cleanup);
};

interface SidebarProps {
  mode?: 'electric' | 'water';
  onMobileAdd?: () => void;
}

function ComponentTile({ comp, onMobileAdd, accent }: { comp: Comp; onMobileAdd?: () => void; accent: 'default' | 'device' }) {
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
      {comp.watts !== undefined && <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-xs text-copper">{comp.watts} W</span>}
    </button>
  );
}

function CategorySection({ title, items, open, onToggle, onMobileAdd, accent }: {
  title: string; items: Comp[]; open: boolean; onToggle: () => void; onMobileAdd?: () => void; accent: 'default' | 'device';
}) {
  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title} ({items.length})</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open ? '' : '-rotate-90')} aria-hidden="true" />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 p-3 pt-1">
          {items.map((comp) => (
            <ComponentTile key={`${comp.type}-${comp.label}`} comp={comp} onMobileAdd={onMobileAdd} accent={accent} />
          ))}
        </div>
      )}
    </section>
  );
}

export function Sidebar({ mode = 'electric', onMobileAdd }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const activeComponents = useComponentCatalog(mode);
  const isSearching = searchTerm.trim().length > 0;
  const matches = (label: string, description: string) => `${label} ${description}`.toLowerCase().includes(searchTerm.toLowerCase());
  const filteredComponents = activeComponents.filter((item) => matches(item.label, item.description));
  const filteredDevices = mode === 'electric' ? deviceAssistant.filter((item) => matches(item.label, item.description)) : [];

  const componentCategories: string[] = [];
  const componentsByCategory: Record<string, Comp[]> = {};
  for (const component of filteredComponents) {
    if (!componentsByCategory[component.category]) {
      componentsByCategory[component.category] = [];
      componentCategories.push(component.category);
    }
    componentsByCategory[component.category].push(component);
  }

  const defaultOpen = DEFAULT_OPEN_CATEGORY[mode];
  const isCatOpen = (category: string) => isSearching || (category in manualOpen ? manualOpen[category] : category === defaultOpen);
  const toggleCat = (category: string) => setManualOpen((previous) => ({
    ...previous,
    [category]: !(category in previous ? previous[category] : category === defaultOpen),
  }));
  const devicesOpen = isSearching || (manualOpen.__devices ?? false);
  const hasAnyResult = filteredComponents.length > 0 || filteredDevices.length > 0;

  return (
    <aside data-testid="sidebar" className="flex h-full w-full flex-col border-r border-border bg-paper lg:w-72" aria-label={mode === 'water' ? 'Wasser-Komponenten' : 'Elektrik-Komponenten'}>
      <div className="border-b border-border bg-accent p-4">
        <h2 className="text-base font-black text-foreground">Komponenten</h2>
        <p className="mt-1 text-xs text-muted-foreground">Antippen oder per Tastatur hinzufügen; am Desktop auch ziehen.</p>
      </div>

      <div className="border-b border-border p-4">
        <div className="relative flex items-center">
          <label htmlFor="component-search" className="sr-only">Komponenten durchsuchen</label>
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="component-search"
            data-testid="sidebar-search"
            type="search"
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-card pl-9 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter zurücksetzen"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {hasAnyResult ? (
          <div className="flex flex-col gap-3">
            {componentCategories.map((category) => (
              <CategorySection
                key={category}
                title={category}
                items={componentsByCategory[category]}
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
                onToggle={() => setManualOpen((previous) => ({ ...previous, __devices: !(previous.__devices ?? false) }))}
                onMobileAdd={onMobileAdd}
                accent="device"
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            <Search className="h-8 w-8" aria-hidden="true" />
            <p>Keine Treffer für „{searchTerm}“</p>
            <button type="button" onClick={() => setSearchTerm('')} className="min-h-11 rounded-lg border border-border bg-card px-4 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
