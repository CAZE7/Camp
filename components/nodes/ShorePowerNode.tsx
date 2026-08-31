'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { type ShorePowerNodeData, type PlannerNodeProps } from './types';
import { useInlineNodeEditing } from './hooks/useInlineNodeEditing';
import { NodeSymbol } from './NodeSymbol';

const ShorePowerNode = function ({
  id,
  data,
  isConnectable,
  selected,
}: PlannerNodeProps<ShorePowerNodeData>) {
  const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown } =
    useInlineNodeEditing(id);

  return (
    <div
      role="group"
      aria-label={`${data.label || 'Landstromanschluss'}. Komponente im Plan.`}
      className={`custom-drag-handle w-48 rounded-md border-2 border-indigo-500 bg-white p-3 shadow-md transition-all hover:scale-105 ${selected ? 'shadow-xl ring-4 ring-[var(--accent-line)]' : ''}`}
    >
      <NodeSymbol kind="shore" />
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
          onDoubleClick={() => handleDoubleClick('label', data.label || 'Landstromanschluss')}
        >
          {data.label || 'Landstromanschluss'}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-[var(--text-med)]">
        <div>230V Eingang</div>
        <div>RCD (30mA): {data.hasRcd ? 'Ja' : 'Nein'}</div>
      </div>
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
export default React.memo(ShorePowerNode);
