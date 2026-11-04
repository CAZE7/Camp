import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComponentTile } from './ComponentTile';
import type { Comp } from './catalog';

interface CategorySectionProps {
  title: string;
  items: Comp[];
  open: boolean;
  onToggle: () => void;
  onMobileAdd?: () => void;
  accent: 'default' | 'device';
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  onNavigate?: (direction: 1 | -1) => void;
}

/**
 * Gruppe der Komponentenpalette: klappbar, Titelzeile in Kapitälchen-Mono,
 * darunter eine kompakte Zeilenliste. Keine Karten, keine Kacheln — die
 * Gruppierung ist Ordnung, nicht Dekoration.
 */
function selectionKey(comp: Comp, accent: 'default' | 'device'): string {
  // Geräte-Vorlagen teilen sich absichtlich Typen. Label und Wattwert gehören
  // deshalb zur Identität der Katalogoption; der Präfix trennt sie zusätzlich
  // vom regulären Bauteil desselben Typs.
  return `${accent}:${comp.type}:${comp.label}:${comp.watts ?? ''}`;
}

export function CategorySection({
  title,
  items,
  open,
  onToggle,
  onMobileAdd,
  accent,
  selectedKey,
  onSelect,
  onNavigate,
}: CategorySectionProps) {
  if (items.length === 0) return null;
  return (
    <section className="cad-section">
      <button type="button" onClick={onToggle} aria-expanded={open} className="cad-section__head">
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open ? '' : '-rotate-90')}
          aria-hidden="true"
        />
        <span className="flex-1 truncate text-left">{title}</span>
        <span className="text-muted-foreground tabular-nums">{items.length}</span>
      </button>
      {open && (
        <div role="listbox" aria-label={title} className="pb-1">
          {items.map((comp) => {
            const key = selectionKey(comp, accent);
            return (
              <ComponentTile
                key={key}
                comp={comp}
                onMobileAdd={onMobileAdd}
                accent={accent}
                selected={selectedKey === key}
                onSelect={() => onSelect?.(key)}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
