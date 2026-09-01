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
}

export function CategorySection({ title, items, open, onToggle, onMobileAdd, accent }: CategorySectionProps) {
  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title} ({items.length})
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open ? '' : '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 p-3 pt-1">
          {items.map((comp) => (
            <ComponentTile
              key={`${comp.type}-${comp.label}`}
              comp={comp}
              onMobileAdd={onMobileAdd}
              accent={accent}
            />
          ))}
        </div>
      )}
    </section>
  );
}
