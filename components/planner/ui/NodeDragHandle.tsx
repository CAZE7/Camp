import React from 'react';
import { GripVertical } from 'lucide-react';
import type { NodeProps } from '@xyflow/react';

/**
 * Dedizierter Drag-Griff für Touch-Geräte.
 *
 * Der Griff bleibt als sichtbare Affordance. Gezogen wird die Karte auch am
 * Körper (`requiresDragHandle: false` in `flowInteraction.ts`): ein Finger auf
 * leerer Fläche pannt, ein Finger auf der Karte verschiebt das Bauteil.
 *
 * Der Griff wird bewusst per CSS (`@media (pointer: fine)`) ausgeblendet statt
 * per JS entfernt: so ist er schon vor der Hydration korrekt und erzeugt keine
 * Layout-Verschiebung. Er ist `aria-hidden`, weil er eine reine Zeiger-
 * Affordanz ist — Tastaturnutzer bewegen Bauteile über den Inspector, nicht
 * über einen Button ohne Tastaturverhalten.
 */
export function NodeDragHandle() {
  return (
    <div className="node-drag-handle nopan" title="Zum Verschieben hier ziehen" aria-hidden="true">
      <GripVertical size={18} strokeWidth={2} />
    </div>
  );
}

/**
 * Hüllt eine Node-Komponente in einen Griff, ohne das Layout zu verändern.
 * Der Wrapper nutzt `display: contents` (siehe .node-drag-shell in globals.css),
 * d. h. er erzeugt keine eigene Box — React Flow misst weiterhin exakt die
 * Maße der eigentlichen Node-Komponente.
 */
export function withNodeDragHandle<P extends NodeProps>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <div className="node-drag-shell">
      <NodeDragHandle />
      <Component {...props} />
    </div>
  );
  Wrapped.displayName = `withNodeDragHandle(${Component.displayName || Component.name || 'Node'})`;
  return Wrapped;
}

/**
 * Wendet den Griff auf eine komplette nodeTypes-Map an (memoisierbar).
 *
 * Die Map-Einträge sind React-Flow-Node-Komponenten (Props ⊇ NodeProps, je
 * nach Datenunion schmäler typisiert als NodeTypesObject). `T extends
 * Record<string, unknown>` akzeptiert alle Kandidaten ohne `any`-Aufweichung;
 * die einzige Type-Ausweitung ist der bewusste Cast pro Eintrag auf die
 * React-Flow-Vertragsprops.
 */
export function withNodeDragHandles<T extends Record<string, unknown>>(
  nodeTypes: T
): Record<keyof T, React.ComponentType<NodeProps>> & T {
  const out = {} as Record<keyof T, React.ComponentType<NodeProps>>;
  for (const key of Object.keys(nodeTypes) as Array<keyof T>) {
    out[key] = withNodeDragHandle(nodeTypes[key] as React.ComponentType<NodeProps>);
  }
  return out as Record<keyof T, React.ComponentType<NodeProps>> & T;
}
