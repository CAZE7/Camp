import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';

export type BackboneGroupNodeType = Node<{ label?: string }, 'backboneGroup'>;

/** Presentation-only frame; it never participates in selection or routing. */
export function BackboneGroupNode({ data }: NodeProps<BackboneGroupNodeType>) {
  return (
    <div className="pointer-events-none h-full w-full rounded border border-dashed border-copper/45 bg-copper/5">
      <span className="absolute top-3 left-4 rounded-full border border-copper/40 bg-card px-3 py-1 text-xs font-semibold tracking-wider text-copper uppercase">
        {data.label || 'Hauptstromkreis'}
      </span>
    </div>
  );
}
