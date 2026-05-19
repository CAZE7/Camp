"use client";
import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PlannerNodeData } from './types';
import { usePlannerStore } from '../../store/usePlannerStore';

const FuseNode = function({ id, data, isConnectable, selected }: NodeProps<PlannerNodeData>) {
  const updateNodeData = usePlannerStore((state) => state.updateNodeData);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const handleDoubleClick = (field: string, currentValue: any) => {
    setEditingField(field);
    setTempValue(String(currentValue));
  };

  const handleBlur = () => {
    if (editingField) {
      let finalValue: any = tempValue;
      if (editingField !== 'label' && editingField !== 'chemistry') {
        finalValue = Number(tempValue) || 0;
      }
      updateNodeData(id, { [editingField]: finalValue });
    }
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-red-500 rounded-md p-3 shadow-md w-48 ${selected ? " ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : ""}`}>
      {editingField === 'label' ? (
        <input
          autoFocus
          className="font-bold mb-2 text-sm text-center w-full border border-blue-500 rounded px-1"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className="font-bold mb-2 text-sm text-center cursor-text" onDoubleClick={() => handleDoubleClick('label', data.label || 'Sicherungskasten')}>{data.label || 'Sicherungskasten'}</div>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        {editingField === 'rating' ? (
          <div className="flex items-center gap-1">
            <span>Sicherung:</span>
            <input
              autoFocus
              type="text"
              className="w-16 border border-blue-500 rounded px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span>A</span>
          </div>
        ) : (
          <div className="cursor-text" onDoubleClick={() => handleDoubleClick('rating', data.rating || 0)}>Sicherung: {data.rating || 0} A</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="plus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '30%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="target" position={Position.Left} id="minus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '70%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="source" position={Position.Right} id="plus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '30%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="source" position={Position.Right} id="minus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '70%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
    </div>
  );
}
export default React.memo(FuseNode);
