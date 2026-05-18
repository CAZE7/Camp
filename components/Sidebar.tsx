"use client";
import React, { useState } from 'react';
import { XCircle, ChevronLeft, ChevronRight, Search, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '../store/usePlannerStore';

const components = [
  { type: 'battery', label: 'Batterie', category: 'Laden' },
  { type: 'shunt', label: 'Smart Shunt', category: 'Laden' },
  { type: 'busbar', label: 'Main Busbar', category: 'Laden' },
  { type: 'charger', label: 'Ladebooster', category: 'Laden' },
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

export function Sidebar({ mode = 'electric', onMobileAdd }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeComponents = mode === 'water' ? waterComponents : components;
  
  const allCategories = ['Alle', ...Array.from(new Set([
    ...activeComponents.map(c => c.category),
    ...(mode === 'electric' ? deviceAssistant.map(c => c.category) : [])
  ]))];

  const filteredComponents = activeComponents.filter(c => {
    const matchesSearch = c.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'Alle' || c.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const filteredDevices = mode === 'electric' ? deviceAssistant.filter(c => {
    const matchesSearch = c.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'Alle' || c.category === selectedCategory;
    return matchesSearch && matchesCat;
  }) : [];

  return (
    <aside
      className={cn(
        "bg-gradient-to-b from-stone-50 to-amber-50/30 border-r border-stone-200/80 flex flex-col h-full transition-all duration-300 relative",
        isCollapsed ? "w-full md:w-12" : "w-full md:w-64"
      )}
      style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-14 z-10 bg-white border border-stone-200 rounded-full p-0.5 shadow-sm hover:bg-stone-50 transition-colors text-stone-500 hidden md:flex items-center justify-center"
        aria-label="Toggle Sidebar"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className={cn("border-b border-stone-200/60 bg-gradient-to-r from-stone-100 to-emerald-50/40", isCollapsed ? "p-2 flex justify-center" : "p-4")}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          {!isCollapsed && (
            <h2 className="text-base font-black text-stone-800 tracking-tight">
              Komponenten
            </h2>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 border-b border-stone-200/50 space-y-3">
          <div className="relative group flex items-center">
            <label htmlFor="search-input" className="sr-only">Suchen</label>
            <Search size={16} className="absolute left-3 text-stone-400" />
            <input
              id="search-input"
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-stone-200 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all bg-white/80 text-stone-700 placeholder:text-stone-400 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 text-stone-400 hover:text-rose-500 transition-colors focus:outline-none"
                aria-label="Filter zurücksetzen"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${selectedCategory === cat ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-stone-600 border-stone-200 hover:border-emerald-300 hover:bg-emerald-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto pb-4 pt-4", isCollapsed ? "px-1.5" : "px-4")}>
        {filteredComponents.length > 0 || filteredDevices.length > 0 ? (
          <div className="flex flex-col gap-6">
            {filteredComponents.length > 0 && (
              <div>
                {!isCollapsed && <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Bauteile</h3>}
                <div className={cn("grid gap-2", isCollapsed ? "grid-cols-1" : "grid-cols-2")}>
                  {filteredComponents.map((comp, index) => (
                    <div
                      key={index}
                      title={isCollapsed ? comp.label : undefined}
                      className={cn(
                        "border border-stone-200/70 rounded-xl cursor-grab hover:bg-emerald-50/60 hover:border-emerald-300/50 hover:scale-[1.03] hover:shadow-md transition-all duration-200 text-xs font-semibold text-stone-700 bg-white/90 shadow-sm touch-none flex items-center justify-center text-center",
                        isCollapsed ? "p-3 w-8 h-8 mx-auto rounded-full" : "p-2.5 flex-col gap-1.5"
                      )}
                      onPointerDown={(e) => handlePointerDown(e, comp, onMobileAdd)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      {!isCollapsed && <span className="line-clamp-2">{comp.label}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'electric' && filteredDevices.length > 0 && (
              <div>
                {!isCollapsed && <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">Verbraucher</h3>}
                <div className={cn("grid gap-2", isCollapsed ? "grid-cols-1" : "grid-cols-2")}>
                  {filteredDevices.map((comp, index) => (
                    <div
                      key={`device-${index}`}
                      title={isCollapsed ? `${comp.label} (${comp.watts}W)` : undefined}
                      className={cn(
                        "border border-emerald-200 rounded-xl cursor-grab hover:bg-emerald-100 hover:border-emerald-400 hover:scale-[1.03] hover:shadow-md transition-all duration-200 text-xs font-semibold text-emerald-900 bg-emerald-50 shadow-sm touch-none flex items-center justify-center text-center",
                        isCollapsed ? "p-3 w-8 h-8 mx-auto rounded-full" : "p-2.5 flex-col gap-1.5"
                      )}
                      onPointerDown={(e) => handlePointerDown(e, comp)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="line-clamp-2 leading-tight">{comp.label}</span>
                          <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded text-emerald-700 border border-emerald-100">{comp.watts}W</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-stone-500 text-sm text-center py-8 flex flex-col items-center gap-3">
            <div className="text-3xl">🌿</div>
            <p>Keine Treffer für &quot;{searchTerm}&quot;</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('Alle'); }}
              className="text-emerald-700 hover:text-emerald-800 font-semibold text-xs border border-emerald-200 hover:border-emerald-300 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-all"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>

      <div className={cn("border-t border-stone-200/60 bg-gradient-to-r from-emerald-50/40 to-amber-50/40 flex justify-center", isCollapsed ? "py-3 px-1" : "px-4 py-3")}>
        <div className="text-[10px] text-stone-400 font-medium flex items-center gap-2">
          <Leaf size={isCollapsed ? 18 : 14} className="text-emerald-500" />
          {!isCollapsed && <span>Ziehe Komponenten auf die Arbeitsfläche</span>}
        </div>
      </div>
    </aside>
  );
}
