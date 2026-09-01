'use client';

import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BaseNodeProps {
  id: string;
  selected?: boolean;
  error?: boolean;
  warning?: boolean;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  selected,
  error,
  warning,
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}) => {
  return (
    <div
      // Stabiler E2E-Selektor. Der Bauteiltyp kommt aus der React-Flow-Klasse
      // am Wrapper (`.react-flow__node-battery`), die hier nicht bekannt ist.
      data-testid="planner-node"
      data-node-id={id}
      className={cn(
        'relative min-w-52 overflow-hidden break-words rounded-2xl p-4 transition-all duration-300',
        'bg-card/80 border border-border shadow-lg backdrop-blur-md',
        'hover:-translate-y-0.5 hover:shadow-xl',
        selected && 'shadow-primary/20 ring-1 ring-[color:var(--accent-line)]',
        (error || warning) && 'animate-pulse border-destructive shadow-xl ring-2 ring-destructive',
        className
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        {Icon && (
          <div
            className={cn(
              'flex-shrink-0 rounded-xl p-2',
              error || warning ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            )}
          >
            <Icon size={20} strokeWidth={1.5} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-sm font-extrabold tracking-tight text-foreground">{title}</h3>
          {subtitle && <span className="truncate text-xs font-medium text-muted-foreground">{subtitle}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
};

export default React.memo(BaseNode);
