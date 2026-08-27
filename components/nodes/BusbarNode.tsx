'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { PlannerNodeData, PlannerNodeProps } from './types';
import { useInlineNodeEditing } from './hooks/useInlineNodeEditing';
import { NodeSymbol } from './NodeSymbol';

const BusbarNode = function ({ id, data, isConnectable, selected }: PlannerNodeProps<PlannerNodeData>) {
  const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown } =
    useInlineNodeEditing(id);

  return (
    <div
      role="group"
      aria-label={`${data.label || 'Sammelschiene'}. Komponente im Plan.`}
      className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-slate-700 rounded-md p-3 shadow-md w-48 ${selected ? ' ring-4 ring-blue-500 shadow-xl' : ''}`}
    >
      <NodeSymbol kind="busbar" />
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
          onDoubleClick={() => handleDoubleClick('label', data.label || 'Sammelschiene')}
        >
          {data.label || 'Sammelschiene'}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        {editingField === 'rating' ? (
          <div className="flex items-center gap-1">
            <span>Max Strom:</span>
            <input
              autoFocus
              type="text"
              className="min-h-11 w-16 border border-blue-500 rounded px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span>A</span>
          </div>
        ) : (
          <div className="cursor-text" onDoubleClick={() => handleDoubleClick('rating', data.rating || 250)}>
            Max Strom: {data.rating || 250} A
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
          top: '30%',
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
            background: 'black',
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
          top: '30%',
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
      <Handle
        type="source"
        position={Position.Right}
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
            background: 'black',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};
export default React.memo(BusbarNode);
