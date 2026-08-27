import React from 'react';
import type { NodeProps, NodeTypes } from 'reactflow';
import { getComponentSpec } from '../../registry';

const nodeColor = (type: string): string => {
  const domains = getComponentSpec(type)?.domains ?? [];
  if (domains.includes('WATER')) return 'var(--pipe-fresh)';
  if (domains.includes('Solar')) return 'var(--wire-solar)';
  if (domains.includes('AC_230V')) return 'var(--wire-ac)';
  return 'var(--wire-dc)';
};

/**
 * Supplies consistent overview/standard overlays without rewriting every
 * legacy node card. The real component remains mounted (and keeps its measured
 * dimensions and handles); CSS reveals it only at the full-detail zoom level.
 */
function withNodePresentation(
  type: string,
  Component: React.ComponentType<NodeProps>
): React.ComponentType<NodeProps> {
  const Presented = (props: NodeProps) => {
    const spec = getComponentSpec(type);
    const Icon = spec?.icon;
    const typeLabel = spec?.label ?? type;
    const label = String(props.data?.label || typeLabel);
    const color = nodeColor(type);

    return (
      <div className="node-presentation-shell" data-node-kind={type}>
        <div className="node-visual-content">
          <Component {...props} />
        </div>
        <div
          className="node-medium-card"
          role="group"
          aria-label={`${label}, ${typeLabel}. Komponente im Plan.`}
          style={{ borderColor: color }}
        >
          {Icon && <Icon className="h-6 w-6 shrink-0" style={{ color }} aria-hidden="true" />}
          <div className="min-w-0">
            <strong className="block truncate text-sm text-foreground">{label}</strong>
            <span className="block truncate text-xs text-muted-foreground">{typeLabel}</span>
          </div>
        </div>
        <div
          className="node-overview-marker"
          style={{ backgroundColor: color }}
          aria-label={`${label}, ${typeLabel}`}
        >
          {Icon && <Icon className="h-7 w-7 text-white" aria-hidden="true" />}
        </div>
      </div>
    );
  };
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
