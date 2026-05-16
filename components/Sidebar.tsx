"use client";
import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';

const components = [
  { type: 'battery', label: 'Batterie' },
  { type: 'shunt', label: 'Smart Shunt' },
  { type: 'busbar', label: 'Main Busbar' },
  { type: 'charger', label: 'Ladebooster' },
  { type: 'solar', label: 'Solarmodul' },
  { type: 'inverter', label: 'Wechselrichter' },
  { type: 'consumer', label: '12V Verbraucher (Heizung, Licht)' },
  { type: 'consumer230v', label: '230V Verbraucher (Induktion, Kaffee)' },
  { type: 'shorePower', label: 'Landstromanschluss' },
  { type: 'fuse', label: 'Sicherungskasten' },
  { type: 'ground', label: 'Massepunkt (Karosserie)' },
  { type: 'conduit', label: 'Leerrohr / Kabelkanal' },
];

const waterComponents = [
  { type: 'freshWaterTank', label: 'Frischwassertank' },
  { type: 'grayWaterTank', label: 'Grauwassertank' },
  { type: 'pump', label: 'Wasserpumpe' },
  { type: 'accumulator', label: 'Druckausgleichsgefäß (Accumulator)' },
  { type: 'preFilter', label: 'Vorfilter' },
  { type: 'sink', label: 'Spüle' },
  { type: 'shower', label: 'Dusche' },
];

const handlePointerDown = (e: React.PointerEvent, comp: { type: string, label: string }, onMobileAdd?: () => void) => {
const deviceAssistant = [
  { type: 'consumer', label: 'Kompressorkühlschrank', watts: 60 },
  { type: 'consumer', label: 'LED-Beleuchtung', watts: 20 },
  { type: 'consumer', label: 'Standheizung', watts: 15 },
  { type: 'consumer', label: 'Wasserpumpe', watts: 40 },
  { type: 'consumer230v', label: 'Laptop-Ladegerät', watts: 90 },
  { type: 'consumer', label: 'Handyladegerät', watts: 18 },
];

const handlePointerDown = (e: React.PointerEvent, comp: { type: string, label: string, watts?: number }) => {
  e.preventDefault(); // Prevent default touch actions

  // Mobile optimization: Click to add directly to canvas instead of drag and drop
  if (window.innerWidth < 768) {
    usePlannerStore.getState().addNode(comp.type, comp.label, {
      x: window.innerWidth / 2 - 40,
      y: window.innerHeight / 2 - 40
    });
    if (onMobileAdd) onMobileAdd();
    return;
  }

  // Create a ghost element that follows the pointer
  const target = e.currentTarget as HTMLElement;
  const clone = target.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.zIndex = '9999';
  clone.style.opacity = '0.8';
  clone.style.pointerEvents = 'none'; // so it doesn't interfere with mouseup/pointerup targets
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

    // Check if dropped over the react-flow pane
    const elementsUnderPointer = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
    const isOverCanvas = elementsUnderPointer.some(el => el.classList.contains('react-flow__pane'));

    if (isOverCanvas) {
      // Dispatch custom event to Planner.tsx
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

export default function Sidebar({ mode = 'electric', onMobileAdd }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const activeComponents = mode === 'water' ? waterComponents : components;

  const filteredComponents = activeComponents.filter(c =>
    c.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside
      className="w-full md:w-64 bg-gradient-to-b from-stone-50 to-amber-50/30 border-r border-stone-200/80 flex flex-col h-full"
      style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
    >
      {/* Header with nature accent */}
      <div className="p-4 border-b border-stone-200/60 bg-gradient-to-r from-stone-100 to-emerald-50/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h2 className="text-base font-black text-stone-800 tracking-tight">
            Komponenten
          </h2>
        </div>
      </div>

      {/* Search input with nature styling */}
      <div className="m-4 relative group">
        <label className="sr-only" htmlFor="component-search">Komponenten suchen</label>
        <input
          id="component-search"
          type="text"
          placeholder="🔍 Suchen..."
          aria-label="Komponenten suchen"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-stone-200 rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all bg-white/80 text-stone-700 placeholder:text-stone-400 shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            aria-label="Suche zurücksetzen"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-rose-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full"
          >
            <XCircle size={16} />
          </button>
        )}
      </div>

      {/* Component list with nature-themed cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredComponents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredComponents.map((comp, index) => (
              <div
                key={index}
                className="p-3 border border-stone-200/70 rounded-xl cursor-grab hover:bg-emerald-50/60 hover:border-emerald-300/50 hover:scale-[1.03] hover:shadow-md transition-all duration-200 text-sm font-semibold text-stone-700 bg-white/90 shadow-sm touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                tabIndex={0}
                role="button"
                aria-grabbed="false"
                onPointerDown={(e) => handlePointerDown(e, comp, onMobileAdd)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Could potentially implement keyboard-based dropping here, but pointer is main method for React Flow.
                  }
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  {comp.label}
                </span>
              </div>
            ))}

            {mode === 'electric' && (
              <>
                <h3 className="text-sm font-semibold mt-4 mb-2 text-emerald-700 uppercase tracking-wider">
                  Verbraucher-Datenbank
                </h3>
                {deviceAssistant.filter(c => c.label.toLowerCase().includes(searchTerm.toLowerCase())).map((comp, index) => (
                  <div
                    key={`device-${index}`}
                    className="p-3 border border-emerald-200 rounded-xl cursor-grab hover:bg-emerald-100 hover:border-emerald-400 hover:scale-[1.03] hover:shadow-md transition-all duration-200 text-sm font-semibold text-emerald-900 bg-emerald-50 shadow-sm touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 flex justify-between items-center"
                    tabIndex={0}
                    role="button"
                    aria-grabbed="false"
                    onPointerDown={(e) => handlePointerDown(e, comp)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      {comp.label}
                    </span>
                    <span className="text-xs font-mono bg-white px-2 py-0.5 rounded text-emerald-700 border border-emerald-100">{comp.watts}W</span>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="text-stone-500 text-sm text-center py-8 flex flex-col items-center gap-3">
            <div className="text-3xl">🌿</div>
            <p>Keine Komponenten gefunden für &quot;{searchTerm}&quot;</p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-emerald-700 hover:text-emerald-800 font-semibold text-xs border border-emerald-200 hover:border-emerald-300 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Suche zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Nature footer accent */}
      <div className="px-4 py-3 border-t border-stone-200/60 bg-gradient-to-r from-emerald-50/40 to-amber-50/40">
        <p className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
          <span>🌱</span>
          <span>Ziehe Komponenten auf die Arbeitsfläche</span>
        </p>
      </div>
    </aside>
  );
}
