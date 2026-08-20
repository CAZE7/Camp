"use client";
import React, { useMemo, useState } from 'react';
import { Handle, Position, useNodes, NodeProps } from 'reactflow';
import { PlannerNodeData } from './types';
import { usePlannerStore } from '../../store/usePlannerStore';
import { CommonNodeData } from './types';

const InverterNode = function({ id, data, isConnectable, selected }: NodeProps<PlannerNodeData>) {
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

  const nodes = useNodes<CommonNodeData>();

  const overloadStats = useMemo(() => {
    const concurrentDevices = data.concurrentDevices || [];
    const continuousPower = data.continuousPower || 0;

    let totalWatts = 0;
    const deviceSet = new Set(concurrentDevices);
    nodes.forEach(n => {
      if (n.type === 'consumer230v' && deviceSet.has(n.id)) {
        totalWatts += n.data?.watts || 0;
      }
    });

    return {
      isOverloaded: continuousPower > 0 && totalWatts > continuousPower,
      totalWatts,
      continuousPower
    };
  }, [nodes, data.concurrentDevices, data.continuousPower]);

  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 rounded-md p-3 shadow-md w-48 ${overloadStats.isOverloaded ? "border-red-500 bg-red-50" : "border-teal-500"} ${selected ? (overloadStats.isOverloaded ? "ring-4 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]" : "ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]") : ""}`}>
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
        <div className="font-bold mb-2 text-sm text-center cursor-text" onDoubleClick={() => handleDoubleClick('label', data.label || 'Wechselrichter')}>{data.label || 'Wechselrichter'}</div>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>12V in / 230V out</div>
        <div className="text-[10px] text-gray-400">AC-In oben</div>
        <div>Effizienz: 85%</div>
        {overloadStats.continuousPower > 0 && (
          <div>Leistung: {overloadStats.continuousPower} W</div>
        )}
      </div>

      {overloadStats.isOverloaded && (
        <div className="mt-2 p-1 bg-red-500 text-white text-[10px] font-bold rounded text-center leading-tight">
          Überlastung! Wechselrichter zu schwach für angeschlossene AC-Geräte.
        </div>
      )}

      <Handle type="target" position={Position.Top} id="ac_in" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="target" position={Position.Left} id="plus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '30%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="target" position={Position.Left} id="minus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '70%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'black', pointerEvents: 'none' }} />
      </Handle>
      <Handle type="source" position={Position.Right} id="plus" isConnectable={isConnectable} style={{ background: 'transparent', border: 'none', width: '24px', height: '24px', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', top: '50%' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'red', pointerEvents: 'none' }} />
      </Handle>
    </div>
  );
}
export default React.memo(InverterNode);
