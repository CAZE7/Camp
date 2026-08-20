"use client";
import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PlannerNodeData } from './types';
import { usePlannerStore } from '../../store/usePlannerStore';

const ShuntNode = function({ id, data, isConnectable, selected }: NodeProps<PlannerNodeData>) {
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
        const parsed = Number(tempValue);
        const allowsZero = editingField === 'hours';
        if (!Number.isFinite(parsed) || parsed < 0 || (!allowsZero && parsed === 0)) {
          window.dispatchEvent(new CustomEvent('planner-input-error', { detail: allowsZero ? 'Gib eine Zahl ab 0 ein.' : 'Der Wert muss größer als 0 sein.' }));
          setEditingField(null);
          return;
        }
        finalValue = parsed;
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
    <div role="group" aria-label={`${data.label || 'Batteriemonitor mit Shunt'}. Komponente im Plan.`} className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-stone-500 rounded-md p-3 shadow-md w-48 ${selected ? " ring-4 ring-blue-500 shadow-xl" : ""}`}>
      {editingField === 'label' ? (
        <input
          autoFocus
          className="min-h-11 font-bold mb-2 text-sm text-center w-full border border-blue-500 rounded px-1"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className="font-bold mb-2 text-sm text-center cursor-text" onDoubleClick={() => handleDoubleClick('label', data.label || 'Batteriemonitor (Shunt)')}>{data.label || 'Batteriemonitor (Shunt)'}</div>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>Batteriemonitor</div>
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
export default React.memo(ShuntNode);
