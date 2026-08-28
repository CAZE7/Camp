'use client';
import React from 'react';

import { NodeResizer } from 'reactflow';
import { cn } from '@/lib/utils';
import { type RoofNodeData } from './types';

const RoofSolarNode = function ({
  id,
  data,
  selected,
}: {
  id: string;
  data: RoofNodeData;
  selected: boolean;
}) {
  const width = data.width || 100;
  const height = data.height || 60;
  const watts = data.watts || 100;
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
        lineClassName="!border-copper"
        handleClassName="!h-5 !w-5 !bg-bone !border-2 !border-copper rounded-full"
        onResize={(event, params) => {
          if (onNodeResize) {
            onNodeResize(event, { id, ...params });
          }
        }}
      />
      <div
        role="group"
        aria-label={`Solarpanel ${Math.round(width)} mal ${Math.round(height)} Zentimeter, ${watts} Watt${isInvalid ? ', ragt aus der Safe Zone' : ''}${isOverlapping ? ', überlappt ein anderes Element' : ''}`}

        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden border-2 bg-soot text-paper transition-colors',
          selected ? 'ring-2 ring-copper ring-offset-2 ring-offset-paper' : '',
          state === 'invalid' && 'border-warn-critical bg-warn-critical-bg text-warn-critical',
          state === 'overlap' && 'ring-warn-warning/40 border-warn-warning ring-2',
          state === 'ok' && 'border-ink'
        )}
        style={{ width: '100%', height: '100%' }}
      >
        <div
          className="custom-drag-handle roof-solar-grid pointer-events-none absolute inset-0 opacity-25"
          aria-hidden="true"
        />

        <div className="z-10 rounded-none bg-black/40 px-2 py-1 text-center text-xs font-semibold text-paper">
          {data.label || 'Solarpanel'}
          <br />
          <span className="measure text-copper">{watts} W</span>
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
              'caption-xs absolute left-1 top-1 z-10 rounded-full px-2 py-0.5 font-bold text-paper',
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
export default React.memo(RoofSolarNode);
