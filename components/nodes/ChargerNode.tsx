import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ChargerNode({ id, data, isConnectable }: any) {
  const { setNodes } = useReactFlow();

  const onChangeAmps = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, amps: Number(e.target.value) } } : n))
    );
  };

  return (
    <div className="bg-white border-2 border-yellow-500 rounded-md p-3 shadow-md w-48">
      <div className="font-bold mb-2 text-sm text-center">Ladequelle</div>
      <div className="flex flex-col gap-2">
        <label className="text-xs">
          Ladeleistung (A):
          <input
            type="number"
            className="w-full mt-1 border rounded p-1 text-xs"
            value={data.amps || 0}
            onChange={onChangeAmps}
            min="0"
          />
        </label>
      </div>
      <Handle type="source" position={Position.Right} id="plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="in-plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="in-minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
    </div>
  );
}
