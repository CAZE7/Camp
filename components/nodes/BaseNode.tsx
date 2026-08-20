"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';
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
  className
}) => {
  return (
    <div
      className={cn(
        "relative min-w-52 rounded-2xl p-4 transition-all duration-300",
        "bg-card/80 backdrop-blur-md border border-border shadow-lg",
        "hover:shadow-xl hover:-translate-y-0.5",
        selected && "ring-2 ring-primary shadow-primary/20",
        (error || warning) && "animate-pulse ring-2 ring-destructive shadow-xl border-destructive",
        className
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        {Icon && (
          <div className={cn(
            "p-2 rounded-xl flex-shrink-0",
            (error || warning) ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}>
            <Icon size={20} strokeWidth={1.5} />
          </div>
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="font-extrabold text-sm text-foreground truncate tracking-tight">{title}</h3>
          {subtitle && (
            <span className="text-xs text-muted-foreground font-medium truncate">{subtitle}</span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
};

export default React.memo(BaseNode);
