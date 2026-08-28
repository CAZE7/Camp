"use client";
import React from 'react';
import { Handle, Position } from 'reactflow';

const WaterNode = function({ id, data, isConnectable, selected, type }: any) {
  let bgColor = 'bg-blue-50';
  let borderColor = 'border-blue-400';

  if (type === 'grayWaterTank') {
    bgColor = 'bg-gray-200';
    borderColor = 'border-gray-500';
  } else if (type === 'freshWaterTank') {
    bgColor = 'bg-blue-200';
    borderColor = 'border-blue-500';
  } else if (type === 'pump') {
    bgColor = 'bg-cyan-100';
    borderColor = 'border-cyan-500';
  } else if (type === 'accumulator') {
    bgColor = 'bg-indigo-100';
    borderColor = 'border-indigo-400';
  } else if (type === 'preFilter') {
    bgColor = 'bg-teal-100';
    borderColor = 'border-teal-400';
  }

  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle border-2 rounded-md p-3 shadow-md w-48 min-w-[192px] ${bgColor} ${borderColor} ${selected ? 'ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : ''}`}>
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Wasser-Komponente'}</div>

      {/* Target handle (Input) */}
      <Handle type="target" position={Position.Left} id="in" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '50%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>

      {/* Source handle (Output) */}
      <Handle type="source" position={Position.Right} id="out" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '50%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
    </div>
  );
}
export default React.memo(WaterNode);
