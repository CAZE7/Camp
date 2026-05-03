"use client";
import React from 'react';
import { Handle, Position } from 'reactflow';

const GroundNode = function({ id, data, isConnectable, selected }: any) {
  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-gray-100 border-2 border-gray-600 rounded-md p-3 shadow-md w-32 flex flex-col items-center ${selected ? " ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : ""}`}>
      <div className="font-bold mb-1 text-sm text-center">{data.label || 'Massepunkt'}</div>
      <div className="text-xs text-gray-500 mb-2">(Karosserie)</div>

      {/* Target handle for connecting to consumers or battery */}
      <Handle type="target" position={Position.Left} id="in-minus" isConnectable={isConnectable} className="!w-4 !h-4 !bg-slate-900 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '50%'}} />
      {/* Source handle for continuing ground connection */}
      <Handle type="source" position={Position.Right} id="out-minus" isConnectable={isConnectable} className="!w-4 !h-4 !bg-slate-900 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '50%'}} />
    </div>
  );
}
export default React.memo(GroundNode);
