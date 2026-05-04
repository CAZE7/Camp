"use client";
import React from 'react';

import { NodeResizer } from 'reactflow';
import { cn } from '@/lib/utils';

const RoofWindowNode = function({ id, data, selected }: { id: string, data: any, selected: boolean }) {
  const width = data.width || 40;
  const height = data.height || 40;
  const isInvalid = data.isInvalid || false;
  const onNodeResize = data.onNodeResize;

  // Scale: 1cm = 2px
  return (
    <>
      <NodeResizer
        minWidth={30}
        minHeight={30}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="h-3 w-3 bg-white border-2 border-blue-500 rounded-full"
        onResize={(event: React.SyntheticEvent, params: { width: number, height: number }) => {
          if (onNodeResize) {
            onNodeResize(event, { id, ...params });
          }
        }}
      />
      <div
        className={cn(
          "bg-blue-100/50 backdrop-blur-sm border-2 rounded-sm shadow-sm flex items-center justify-center relative overflow-hidden transition-colors",
          selected ? "ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : "",
          isInvalid ? "border-red-500 bg-red-950/40" : "border-blue-400"
        )}
        style={{ width: '100%', height: '100%' }}
      >
        <div className="hover:scale-105 transition-all custom-drag-handle absolute inset-2 border border-blue-300/50 rounded-sm pointer-events-none"></div>
        <div className="font-semibold text-xs text-blue-800 text-center drop-shadow-sm px-1">
          {data.label || 'Dachfenster'}<br/>
          <span className="text-[10px] opacity-80">{Math.round(width)}x{Math.round(height)}cm</span>
        </div>
        {isInvalid && (
          <div className="absolute inset-0 border-4 border-red-500/50 pointer-events-none animate-pulse"></div>
        )}
      </div>
    </>
  );
}
export default React.memo(RoofWindowNode);
