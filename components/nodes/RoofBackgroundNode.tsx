"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { RoofNodeData } from './types';

const RoofBackgroundNode = function({ data }: { data: RoofNodeData }) {
  const { width, height, safeMargins } = data;
  
  // Scale: 1cm = 2px. Width/Height are in cm.
  const pxWidth = (width || 0) * 2;
  const pxHeight = (height || 0) * 2;
  
  const marginFront = (safeMargins?.front || 15) * 2;
  const marginRear = (safeMargins?.rear || 5) * 2;
  const marginLeft = (safeMargins?.left || 5) * 2;
  const marginRight = (safeMargins?.right || 5) * 2;

  return (
    <div 
      className="border-2 border-red-500 border-dashed bg-gray-100/30 rounded-3xl relative shadow-inner"
      style={{ width: pxWidth, height: pxHeight, pointerEvents: 'none' }}
    >
      {/* Front Indicator (Windshield) */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="w-32 h-8 bg-slate-400 rounded-t-full opacity-40"></div>
        <span className="text-xs font-black text-slate-600 uppercase tracking-widest mt-1">Fahrtrichtung</span>
      </div>

      {/* Safe Zone Boundary */}
      <div 
        className="absolute border-2 border-dashed border-blue-700/40 rounded-3xl flex items-center justify-center"
        style={{
          top: marginFront,
          bottom: marginRear,
          left: marginLeft,
          right: marginRight
        }}
      >
        <div className="text-blue-400/30 font-black text-2xl uppercase tracking-widest select-none rotate-90 md:rotate-0">
          Safe Zone
        </div>
      </div>

      {/* Rulers / Grid */}
      <div className="absolute inset-0 opacity-10 roof-dot-grid"></div>
      
      {/* Dimensions Info */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-700 whitespace-nowrap">
        Nutzbare Dachfläche: {width}cm x {height}cm
      </div>
    </div>
  );
}

export default React.memo(RoofBackgroundNode);
