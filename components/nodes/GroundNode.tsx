'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { type GroundNodeData, type PlannerNodeProps } from './types';
import { NodeSymbol } from './NodeSymbol';

const GroundNode = function ({ data, isConnectable, selected }: PlannerNodeProps<GroundNodeData>) {
  return (
    <div
      role="group"
      data-selected={selected || undefined}
      aria-label={`${data.label || 'Massepunkt'}. Komponente im Plan.`}
      className={`node-card custom-drag-handle flex w-32 flex-col items-center p-3 ${selected ? 'node-card--selected' : ''}`}
    >
      <NodeSymbol kind="ground" />
      <div className="mb-1 text-center text-sm font-bold">{data.label || 'Massepunkt'}</div>
      <div className="measure mb-2 text-xs text-muted-foreground">(Karosserie)</div>

      {/* Target handle for connecting to consumers or battery */}
      <Handle
        type="target"
        position={Position.Left}
        id="minus"
        isConnectable={isConnectable}
        style={{
          background: 'transparent',
          border: 'none',
          width: '24px',
          height: '24px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          top: '50%',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--wire-dc-minus)',
            pointerEvents: 'none',
          }}
        />
      </Handle>
      {/* Source handle for continuing ground connection */}
      <Handle
        type="source"
        position={Position.Right}
        id="minus"
        isConnectable={isConnectable}
        style={{
          background: 'transparent',
          border: 'none',
          width: '24px',
          height: '24px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          top: '50%',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--wire-dc-minus)',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};
export default React.memo(GroundNode);
