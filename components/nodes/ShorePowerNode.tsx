import React from 'react';
import { Handle, Position } from 'reactflow';

export default function ShorePowerNode({ id, data, isConnectable }: any) {
  return (
    <div className="bg-white border-2 border-indigo-500 rounded-md p-3 shadow-md w-48">
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Landstromanschluss'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>230V Eingang</div>
        <div>RCD (30mA): {data.hasRcd ? 'Ja' : 'Nein'}</div>
      </div>
      <Handle type="source" position={Position.Right} id="out-plus" style={{ background: 'blue', top: '50%' }} isConnectable={isConnectable} />
    </div>
  );
}
