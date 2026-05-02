import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function ConsumerNode({ id, data, isConnectable }: any) {
  const { setNodes } = useReactFlow();

  const onChangeWatts = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, watts: Number(e.target.value) } } : n))
    );
  };

  const onChangeHours = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, hours: Number(e.target.value) } } : n))
    );
  };

  return (
    <div className="bg-white border-2 border-green-500 rounded-md p-3 shadow-md w-48">
      <div className="font-bold mb-2 text-sm text-center">Verbraucher</div>
      <div className="flex flex-col gap-2">
        <label className="text-xs">
          Leistung (W):
          <input
            type="number"
            className="w-full mt-1 border rounded p-1 text-xs"
            value={data.watts || 0}
            onChange={onChangeWatts}
            min="0"
          />
        </label>
        <label className="text-xs">
          Nutzung (h/Tag):
          <input
            type="number"
            className="w-full mt-1 border rounded p-1 text-xs"
            value={data.hours || 0}
            onChange={onChangeHours}
            min="0"
            max="24"
          />
        </label>
      </div>
      <Handle type="target" position={Position.Left} id="plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="out-plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="out-minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
    </div>
  );
}
