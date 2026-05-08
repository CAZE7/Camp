"use client";
import React, { useState } from 'react';
import { XCircle } from 'lucide-react';

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

const handlePointerDown = (e: React.PointerEvent, comp: { type: string, label: string }) => {
  e.preventDefault(); // Prevent default touch actions

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
          label: comp.label
        }
      });
      window.dispatchEvent(dropEvent);
    }
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
};

export default function Sidebar({ mode = 'electric' }: { mode?: 'electric' | 'water' }) {
  const [searchTerm, setSearchTerm] = useState('');

  const activeComponents = mode === 'water' ? waterComponents : components;

  const filteredComponents = activeComponents.filter(c =>
    c.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Komponenten</h2>
      </div>

      <div className="m-4 relative group">
        <input
          type="text"
          placeholder="Suchen..."
          aria-label="Komponenten suchen"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            aria-label="Suche zurücksetzen"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-full"
          >
            <XCircle size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredComponents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredComponents.map((comp, index) => (
              <div
                key={index}
                className="p-3 border border-gray-200 rounded cursor-grab hover:bg-orange-50 hover:scale-105 transition-transform transition-colors text-sm font-medium text-gray-700 bg-white shadow-sm touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                tabIndex={0}
                role="button"
                aria-grabbed="false"
                onPointerDown={(e) => handlePointerDown(e, comp)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Could potentially implement keyboard-based dropping here, but pointer is main method for React Flow.
                  }
                }}
              >
                {comp.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm text-center py-8 flex flex-col items-center gap-3">
            <p>Keine Komponenten gefunden für &quot;{searchTerm}&quot;</p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-orange-600 hover:text-orange-700 font-medium text-xs border border-orange-200 hover:border-orange-300 rounded-md px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Suche zurücksetzen
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
