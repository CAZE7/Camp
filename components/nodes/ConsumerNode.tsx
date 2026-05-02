import React from 'react';
import { Handle, Position } from 'reactflow';

export default function ConsumerNode({ id, data, isConnectable }: any) {
  return (
    <div className="bg-white border-2 border-green-500 rounded-md p-3 shadow-md w-48">
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Verbraucher'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>Leistung: {data.watts || 0} W</div>
        <div>Nutzung: {data.hours || 0} h/Tag</div>
      </div>
      <Handle type="target" position={Position.Left} id="plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="out-plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="out-minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
    </div>
  );
}
