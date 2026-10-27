import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';

export type BackboneGroupNodeType = Node<{ label?: string }, 'backboneGroup'>;

/** Presentation-only frame; it never participates in selection or routing. */
export function BackboneGroupNode({ data }: NodeProps<BackboneGroupNodeType>) {
  return (
    <div className="pointer-events-none h-full w-full rounded border border-dashed border-copper/45 bg-copper/5">
      {/* L12 (Layout-Runde 27.10.2026): Innerhalb des Rahmens lag das Label
          genau dort, wo die erste Karte steht — vom Rahmen (z-index -10, also
          hinter allen Karten) blieb nur „HA“ sichtbar, der Rest steckte unter
          der PV-Karte. Über der Rahmenkante (`bottom-full`) sitzt das Label in
          der 56-px-Reserve, die `backboneGroup` über den Kern-Bauteilen frei
          hält, und kollidiert nicht mit einer Karte. */}
      <span className="absolute bottom-full left-2 mb-1 rounded-full border border-copper/40 bg-card px-3 py-1 text-xs font-semibold tracking-wider whitespace-nowrap text-copper uppercase">
        {data.label || 'Hauptstromkreis'}
      </span>
    </div>
  );
}
