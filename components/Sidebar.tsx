"use client";
import React, { useState } from 'react';
import { XCircle, Search, Leaf, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '../store/usePlannerStore';

const components = [
  { type: 'battery', label: 'Batterie', category: 'Laden' },
  { type: 'shunt', label: 'Smart Shunt', category: 'Laden' },
  { type: 'busbar', label: 'Main Busbar', category: 'Laden' },
  { type: 'mpptController', label: 'MPPT Laderegler', category: 'Laden' },
  { type: 'dcdcCharger', label: 'Ladebooster (DC-DC)', category: 'Laden' },
  { type: 'acBatteryCharger', label: '230V Ladegerät (AC)', category: 'Laden' },
  { type: 'solar', label: 'Solarmodul', category: 'Laden' },
  { type: 'inverter', label: 'Wechselrichter', category: 'Laden' },
  { type: 'consumer', label: '12V Verbraucher', category: 'Allgemein' },
  { type: 'consumer230v', label: '230V Verbraucher', category: 'Allgemein' },
  { type: 'shorePower', label: 'Landstrom', category: 'Laden' },
  { type: 'fuse', label: 'Sicherungskasten', category: 'Allgemein' },
  { type: 'ground', label: 'Massepunkt', category: 'Allgemein' },
  { type: 'conduit', label: 'Leerrohr', category: 'Allgemein' },
];

const waterComponents = [
  { type: 'freshWaterTank', label: 'Frischwassertank', category: 'Wasser' },
  { type: 'grayWaterTank', label: 'Grauwassertank', category: 'Wasser' },
  { type: 'pump', label: 'Wasserpumpe', category: 'Wasser' },
  { type: 'accumulator', label: 'Druckausgleich', category: 'Wasser' },
  { type: 'preFilter', label: 'Vorfilter', category: 'Wasser' },
  { type: 'sink', label: 'Spüle', category: 'Wasser' },
  { type: 'shower', label: 'Dusche', category: 'Wasser' },
];

const deviceAssistant = [
  { type: 'consumer230v', label: 'Induktion', watts: 2000, category: 'Kochen' },
  { type: 'consumer230v', label: 'Kaffeemaschine', watts: 1500, category: 'Kochen' },
  { type: 'consumer', label: 'Kompressorkühlschrank', watts: 60, category: 'Kochen' },
  { type: 'consumer', label: 'Standheizung', watts: 40, category: 'Klima' },
  { type: 'consumer', label: 'Dachventilator (Fan)', watts: 30, category: 'Klima' },
  { type: 'consumer', label: 'LED-Beleuchtung', watts: 20, category: 'Licht' },
  { type: 'consumer230v', label: 'Starlink', watts: 50, category: 'Laden' },
  { type: 'consumer230v', label: 'Laptop-Ladegerät', watts: 65, category: 'Laden' },
  { type: 'consumer', label: 'Handyladegerät', watts: 18, category: 'Laden' },
  { type: 'consumer', label: 'Wasserpumpe', watts: 40, category: 'Allgemein' },
];

// Die relevanteste Kategorie ist beim ersten Öffnen ausgeklappt, der Rest zu.
const DEFAULT_OPEN_CATEGORY: Record<'electric' | 'water', string> = {
  electric: 'Laden',
  water: 'Wasser',
};

const handlePointerDown = (e: React.PointerEvent, comp: { type: string, label: string, watts?: number }, onMobileAdd?: () => void) => {
  e.preventDefault();

  if (window.innerWidth < 768) {
    usePlannerStore.getState().addNode(comp.type, comp.label, {
      x: window.innerWidth / 2 - 40,
      y: window.innerHeight / 2 - 40
    }, comp.watts);
    if (onMobileAdd) onMobileAdd();
    return;
  }

  const target = e.currentTarget as HTMLElement;
  const clone = target.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.zIndex = '9999';
  clone.style.opacity = '0.8';
  clone.style.pointerEvents = 'none';
  clone.style.left = `${e.clientX - target.offsetWidth / 2}px`;
  clone.style.top = `${e.clientY - target.offsetHeight / 2}px`;
  document.body.appendChild(clone);

  const onPointerMove = (moveEvent: PointerEvent) => {
    clone.style.left = `${moveEvent.clientX - target.offsetWidth / 2}px`;
    clone.style.top = `${moveEvent.clientY - target.offsetHeight / 2}px`;
  };

  const onPointerUp = (upEvent: PointerEvent) => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    clone.remove();

    const elementsUnderPointer = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
    const isOverCanvas = elementsUnderPointer.some(el => el.classList.contains('react-flow__pane'));

    if (isOverCanvas) {
      const dropEvent = new CustomEvent('custom-node-drop', {
        detail: {
          clientX: upEvent.clientX,
          clientY: upEvent.clientY,
          type: comp.type,
          label: comp.label,
          watts: comp.watts
        }
      });
      window.dispatchEvent(dropEvent);
    }
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
};

interface SidebarProps {
  mode?: 'electric' | 'water';
  onMobileAdd?: () => void;
}

type Comp = { type: string; label: string; category: string; watts?: number };

function ComponentTile({
  comp,
  onMobileAdd,
  accent,
}: {
  comp: Comp;
  onMobileAdd?: () => void;
  accent: 'default' | 'device';
}) {
  return (
    <div
      className={cn(
        'border rounded-xl cursor-grab hover:scale-[1.03] hover:shadow-md transition-all duration-200 text-xs font-semibold shadow-sm touch-none flex flex-col items-center justify-center text-center gap-1.5 p-2.5',
        accent === 'device'
          ? 'border-accent-foreground/20 bg-accent text-accent-foreground hover:bg-accent/80'
          : 'border-border/70 bg-card/90 text-foreground hover:bg-accent/60 hover:border-primary/30'
      )}
      onPointerDown={(e) => handlePointerDown(e, comp, onMobileAdd)}
    >
      <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', accent === 'device' ? 'bg-copper' : 'bg-moss')} />
      <span className="line-clamp-2 leading-tight">{comp.label}</span>
      {comp.watts !== undefined && (
        <span className="text-[10px] font-mono bg-card px-1.5 py-0.5 rounded text-copper border border-border/50">{comp.watts}W</span>
      )}
    </div>
  );
}

function CategorySection({
  title,
  items,
  open,
  onToggle,
  onMobileAdd,
  accent,
}: {
  title: string;
  items: Comp[];
  open: boolean;
  onToggle: () => void;
  onMobileAdd?: () => void;
  accent: 'default' | 'device';
}) {
  if (items.length === 0) return null;
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] text-left hover:bg-accent/40 transition-colors"
      >
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {title} <span className="text-muted-foreground/60">({items.length})</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open ? '' : '-rotate-90')} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 p-3 pt-1">
          {items.map((comp, index) => (
            <ComponentTile key={`${comp.type}-${comp.label}-${index}`} comp={comp} onMobileAdd={onMobileAdd} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ mode = 'electric', onMobileAdd }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});

  const activeComponents = mode === 'water' ? waterComponents : components;
  const isSearching = searchTerm.trim().length > 0;

  const matches = (label: string) => label.toLowerCase().includes(searchTerm.toLowerCase());

  const filteredComponents = activeComponents.filter(c => matches(c.label));
  const filteredDevices = mode === 'electric' ? deviceAssistant.filter(c => matches(c.label)) : [];

  // Bauteile nach Kategorie gruppieren (Reihenfolge des ersten Auftretens)
  const componentCategories: string[] = [];
  const componentsByCategory: Record<string, Comp[]> = {};
  for (const c of filteredComponents) {
    if (!componentsByCategory[c.category]) {
      componentsByCategory[c.category] = [];
      componentCategories.push(c.category);
    }
    componentsByCategory[c.category].push(c);
  }

  const defaultOpen = DEFAULT_OPEN_CATEGORY[mode];

  // Beim Suchen sind alle Treffer sichtbar; sonst nur die relevanteste Kategorie
  // plus alles, was der Nutzer manuell aufgeklappt hat.
  const isCatOpen = (cat: string) => {
    if (isSearching) return true;
    if (cat in manualOpen) return manualOpen[cat];
    return cat === defaultOpen;
  };

  const toggleCat = (cat: string) =>
    setManualOpen(prev => ({ ...prev, [cat]: !(cat in prev ? prev[cat] : cat === defaultOpen) }));

  const devicesOpen = isSearching ? true : (manualOpen['__devices'] ?? false);
  const hasAnyResult = filteredComponents.length > 0 || filteredDevices.length > 0;

  return (
    <aside
      className="bg-gradient-to-b from-paper to-accent/30 border-r border-border/80 flex flex-col h-full w-full md:w-64 transition-all duration-300 relative"
      style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
    >
      <div className="border-b border-border/60 bg-gradient-to-r from-accent/60 to-accent/20 p-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-moss to-oxide flex items-center justify-center shadow-sm flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h2 className="text-base font-black text-card-foreground tracking-tight">
            Komponenten
          </h2>
        </div>
      </div>

      <div className="p-4 border-b border-border/50">
        <div className="relative group flex items-center">
          <label htmlFor="search-input" className="sr-only">Suchen</label>
          <Search size={16} className="absolute left-3 text-muted-foreground" />
          <input
            id="search-input"
            type="text"
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-border rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-all bg-card/80 text-foreground placeholder:text-muted-foreground shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
              aria-label="Filter zurücksetzen"
            >
              <XCircle size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4 pt-4 px-4">
        {hasAnyResult ? (
          <div className="flex flex-col gap-3">
            {componentCategories.map((cat) => (
              <CategorySection
                key={cat}
                title={cat}
                items={componentsByCategory[cat]}
                open={isCatOpen(cat)}
                onToggle={() => toggleCat(cat)}
                onMobileAdd={onMobileAdd}
                accent="default"
              />
            ))}

            {mode === 'electric' && filteredDevices.length > 0 && (
              <CategorySection
                title="Verbraucher"
                items={filteredDevices}
                open={devicesOpen}
                onToggle={() => setManualOpen(prev => ({ ...prev, __devices: !(prev['__devices'] ?? false) }))}
                onMobileAdd={onMobileAdd}
                accent="device"
              />
            )}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm text-center py-8 flex flex-col items-center gap-3">
            <div className="text-3xl">🌿</div>
            <p>Keine Treffer für &quot;{searchTerm}&quot;</p>
            <button
              onClick={() => { setSearchTerm(''); }}
              className="text-oxide hover:text-moss font-semibold text-xs border border-border hover:border-moss/40 bg-accent hover:bg-accent/70 rounded-lg px-3 py-1.5 transition-all"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-gradient-to-r from-accent/40 to-accent/20 flex justify-center px-4 py-3">
        <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
          <Leaf size={14} className="text-moss" />
          <span>Ziehe Komponenten auf die Arbeitsfläche</span>
        </div>
      </div>
    </aside>
  );
}
