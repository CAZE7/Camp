import React from 'react';
import { Handle, Position } from 'reactflow';

export default function GroundNode({ id, data, isConnectable }: any) {
  return (
    <div className="bg-gray-100 border-2 border-gray-600 rounded-md p-3 shadow-md w-32 flex flex-col items-center">
      <div className="font-bold mb-1 text-sm text-center">{data.label || 'Massepunkt'}</div>
      <div className="text-xs text-gray-500 mb-2">(Karosserie)</div>

      {/* Target handle for connecting to consumers or battery */}
      <Handle
        type="target"
        position={Position.Left}
        id="in-minus"
        style={{ background: 'black' }}
        isConnectable={isConnectable}
      />
      {/* Source handle for continuing ground connection */}
      <Handle
        type="source"
        position={Position.Right}
        id="out-minus"
        style={{ background: 'black' }}
        isConnectable={isConnectable}
      />
    </div>
  );
}
