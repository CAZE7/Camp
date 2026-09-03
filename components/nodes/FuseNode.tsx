'use client';
import React from 'react';
import { Handle, Position } from 'reactflow';
import { type FuseNodeData, type PlannerNodeProps } from './types';
import { useInlineNodeEditing } from './hooks/useInlineNodeEditing';
import { NodeSymbol } from './NodeSymbol';

const FuseNode = function ({ id, data, isConnectable, selected }: PlannerNodeProps<FuseNodeData>) {
  const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown } =
    useInlineNodeEditing(id);

  return (
    <div
      role="group"
      data-selected={selected || undefined}
      aria-label={`${data.label || 'Sicherungskasten'}. Komponente im Plan.`}
      className={`node-card custom-drag-handle w-48 p-3 ${selected ? 'node-card--selected' : ''}`}
    >
      <NodeSymbol kind="fuse" />
      {editingField === 'label' ? (
        <input
          autoFocus
          className="mb-2 min-h-11 w-full rounded border border-border px-1 text-center text-sm font-bold"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div
          className="mb-2 cursor-text text-center text-sm font-bold"
          onDoubleClick={() => handleDoubleClick('label', data.label || 'Sicherungskasten')}
        >
          {data.label || 'Sicherungskasten'}
        </div>
      )}
      <div className="measure flex flex-col gap-1 text-xs text-muted-foreground">
        {editingField === 'rating' ? (
          <div className="flex items-center gap-1">
            <span>Sicherung:</span>
            <input
              autoFocus
              type="text"
              className="min-h-11 w-16 rounded border border-border px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span>A</span>
          </div>
        ) : (
          <div className="cursor-text" onDoubleClick={() => handleDoubleClick('rating', data.rating || 0)}>
            Sicherung: {data.rating || 0} A
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
            background: 'var(--wire-dc-minus)',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};
export default React.memo(FuseNode);
