import React from 'react';
import { Handle, Position } from 'reactflow';

export default function Consumer230VNode({ id, data, isConnectable }: any) {
  return (
    <div className="bg-white border-2 border-purple-500 rounded-md p-3 shadow-md w-48">
      <div className="font-bold mb-2 text-sm text-center">{data.label || '230V Verbraucher'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>Leistung: {data.watts || 0} W</div>
        <div>Nutzung: {data.hours || 0} h/Tag</div>
      </div>
      <Handle type="target" position={Position.Left} id="in-plus" style={{ background: 'blue', top: '50%' }} isConnectable={isConnectable} />
    </div>
  );
}
