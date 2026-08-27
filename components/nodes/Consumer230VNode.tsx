'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { Consumer230VNodeData, PlannerNodeProps } from './types';
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
      className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-purple-500 rounded-md p-3 shadow-md w-48 ${selected ? ' ring-4 ring-blue-500 shadow-xl' : ''}`}
    >
      <NodeSymbol kind="consumer-ac" />
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
          onDoubleClick={() => handleDoubleClick('label', data.label || '230V Verbraucher')}
        >
          {data.label || '230V Verbraucher'}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        {editingField === 'watts' ? (
          <div className="flex items-center gap-1">
            <span>Leistung:</span>
            <input
              autoFocus
              type="text"
              className="min-h-11 w-16 border border-blue-500 rounded px-1 text-xs"
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
              className="min-h-11 w-16 border border-blue-500 rounded px-1 text-xs"
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
            background: 'red',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};
export default React.memo(Consumer230VNode);
