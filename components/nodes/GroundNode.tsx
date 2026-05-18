"use client";
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { usePlannerStore } from '../../store/usePlannerStore';

const GroundNode = function({ id, data, isConnectable, selected }: any) {
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
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-gray-100 border-2 border-gray-600 rounded-md p-3 shadow-md w-32 flex flex-col items-center ${selected ? " ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : ""}`}>
      <div className="font-bold mb-1 text-sm text-center">{data.label || 'Massepunkt'}</div>
      <div className="text-xs text-gray-500 mb-2">(Karosserie)</div>

      {/* Target handle for connecting to consumers or battery */}
      <Handle type="target" position={Position.Left} id="minus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '50%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
      {/* Source handle for continuing ground connection */}
      <Handle type="source" position={Position.Right} id="minus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '50%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
    </div>
  );
}
export default React.memo(GroundNode);
