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
      <Handle type="target" position={Position.Left} id="plus"  isConnectable={isConnectable}  style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '30%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="target" position={Position.Left} id="minus"  isConnectable={isConnectable}  style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '70%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="source" position={Position.Right} id="out-plus"  isConnectable={isConnectable}  style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '30%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="source" position={Position.Right} id="out-minus"  isConnectable={isConnectable}  style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '70%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
    </div>
  );
}
