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
    <div className={`hover:scale-105 transition-all custom-drag-handle border-2 rounded-md p-3 shadow-md w-48 ${bgColor} ${borderColor} ${selected ? 'ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : ''}`}>
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Wasser-Komponente'}</div>

      {/* Target handle (Input) */}
      <Handle type="target" position={Position.Left} id="in" isConnectable={isConnectable} className="!w-4 !h-4 !bg-blue-600 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '50%'}} />

      {/* Source handle (Output) */}
      <Handle type="source" position={Position.Right} id="out" isConnectable={isConnectable} className="!w-4 !h-4 !bg-blue-600 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '50%'}} />
    </div>
  );
}
export default React.memo(WaterNode);
