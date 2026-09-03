'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { type PlannerNodeProps, type WaterNodeData } from './types';

const WaterNode = function ({ data, isConnectable, selected, type }: PlannerNodeProps<WaterNodeData>) {
  // D-1: Tints aus Signaltokens (siehe .tint-* in globals.css) statt
  // Tailwind-Palettenfarben — dadurch stimmen hell und dunkel automatisch.
  let bgColor = 'bg-warn-info-bg';
  let borderColor = 'border-[color:var(--pipe-fresh)]';

  if (type === 'grayWaterTank') {
    bgColor = 'tint-gray-water';
    borderColor = 'border-[color:var(--pipe-gray)]';
  } else if (type === 'freshWaterTank') {
    bgColor = 'tint-fresh';
    borderColor = 'border-[color:var(--pipe-fresh)]';
  } else if (type === 'pump') {
    bgColor = 'tint-pump';
    borderColor = 'border-[color:var(--pipe-fresh)]';
  } else if (type === 'accumulator') {
    bgColor = 'tint-acc';
    borderColor = 'border-[color:var(--wire-ac)]';
  } else if (type === 'preFilter') {
    bgColor = 'tint-filter';
    borderColor = 'border-[color:var(--ok)]';
  }

  return (
    <div
      role="group"
      data-selected={selected || undefined}
      aria-label={`${data.label || 'Wasser-Komponente'}. Komponente im Plan.`}
      className={`node-card custom-drag-handle w-48 p-3 ${bgColor} ${borderColor} ${selected ? 'node-card--selected' : ''}`}
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
