import React from 'react';
import { Box } from 'lucide-react';
import { NODE_META, NodeMeta } from './nodeMeta';

interface NodeCardProps {
  /** Resolved metadata (optional when `type` is given). */
  meta?: NodeMeta;
  /** React Flow node type, used to look up metadata. */
  type?: string;
  selected?: boolean;
  /** Overrides the default label from metadata. */
  title?: string;
  /** Optional right-aligned badge (e.g. "12V", "230V"). */
  chip?: string;
  /** Card width in px. */
  width?: number;
  className?: string;
  children?: React.ReactNode;
}

export function NodeCard({
  meta,
  type,
  selected,
  title,
  chip,
  width = 176,
  className,
  children,
}: NodeCardProps) {
  const resolved: NodeMeta =
    meta ?? (type ? NODE_META[type] : undefined) ?? {
      label: 'Komponente',
      icon: Box,
      accent: 'var(--accent)',
      accentClass: 'accentp',
    };
  const Icon = resolved.icon;

  return (
    <div
      className={`planner-node custom-drag-handle ${selected ? 'is-selected' : ''} ${className ?? ''}`}
      style={{ '--node-accent': resolved.accent, '--node-width': `${width}px` } as React.CSSProperties}
    >
      <span className="planner-node__accent" aria-hidden="true" />
      <div className="planner-node__head">
        <span className="planner-node__icon">
          <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="planner-node__title flex-1">{title ?? resolved.label}</span>
        {chip && <span className="planner-node__chip">{chip}</span>}
      </div>
      <div className="planner-node__body">{children}</div>
    </div>
  );
}

/** A label/value row used inside node cards. */
export function Row({ label, value, unit }: { label: string; value?: string | number; unit?: string }) {
  return (
    <div className="planner-node__row">
      <span>{label}</span>
      <strong>
        {value}
        {unit ? ` ${unit}` : ''}
      </strong>
    </div>
  );
}

/** Compact full-width callout for errors/warnings inside node cards. */
export function NodeError({ children }: { children: React.ReactNode }) {
  return <div className="planner-node__error">{children}</div>;
}
