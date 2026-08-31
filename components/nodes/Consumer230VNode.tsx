'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { type Consumer230VNodeData, type PlannerNodeProps } from './types';
import { useInlineNodeEditing } from './hooks/useInlineNodeEditing';
import { NodeSymbol } from './NodeSymbol';

const Consumer230VNode = function ({
  id,
  data,
  isConnectable,
  selected,
}: PlannerNodeProps<Consumer230VNodeData>) {
  const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown } =
    useInlineNodeEditing(id);

  return (
    <div
      role="group"
      aria-label={`${data.label || '230-V-Gerät'}. Komponente im Plan.`}
      className={`custom-drag-handle w-48 rounded-md border-2 border-purple-500 bg-white p-3 shadow-md transition-all hover:scale-105 ${selected ? 'shadow-xl ring-4 ring-[var(--accent-line)]' : ''}`}
    >
      <NodeSymbol kind="consumer-ac" />
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
          onDoubleClick={() => handleDoubleClick('label', data.label || '230V Verbraucher')}
        >
          {data.label || '230V Verbraucher'}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-[var(--text-med)]">
        {editingField === 'watts' ? (
          <div className="flex items-center gap-1">
            <span>Leistung:</span>
            <input
              autoFocus
              type="text"
              className="min-h-11 w-16 rounded border border-[var(--accent-line)] px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span>W</span>
          </div>
        ) : (
          <div className="cursor-text" onDoubleClick={() => handleDoubleClick('watts', data.watts || 0)}>
            Leistung: {data.watts || 0} W
          </div>
        )}
        {editingField === 'hours' ? (
          <div className="flex items-center gap-1">
            <span>Nutzung:</span>
            <input
              autoFocus
              type="text"
              className="min-h-11 w-16 rounded border border-[var(--accent-line)] px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span>h/Tag</span>
          </div>
        ) : (
          <div className="cursor-text" onDoubleClick={() => handleDoubleClick('hours', data.hours || 0)}>
            Nutzung: {data.hours || 0} h/Tag
          </div>
        )}
      </div>
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
export default React.memo(Consumer230VNode);
