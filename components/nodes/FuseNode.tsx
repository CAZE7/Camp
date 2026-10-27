'use client';
import React, { useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { type FuseNodeData, type PlannerNodeProps } from './types';
import { useInlineNodeEditing } from './hooks/useInlineNodeEditing';
import { NodeSymbol } from './NodeSymbol';
import { DesignatorContext, resolvedDesignator } from './designators';

/** 0 und negative Angaben sind fehlende Nennströme, keine Sicherung „0 A“. */
function shownFuseRating(rating: unknown): number | null {
  const numeric =
    typeof rating === 'number' ? rating : typeof rating === 'string' ? Number(rating) : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

const FuseNode = function ({ id, data, isConnectable, selected }: PlannerNodeProps<FuseNodeData>) {
  const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown } =
    useInlineNodeEditing(id);
  const designators = useContext(DesignatorContext);

  return (
    <div
      role="group"
      data-selected={selected || undefined}
      aria-label={`${data.label || 'Sicherungskasten'}. Komponente im Plan.`}
      className={`node-card de-node-card custom-drag-handle w-48 p-3 ${selected ? 'node-card--selected' : ''} ${selected ? 'de-node-card--selected' : ''}`}
    >
      <NodeSymbol kind="fuse" dinCode={resolvedDesignator(designators, id, data)} />
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
          title={data.label || 'Sicherungskasten'}
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
          <div className="cursor-text" onDoubleClick={() => handleDoubleClick('rating', data.rating ?? '')}>
            {/* Kein Nennstrom eingetragen = fehlende Angabe, KEIN Wert „0 A“ (kein stiller Fallback). */}
            {shownFuseRating(data.rating) !== null
              ? `Sicherung: ${shownFuseRating(data.rating)} A`
              : 'Sicherung: nicht angegeben'}
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
