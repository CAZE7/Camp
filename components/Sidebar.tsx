"use client";

import React, { useState } from 'react';
import {
  Battery, Search, XCircle, ChevronDown, Gauge, Network, Sun, RefreshCw,
  PlugZap, Zap, Lightbulb, Shield, Earth, Cable, Droplets, Waves, Filter,
  ShowerHead, CookingPot, Coffee, Refrigerator, Flame, Fan, Laptop, Smartphone,
  Box, CircleGauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '../store/usePlannerStore';

type Comp = {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: React.ElementType;
  watts?: number;
};

const components: Comp[] = [
  { type: 'battery', label: 'Batterie', category: 'Strom speichern', description: 'Speichert Energie für alle Geräte.', icon: Battery },
  { type: 'shunt', label: 'Batteriemonitor (Shunt)', category: 'Strom verteilen', description: 'Misst zuverlässig, wie voll die Batterie ist.', icon: Gauge },
  { type: 'busbar', label: 'Sammelschiene', category: 'Strom verteilen', description: 'Verteilt Plus oder Minus auf mehrere Leitungen.', icon: Network },
  { type: 'mpptController', label: 'Solar-Laderegler (MPPT)', category: 'Strom laden', description: 'Passt Solarstrom sicher an die Batterie an.', icon: Sun },
  { type: 'dcdcCharger', label: 'Ladebooster (DC-DC)', category: 'Strom laden', description: 'Lädt während der Fahrt über die Lichtmaschine.', icon: RefreshCw },
  { type: 'acBatteryCharger', label: '230-V-Ladegerät', category: 'Strom laden', description: 'Lädt die Batterie über Landstrom.', icon: PlugZap },
  { type: 'solar', label: 'Solarmodul', category: 'Strom laden', description: 'Erzeugt unterwegs Energie aus Sonnenlicht.', icon: Sun },
  { type: 'inverter', label: 'Wechselrichter', category: '230 Volt', description: 'Wandelt Batteriespannung in 230 V um.', icon: RefreshCw },
  { type: 'shorePower', label: 'Landstromanschluss', category: '230 Volt', description: 'Verbindet den Camper mit dem Campingplatznetz.', icon: PlugZap },
  { type: 'consumer', label: '12-V-Gerät', category: 'Geräte', description: 'Allgemeines Gerät für das 12-V-Bordnetz.', icon: Lightbulb },
  { type: 'consumer230v', label: '230-V-Gerät', category: 'Geräte', description: 'Gerät, das 230 V Wechselspannung benötigt.', icon: Zap },
  { type: 'fuse', label: 'Sicherungskasten', category: 'Schutz & Einbau', description: 'Schützt Leitungen und verteilt abgesicherte Stromkreise.', icon: Shield },
  { type: 'ground', label: 'Massepunkt', category: 'Schutz & Einbau', description: 'Gemeinsamer Minus- oder Karosserieanschluss.', icon: Earth },
  { type: 'conduit', label: 'Leerrohr', category: 'Schutz & Einbau', description: 'Schützt Kabel vor Scheuern und Hitze.', icon: Cable },
];

const waterComponents: Comp[] = [
  { type: 'freshWaterTank', label: 'Frischwassertank', category: 'Speichern', description: 'Speichert sauberes Wasser.', icon: Droplets },
  { type: 'grayWaterTank', label: 'Abwassertank', category: 'Speichern', description: 'Sammelt gebrauchtes Wasser.', icon: Waves },
  { type: 'pump', label: 'Wasserpumpe', category: 'Fördern & filtern', description: 'Baut Druck auf und fördert Frischwasser.', icon: CircleGauge },
  { type: 'accumulator', label: 'Druckausgleichsgefäß', category: 'Fördern & filtern', description: 'Beruhigt den Wasserfluss und schont die Pumpe.', icon: Gauge },
  { type: 'preFilter', label: 'Vorfilter', category: 'Fördern & filtern', description: 'Hält Schmutz vor der Pumpe zurück.', icon: Filter },
  { type: 'sink', label: 'Spüle', category: 'Entnahmestellen', description: 'Entnahmestelle mit Frisch- und Abwasser.', icon: Droplets },
  { type: 'shower', label: 'Dusche', category: 'Entnahmestellen', description: 'Wasserentnahme mit Abwasserleitung.', icon: ShowerHead },
];

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
  usePlannerStore.getState().addNode(comp.type, comp.label, { x: 0, y: 0 }, comp.watts);
  onMobileAdd?.();
  window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('planner-fit-view')));
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

  const onPointerUp = (upEvent: PointerEvent) => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    clone.remove();
    const isOverCanvas = document.elementsFromPoint(upEvent.clientX, upEvent.clientY)
      .some((element) => element.classList.contains('react-flow__pane'));
    if (!isOverCanvas) return;
    window.dispatchEvent(new CustomEvent('custom-node-drop', {
      detail: {
        clientX: upEvent.clientX,
        clientY: upEvent.clientY,
        type: comp.type,
        label: comp.label,
        watts: comp.watts,
      },
    }));
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
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
        if ((event.key === 'Enter' || event.key === ' ') && window.innerWidth >= 1024) {
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
          {items.map((comp, index) => (
            <ComponentTile key={`${comp.type}-${comp.label}-${index}`} comp={comp} onMobileAdd={onMobileAdd} accent={accent} />
          ))}
        </div>
      )}
    </section>
  );
}

export function Sidebar({ mode = 'electric', onMobileAdd }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const activeComponents = mode === 'water' ? waterComponents : components;
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
    <aside className="flex h-full w-full flex-col border-r border-border bg-paper lg:w-72" aria-label={mode === 'water' ? 'Wasser-Komponenten' : 'Elektrik-Komponenten'}>
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
