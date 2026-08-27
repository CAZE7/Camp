'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { BatteryNodeData, PlannerNodeProps } from './types';
import { useInlineNodeEditing } from './hooks/useInlineNodeEditing';
import { NodeSymbol } from './NodeSymbol';

const BatteryNode = function ({ id, data, isConnectable, selected }: PlannerNodeProps<BatteryNodeData>) {
  const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown } =
    useInlineNodeEditing(id);

  return (
    <div
      role="group"
      aria-label={`${data.label || 'Batterie'}. Komponente im Plan.`}
      className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 border-blue-500 rounded-md p-3 shadow-md w-48 ${selected ? ' ring-4 ring-blue-500 shadow-xl' : ''}`}
    >
      <NodeSymbol kind="battery" />
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
          onDoubleClick={() => handleDoubleClick('label', data.label || 'Batterie')}
        >
          {data.label || 'Batterie'}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-600">
        {editingField === 'capacity' ? (
          <div className="flex items-center gap-1">
            <span>Kapazität:</span>
            <input
              autoFocus
              type="text"
              className="min-h-11 w-16 border border-blue-500 rounded px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span>Ah</span>
          </div>
        ) : (
          <div
            className="cursor-text"
            onDoubleClick={() => handleDoubleClick('capacity', data.capacity || 0)}
          >
            Kapazität: {data.capacity || 0} Ah
          </div>
        )}
        {editingField === 'chemistry' ? (
          <div className="flex items-center gap-1">
            <span>Chemie:</span>
            <input
              autoFocus
              type="text"
              className="min-h-11 w-16 border border-blue-500 rounded px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span></span>
          </div>
        ) : (
          <div
            className="cursor-text"
            onDoubleClick={() => handleDoubleClick('chemistry', data.chemistry || 'LiFePO4')}
          >
            Chemie: {data.chemistry || 'LiFePO4'}{' '}
          </div>
        )}
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
    </div>
  );
};
export default React.memo(BatteryNode);
