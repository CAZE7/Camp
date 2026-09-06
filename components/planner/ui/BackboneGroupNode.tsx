import React from 'react';
import type { NodeProps } from 'reactflow';

/** Presentation-only frame; it never participates in selection or routing. */
export function BackboneGroupNode({ data }: NodeProps<{ label?: string }>) {
  return (
    <div className="pointer-events-none h-full w-full rounded-2xl border-2 border-dashed border-copper/45 bg-copper/5">
      <span className="absolute left-4 top-3 rounded-full border border-copper/40 bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-copper">
        {data.label || 'Hauptstromkreis'}
      </span>
    </div>
  );
}
