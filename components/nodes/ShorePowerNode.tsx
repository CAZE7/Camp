"use client";
import React from 'react';
import { Handle, Position } from 'reactflow';

const ShorePowerNode = function({ id, data, isConnectable, selected }: any) {
  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-indigo-500 rounded-md p-3 shadow-md w-48 ${selected ? " ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : ""}`}>
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Landstromanschluss'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>230V Eingang</div>
        <div>RCD (30mA): {data.hasRcd ? 'Ja' : 'Nein'}</div>
      </div>
      <Handle type="source" position={Position.Right} id="plus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '50%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
    </div>
  );
}
export default React.memo(ShorePowerNode);
