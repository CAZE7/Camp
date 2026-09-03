import React from 'react';
import type { NodeProps, NodeTypes } from 'reactflow';

/**
 * M8-1: Zoom-Stufen sind abgeschafft. Jede Komponente rendert immer ihre
 * volle Karte — keine Overview-/Standard-Overlays mehr, die beim Rauszoomen
 * das Aussehen wechseln. `display: contents` am Wrapper erzeugt keine eigene
 * Box, damit React Flow weiter die echte Kartengröße misst.
 */
function withNodePresentation(
  type: string,
  Component: React.ComponentType<NodeProps>
): React.ComponentType<NodeProps> {
  const Presented = (props: NodeProps) => (
    <div className="node-presentation-shell" data-node-kind={type}>
      <Component {...props} />
    </div>
  );
  Presented.displayName = `withNodePresentation(${type})`;
  return Presented;
}

export function withNodePresentations(types: NodeTypes): NodeTypes {
  const result: NodeTypes = {};
  for (const [type, Component] of Object.entries(types)) {
    result[type] = withNodePresentation(type, Component as React.ComponentType<NodeProps>);
  }
  return result;
}
