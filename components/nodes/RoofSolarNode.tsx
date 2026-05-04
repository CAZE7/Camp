"use client";
import React from 'react';

import { NodeResizer } from 'reactflow';
import { cn } from '@/lib/utils';

const RoofSolarNode = function({ id, data, selected }: { id: string, data: any, selected: boolean }) {
  const width = data.width || 100;
  const height = data.height || 60;
  const watts = data.watts || 100;
  const isInvalid = data.isInvalid || false;
  const onNodeResize = data.onNodeResize;

  // Scale: 1cm = 2px
  return (
    <>
      <NodeResizer
        minWidth={40}
        minHeight={40}
        isVisible={selected}
        lineClassName="border-orange-500"
        handleClassName="h-3 w-3 bg-white border-2 border-orange-500 rounded-full"
        onResize={(event: any, params: { width: number, height: number }) => {
          if (onNodeResize) {
            onNodeResize(event, { id, ...params });
          }
        }}
      />
      <div
        className={cn(
          "bg-slate-800 border-2 rounded-sm shadow-md flex items-center justify-center relative overflow-hidden group transition-colors",
          selected ? "ring-4 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]" : "",
          isInvalid ? "border-red-500 bg-red-950/40" : "border-slate-600"
        )}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Grid lines to look like solar panel */}
        <div className="hover:scale-105 transition-all custom-drag-handle absolute inset-0 bg-[linear-gradient(to_right,#475569_1px,transparent_1px),linear-gradient(to_bottom,#475569_1px,transparent_1px)] bg-[size:10px_10px] opacity-30 pointer-events-none"></div>

        <div className="font-bold text-xs text-white text-center z-10 px-1 bg-slate-900/60 rounded py-1">
          {data.label || 'Solarpanel'}<br/>
          <span className="text-[10px] text-orange-400">{watts} W</span>
          <br/>
          <span className="text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
            {Math.round(width)}x{Math.round(height)}cm
          </span>
        </div>

        {isInvalid && (
          <div className="absolute inset-0 border-4 border-red-500/50 pointer-events-none animate-pulse"></div>
        )}
      </div>
    </>
  );
}
export default React.memo(RoofSolarNode);
