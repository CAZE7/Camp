"use client";
import React from 'react';
import { Handle, Position } from 'reactflow';

const FuseNode = function({ id, data, isConnectable, selected }: any) {
  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-red-500 rounded-md p-3 shadow-md w-48 ${selected ? " ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : ""}`}>
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Sicherungskasten'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>Sicherung: {data.rating || 0} A</div>
      </div>
      <Handle type="target" position={Position.Left} id="in-plus" isConnectable={isConnectable} className="!w-4 !h-4 !bg-red-600 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '30%'}} />
      <Handle type="target" position={Position.Left} id="in-minus" isConnectable={isConnectable} className="!w-4 !h-4 !bg-slate-900 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '70%'}} />
      <Handle type="source" position={Position.Right} id="out-plus" isConnectable={isConnectable} className="!w-4 !h-4 !bg-red-600 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '30%'}} />
      <Handle type="source" position={Position.Right} id="out-minus" isConnectable={isConnectable} className="!w-4 !h-4 !bg-slate-900 !border-2 !border-gray-800 !z-10 cursor-pointer" style={{top: '70%'}} />
    </div>
  );
}
export default React.memo(FuseNode);
