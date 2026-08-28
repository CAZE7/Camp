'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { type GroundNodeData, type PlannerNodeProps } from './types';
import { NodeSymbol } from './NodeSymbol';

const GroundNode = function ({ data, isConnectable, selected }: PlannerNodeProps<GroundNodeData>) {
  return (
    <div
      role="group"
      aria-label={`${data.label || 'Massepunkt'}. Komponente im Plan.`}
      className={`custom-drag-handle flex w-32 flex-col items-center rounded-md border-2 border-gray-600 bg-gray-100 p-3 shadow-md transition-all hover:scale-105 ${selected ? 'shadow-xl ring-4 ring-blue-500' : ''}`}
    >
      <NodeSymbol kind="ground" />
      <div className="mb-1 text-center text-sm font-bold">{data.label || 'Massepunkt'}</div>
      <div className="mb-2 text-xs text-gray-500">(Karosserie)</div>

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
            background: 'black',
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
            background: 'black',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};
export default React.memo(GroundNode);
