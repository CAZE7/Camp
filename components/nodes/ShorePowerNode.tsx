'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { ShorePowerNodeData, PlannerNodeProps } from './types';
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
      className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-indigo-500 rounded-md p-3 shadow-md w-48 ${selected ? ' ring-4 ring-blue-500 shadow-xl' : ''}`}
    >
      <NodeSymbol kind="shore" />
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
        <div
          className="font-bold mb-2 text-sm text-center cursor-text"
          onDoubleClick={() => handleDoubleClick('label', data.label || 'Landstromanschluss')}
        >
          {data.label || 'Landstromanschluss'}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-600">
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
            background: 'red',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};
export default React.memo(ShorePowerNode);
