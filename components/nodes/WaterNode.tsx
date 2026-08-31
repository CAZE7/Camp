'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { type PlannerNodeProps, type WaterNodeData } from './types';

const WaterNode = function ({ data, isConnectable, selected, type }: PlannerNodeProps<WaterNodeData>) {
  let bgColor = 'bg-blue-50';
  let borderColor = 'border-blue-700';

  if (type === 'grayWaterTank') {
    bgColor = 'bg-gray-200';
    borderColor = 'border-gray-500';
  } else if (type === 'freshWaterTank') {
    bgColor = 'bg-blue-200';
    borderColor = 'border-blue-500';
  } else if (type === 'pump') {
    bgColor = 'bg-cyan-100';
    borderColor = 'border-cyan-700';
  } else if (type === 'accumulator') {
    bgColor = 'bg-indigo-100';
    borderColor = 'border-indigo-700';
  } else if (type === 'preFilter') {
    bgColor = 'bg-teal-100';
    borderColor = 'border-teal-700';
  }

  return (
    <div
      role="group"
      aria-label={`${data.label || 'Wasser-Komponente'}. Komponente im Plan.`}
      className={`custom-drag-handle w-48 rounded-md border-2 p-3 shadow-md transition-all hover:scale-105 ${bgColor} ${borderColor} ${selected ? 'shadow-xl ring-4 ring-[var(--accent-line)]' : ''}`}
    >
      <div className="mb-2 text-center text-sm font-bold">{data.label || 'Wasser-Komponente'}</div>

      {/* Target handle (Input) */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
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
            background: 'var(--wire-dc)',
            pointerEvents: 'none',
          }}
        />
      </Handle>

      {/* Source handle (Output) */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
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
export default React.memo(WaterNode);
