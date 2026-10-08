import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { addAtVisibleCenter, handlePointerDown } from './drag';
import type { Comp } from './catalog';

interface ComponentTileProps {
  comp: Comp;
  onMobileAdd?: () => void;
  accent: 'default' | 'device';
  /** Zeilen-Navigation der Palette (Pfeiltasten) — siehe `Sidebar`. */
  onNavigate?: (direction: 1 | -1) => void;
}

/**
 * Eine Zeile der Komponentenpalette.
 *
 * Bewusst eine kompakte Zeile statt einer Kachel: In einer Werkzeugpalette
 * zählt, wie viele Bauteile gleichzeitig sichtbar sind, nicht wie groß ein
 * einzelnes ist. Icon (funktional, monochrom) + Name + kurze technische Info.
 * Bedienung: Klick/Antippen oder Enter fügt am sichtbaren Mittelpunkt ein,
 * Ziehen mit der Maus setzt frei, Pfeiltasten laufen durch die Liste.
 */
export function ComponentTile({ comp, onMobileAdd, accent, onNavigate }: ComponentTileProps) {
  const Icon = comp.icon;
  const desktopDragStarted = useRef(false);
  const keyboardAddHandled = useRef(false);
  const rowRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={rowRef}
      type="button"
      // Stabile Selektoren für die E2E-Tests (docs/E2E-TESTS.md).
      // Der Typ steht als eigenes Attribut, weil dieselbe Komponente auch
      // als Geräte-Vorlage mehrfach vorkommt (z. B. mehrere consumer230v).
      data-testid="sidebar-item"
      data-component-type={comp.type}
      data-component-label={comp.label}
      data-accent={accent}
      role="option"
      aria-selected={false}
      className={cn(
        'cad-item touch-manipulation',
        accent === 'device' ? 'text-foreground' : 'text-foreground',
        'lg:cursor-grab'
      )}
      onPointerDown={(event) => {
        desktopDragStarted.current = handlePointerDown(event, comp);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          keyboardAddHandled.current = true;
          addAtVisibleCenter(comp, onMobileAdd);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          onNavigate?.(event.key === 'ArrowDown' ? 1 : -1);
        }
      }}
      onClick={() => {
        // A started mouse ghost drag owns this click, even if it was released
        // outside the canvas. Every other activation (touch, pen, assistive
        // technology) adds directly at the current canvas centre.
        if (desktopDragStarted.current) {
          desktopDragStarted.current = false;
          return;
        }
        if (keyboardAddHandled.current) {
          keyboardAddHandled.current = false;
          return;
        }
        addAtVisibleCenter(comp, onMobileAdd);
      }}
      aria-label={`${comp.label} hinzufügen. ${comp.description}`}
      title={`${comp.label}: ${comp.description}`}
    >
      <span className="cad-item__icon">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="cad-item__text">
        <span className="cad-item__label">{comp.label}</span>
        <span className="cad-item__meta">
          {comp.watts !== undefined ? `${comp.watts} W · ${comp.description}` : comp.description}
        </span>
      </span>
    </button>
  );
}
