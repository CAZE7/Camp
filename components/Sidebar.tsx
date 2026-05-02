import React, { useState } from 'react';

const components = [
  { type: 'battery', label: 'Batterie' },
  { type: 'charger', label: 'Ladebooster' },
  { type: 'solar', label: 'Solarmodul' },
  { type: 'inverter', label: 'Wechselrichter' },
  { type: 'consumer', label: '12V Verbraucher (Heizung, Licht)' },
  { type: 'consumer230v', label: '230V Verbraucher (Induktion, Kaffee)' },
  { type: 'shorePower', label: 'Landstromanschluss' },
  { type: 'fuse', label: 'Sicherungskasten' },
  { type: 'ground', label: 'Massepunkt (Karosserie)' },
];

const roofComponents = [
  { type: 'roofWindow', label: 'Dachfenster' },
  { type: 'roofSolar', label: 'Dach-Solarpanel' },
];

export default function Sidebar({ mode = 'electric' }: { mode?: 'electric' | 'roof' }) {
  const [searchTerm, setSearchTerm] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const activeComponents = mode === 'roof' ? roofComponents : components;

  const filteredComponents = activeComponents.filter(c =>
    c.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-64 bg-transparent border-r border-gray-200 p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Komponenten</h2>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredComponents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredComponents.map((comp, index) => (
              <div
                key={index}
                className="p-3 border border-gray-200 rounded cursor-grab hover:bg-orange-50 hover:scale-105 transition-transform transition-colors text-sm font-medium text-gray-700 bg-white shadow-sm"
                onDragStart={(event) => onDragStart(event, comp.type, comp.label)}
                draggable
              >
                {comp.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm text-center py-4">Keine Komponenten gefunden</div>
        )}
      </div>
    </aside>
  );
}
