"use client";
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { NODE_META } from './nodes/nodeMeta';

interface PaletteItem {
  type: string;
  label: string;
  category: string;
}

const components: PaletteItem[] = [
  { type: 'battery', label: 'Batterie', category: 'Energie' },
  { type: 'shunt', label: 'Smart Shunt', category: 'Energie' },
  { type: 'busbar', label: 'Main Busbar', category: 'Energie' },
  { type: 'charger', label: 'Ladebooster', category: 'Energie' },
  { type: 'solar', label: 'Solarmodul', category: 'Energie' },
  { type: 'inverter', label: 'Wechselrichter', category: 'Umwandlung' },
  { type: 'consumer', label: '12V Verbraucher (Heizung, Licht)', category: 'Verbraucher' },
  { type: 'consumer230v', label: '230V Verbraucher (Induktion, Kaffee)', category: 'Verbraucher' },
  { type: 'shorePower', label: 'Landstromanschluss', category: 'Verbraucher' },
  { type: 'fuse', label: 'Sicherungskasten', category: 'Schutz' },
  { type: 'ground', label: 'Massepunkt (Karosserie)', category: 'Schutz' },
  { type: 'conduit', label: 'Leerrohr / Kabelkanal', category: 'Schutz' },
];

const waterComponents: PaletteItem[] = [
  { type: 'freshWaterTank', label: 'Frischwassertank', category: 'Wasser' },
  { type: 'grayWaterTank', label: 'Grauwassertank', category: 'Wasser' },
  { type: 'pump', label: 'Wasserpumpe', category: 'Wasser' },
  { type: 'accumulator', label: 'Druckgefäß (Accumulator)', category: 'Wasser' },
  { type: 'preFilter', label: 'Vorfilter', category: 'Wasser' },
  { type: 'sink', label: 'Spüle', category: 'Verbraucher' },
  { type: 'shower', label: 'Dusche', category: 'Verbraucher' },
];

export default function Sidebar({ mode = 'electric' }: { mode?: 'electric' | 'water' }) {
  const [searchTerm, setSearchTerm] = useState('');

  const activeComponents = mode === 'water' ? waterComponents : components;

  const handlePointerDown = (e: React.PointerEvent, comp: PaletteItem) => {
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    const clone = target.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.zIndex = '9999';
    clone.style.opacity = '0.85';
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
      const isOverCanvas = elementsUnderPointer.some((el) => el.classList.contains('react-flow__pane'));

      if (isOverCanvas) {
        window.dispatchEvent(
          new CustomEvent('custom-node-drop', {
            detail: { clientX: upEvent.clientX, clientY: upEvent.clientY, type: comp.type, label: comp.label },
          }),
        );
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const filtered = activeComponents.filter((c) =>
    c.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Group by category, preserving order.
  const groups: { category: string; items: PaletteItem[] }[] = [];
  for (const item of filtered) {
    let g = groups.find((gr) => gr.category === item.category);
    if (!g) {
      g = { category: item.category, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-toolbar">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Komponenten</h2>
        <p className="text-xs text-muted-foreground">Ziehen & auf die Fläche legen</p>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Suchen..."
            aria-label="Komponenten suchen"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-node-muted py-2 pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.category}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.category}
              </div>
              <div className="flex flex-col gap-1.5">
                {group.items.map((comp) => {
                  const meta = NODE_META[comp.type];
                  const Icon = meta?.icon;
                  return (
                    <button
                      key={comp.type}
                      onPointerDown={(e) => handlePointerDown(e, comp)}
                      className="flex cursor-grab items-center gap-2.5 touch-none rounded border border-border bg-node-surface px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:border-node-border-strong hover:bg-node-muted active:cursor-grabbing"
                    >
                      {Icon && (
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded border"
                          style={{
                            color: meta?.accent,
                            borderColor: `color-mix(in oklch, ${meta?.accent} 30%, transparent)`,
                            background: `color-mix(in oklch, ${meta?.accent} 8%, transparent)`,
                          }}
                        >
                          <Icon size={14} strokeWidth={2} />
                        </span>
                      )}
                      <span className="leading-tight">{comp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">Keine Komponenten gefunden</div>
        )}
      </div>
    </aside>
  );
}
