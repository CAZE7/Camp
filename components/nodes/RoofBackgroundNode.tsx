"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { RoofNodeData } from './types';

const RoofBackgroundNode = function({ data }: { data: RoofNodeData }) {
  const { width, height, safeMargins } = data;
  
  // Scale: 1cm = 2px. Width/Height are in cm.
  const pxWidth = width * 2;
  const pxHeight = height * 2;
  
  const marginFront = (safeMargins?.front || 15) * 2;
  const marginRear = (safeMargins?.rear || 5) * 2;
  const marginLeft = (safeMargins?.left || 5) * 2;
  const marginRight = (safeMargins?.right || 5) * 2;

  return (
    <div 
      className="bg-slate-200/50 border-[6px] border-slate-400 rounded-[40px] relative pointer-events-none shadow-inner"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Front Indicator (Windshield) */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="w-32 h-8 bg-slate-400 rounded-t-full opacity-40"></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Fahrtrichtung</span>
      </div>

      {/* Safe Zone Boundary */}
      <div 
        className="absolute border-2 border-dashed border-blue-400/40 rounded-[30px] flex items-center justify-center"
        style={{
          top: marginFront,
          bottom: marginRear,
          left: marginLeft,
          right: marginRight
        }}
      >
        <div className="text-blue-400/30 font-black text-2xl uppercase tracking-[0.5em] select-none rotate-90 md:rotate-0">
          Safe Zone
        </div>
      </div>

      {/* Rulers / Grid */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] bg-[size:20px_20px]"></div>
      
      {/* Dimensions Info */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 whitespace-nowrap">
        Nutzbare Dachfläche: {width}cm x {height}cm
      </div>
    </div>
  );
}

export default React.memo(RoofBackgroundNode);
