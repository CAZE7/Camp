import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

export default function BatteryNode({ id, data, isConnectable }: any) {
  const { setNodes } = useReactFlow();

  const onChangeCapacity = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, capacity: Number(e.target.value) } } : n))
    );
  };

  const onChangeChemistry = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, chemistry: e.target.value } } : n))
    );
  };

  return (
    <div className="bg-white border-2 border-blue-500 rounded-md p-3 shadow-md w-48">
      <div className="font-bold mb-2 text-sm text-center">Batterie</div>
      <div className="flex flex-col gap-2">
        <label className="text-xs">
          Kapazität (Ah):
          <input
            type="number"
            className="w-full mt-1 border rounded p-1 text-xs"
            value={data.capacity || 0}
            onChange={onChangeCapacity}
            min="0"
          />
        </label>
        <label className="text-xs">
          Zellchemie:
          <select
            className="w-full mt-1 border rounded p-1 text-xs"
            value={data.chemistry || 'LiFePO4'}
            onChange={onChangeChemistry}
          >
            <option value="LiFePO4">LiFePO4</option>
            <option value="AGM">AGM</option>
          </select>
        </label>
      </div>
      <Handle type="source" position={Position.Right} id="plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="in-plus" style={{ background: 'red', top: '30%' }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="in-minus" style={{ background: 'black', top: '70%' }} isConnectable={isConnectable} />
    </div>
  );
}
