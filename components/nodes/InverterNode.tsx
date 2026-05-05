"use client";
import React, { useMemo } from 'react';
import { Handle, Position, useNodes } from 'reactflow';
import { CommonNodeData } from './types';

const InverterNode = function({ id, data, isConnectable, selected }: any) {
  const nodes = useNodes<CommonNodeData>();

  const overloadStats = useMemo(() => {
    const concurrentDevices = data.concurrentDevices || [];
    const continuousPower = data.continuousPower || 0;

    let totalWatts = 0;
    nodes.forEach(n => {
      if (n.type === 'consumer230v' && concurrentDevices.includes(n.id)) {
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
      <div className="font-bold mb-2 text-sm text-center">{data.label || 'Wechselrichter'}</div>
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        <div>12V in / 230V out</div>
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
