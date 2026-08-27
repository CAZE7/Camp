'use client';
import React from 'react';

import { NodeResizer } from 'reactflow';
import { cn } from '@/lib/utils';
import { RoofNodeData } from './types';

const RoofWindowNode = function ({
  id,
  data,
  selected,
}: {
  id: string;
  data: RoofNodeData;
  selected: boolean;
}) {
  const width = data.width || 40;
  const height = data.height || 40;
  const isInvalid = data.isInvalid || false;
  const isOverlapping = data.isOverlapping || false;
  const state = isInvalid ? 'invalid' : isOverlapping ? 'overlap' : 'ok';
  const onNodeResize = data.onNodeResize;

  return (
    <>
      <NodeResizer
        minWidth={30}
        minHeight={30}
        isVisible={selected}
        lineClassName="!border-warn-info"
        handleClassName="!h-5 !w-5 !bg-bone !border-2 !border-warn-info rounded-full"
        onResize={(event, params) => {
          if (onNodeResize) {
            onNodeResize(event, { id, ...params });
          }
        }}
      />
      <div
        role="group"
        aria-label={`Dachfenster ${Math.round(width)} mal ${Math.round(height)} Zentimeter${isInvalid ? ', ragt aus der Safe Zone' : ''}${isOverlapping ? ', überlappt ein anderes Element' : ''}`}
        aria-invalid={isInvalid || isOverlapping || undefined}
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden border-2 bg-warn-info-bg text-warn-info transition-colors',
          selected ? 'ring-2 ring-warn-info ring-offset-2 ring-offset-paper' : '',
          state === 'invalid' && 'border-warn-critical bg-warn-critical-bg text-warn-critical',
          state === 'overlap' && 'border-warn-warning ring-2 ring-warn-warning/40',
          state === 'ok' && 'border-warn-info'
        )}
        style={{ width: '100%', height: '100%' }}
      >
        <div
          aria-hidden="true"
          className="custom-drag-handle pointer-events-none absolute inset-2 border border-warn-info/50"
        />
        <div className="px-1 text-center text-xs font-semibold">
          {data.label || 'Dachfenster'}
          <br />
          <span className="caption-xs opacity-80">
            {Math.round(width)}x{Math.round(height)}cm
          </span>
        </div>
        {isInvalid && (
          <div
            className="pointer-events-none absolute inset-0 border-4 border-warn-critical"
            aria-hidden="true"
          />
        )}
        {(isInvalid || isOverlapping) && (
          <div
            className={cn(
              'absolute left-1 top-1 z-10 rounded-full px-2 py-0.5 caption-xs font-bold text-paper',
              isInvalid ? 'bg-warn-critical' : 'bg-warn-warning'
            )}
            aria-hidden="true"
          >
            !
          </div>
        )}
      </div>
    </>
  );
};
export default React.memo(RoofWindowNode);
