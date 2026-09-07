'use client';

import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export function DachNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[180px] rounded-2xl border bg-white p-3 shadow-sm transition-shadow ${
        selected ? 'border-blue-500 shadow-lg' : 'border-stone-200'
      }`}
    >
      <div className="text-sm font-semibold text-stone-900">{data?.label || 'Dach-Element'}</div>
      <div className="mt-1 text-xs text-stone-500">Dach-Komponente</div>
      <Handle type="target" position={Position.Top} id="a" className="!bg-slate-600" />
      <Handle type="source" position={Position.Bottom} id="b" className="!bg-slate-600" />
    </div>
  );
}
