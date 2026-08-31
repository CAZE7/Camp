'use client';
import React, { useMemo } from 'react';
import { Handle, Position, useNodes } from 'reactflow';
import { type InverterNodeData, type PlannerNodeProps } from './types';
import { useInlineNodeEditing } from './hooks/useInlineNodeEditing';
import { type CommonNodeData } from './types';
import { NodeSymbol } from './NodeSymbol';

const InverterNode = function ({ id, data, isConnectable, selected }: PlannerNodeProps<InverterNodeData>) {
  const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown } =
    useInlineNodeEditing(id);

  const nodes = useNodes<CommonNodeData>();

  const overloadStats = useMemo(() => {
    const concurrentDevices = data.concurrentDevices || [];
    const continuousPower = data.continuousPower || 0;

    let totalWatts = 0;
    const deviceSet = new Set(concurrentDevices);
    nodes.forEach((n) => {
      if (n.type === 'consumer230v' && deviceSet.has(n.id)) {
        totalWatts += n.data?.watts || 0;
      }
    });

    return {
      isOverloaded: continuousPower > 0 && totalWatts > continuousPower,
      totalWatts,
      continuousPower,
    };
  }, [nodes, data.concurrentDevices, data.continuousPower]);

  return (
    <div
      role="group"
      aria-label={`${data.label || 'Wechselrichter'}. Komponente im Plan.`}
      className={`custom-drag-handle w-48 rounded-md border-2 bg-white p-3 shadow-md transition-all hover:scale-105 ${overloadStats.isOverloaded ? 'border-red-500 bg-red-50' : 'border-teal-700'} ${selected ? (overloadStats.isOverloaded ? 'shadow-xl ring-4 ring-red-500' : 'shadow-xl ring-4 ring-[var(--accent-line)]') : ''}`}
    >
      <NodeSymbol kind="inverter" />
      {editingField === 'label' ? (
        <input
          autoFocus
          className="mb-2 min-h-11 w-full rounded border border-[var(--accent-line)] px-1 text-center text-sm font-bold"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div
          className="mb-2 cursor-text text-center text-sm font-bold"
          onDoubleClick={() => handleDoubleClick('label', data.label || 'Wechselrichter')}
        >
          {data.label || 'Wechselrichter'}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-[var(--text-med)]">
        <div>12 V Eingang / 230 V Ausgang</div>
        <div className="text-xs text-[var(--text-med)]">230-V-Eingang oben</div>
        <div>Effizienz: 85%</div>
        {overloadStats.continuousPower > 0 && <div>Leistung: {overloadStats.continuousPower} W</div>}
      </div>

      {overloadStats.isOverloaded && (
        <div className="mt-2 rounded bg-red-700 p-1 text-center text-xs font-bold leading-tight text-white">
          Überlastung! Wechselrichter zu schwach für angeschlossene AC-Geräte.
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        id="ac_in"
        isConnectable={isConnectable}
        style={{
          background: 'transparent',
          border: 'none',
          width: '24px',
          height: '24px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--wire-ac)',
            pointerEvents: 'none',
          }}
        />
      </Handle>
      <Handle
        type="target"
        position={Position.Left}
        id="plus"
        isConnectable={isConnectable}
        style={{
          background: 'transparent',
          border: 'none',
          width: '24px',
          height: '24px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          top: '30%',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--wire-dc)',
            pointerEvents: 'none',
          }}
        />
      </Handle>
      <Handle
        type="target"
        position={Position.Left}
        id="minus"
        isConnectable={isConnectable}
        style={{
          background: 'transparent',
          border: 'none',
          width: '24px',
          height: '24px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          top: '70%',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--wire-dc-minus)',
            pointerEvents: 'none',
          }}
        />
      </Handle>
      <Handle
        type="source"
        position={Position.Right}
        id="plus"
        isConnectable={isConnectable}
        style={{
          background: 'transparent',
          border: 'none',
          width: '24px',
          height: '24px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          top: '50%',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--wire-dc)',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};
export default React.memo(InverterNode);
