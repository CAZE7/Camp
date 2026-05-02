import React from 'react';
import { Handle, Position } from 'reactflow';

export default function InverterNode({ id, data, isConnectable, selected }: any) {
  return (
    <div className={"bg-white border-2 border-teal-500 rounded-md p-3 shadow-md w-48" + (selected ? " ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : "")}>
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Wechselrichter'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>12V in / 230V out</div>
        <div>Effizienz: 85%</div>
      </div>
      <Handle type="target" position={Position.Left} id="in-plus"  isConnectable={isConnectable}  style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '30%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="target" position={Position.Left} id="in-minus"  isConnectable={isConnectable}  style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '70%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="source" position={Position.Right} id="out-plus"  isConnectable={isConnectable}  style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '50%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'blue', pointerEvents: 'none' }} />
      </Handle>
    </div>
  );
}
