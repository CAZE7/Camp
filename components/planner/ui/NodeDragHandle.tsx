import React from 'react';
import { GripVertical } from 'lucide-react';
import type { NodeProps } from 'reactflow';

/**
 * Dedizierter Drag-Griff für Touch-Geräte.
 *
 * Warum ein Griff? Auf Touch kann ein Finger auf einem Bauteil entweder die
 * Karte pannen oder das Bauteil ziehen. React Flow bekommt deshalb pro Node
 * `dragHandle: '.node-drag-handle'` (siehe FlowCanvas): Wischen über dem Node
 * pannt, Ziehen am Griff verschiebt. Damit kollidieren Pan und Node-Drag
 * konstruktionsbedingt nicht mehr (Akzeptanzkriterium A4).
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
