import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';

export type BackboneGroupNodeType = Node<{ label?: string }, 'backboneGroup'>;

/**
 * B3: CAD-Zonenrahmen. 1-px-Dashed-Linie mit dezentem Tint und innen
 * verankerter Eyebrow-Beschriftung (Titelblock-Stil) statt schwebender Pille.
 * Presentation-only — nimmt nie an Selektion oder Routing teil.
 */
export function BackboneGroupNode({ data }: NodeProps<BackboneGroupNodeType>) {
  return (
    <div className="pointer-events-none h-full w-full rounded border border-dashed border-copper/60 bg-copper/10">
      <span className="absolute left-3 top-2.5 inline-flex items-center border border-copper/40 bg-card px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-copper">
        {data.label || 'Hauptstromkreis'}
      </span>
    </div>
  );
}
