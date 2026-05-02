import React from 'react';
import { Handle, Position } from 'reactflow';

export default function InverterNode({ id, data, isConnectable }: any) {
  return (
    <div className="bg-white border-2 border-teal-500 rounded-md p-3 shadow-md w-48">
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Wechselrichter'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>12V in / 230V out</div>
        <div>Effizienz: 85%</div>
      </div>
      <Handle type="target" position={Position.Left} id="in-plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="in-minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="out-plus" style={{ background: 'blue', top: '50%' }} isConnectable={isConnectable} />
    </div>
  );
}
