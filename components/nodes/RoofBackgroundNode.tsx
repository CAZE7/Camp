'use client';
import React from 'react';
import { type RoofNodeData } from './types';

const RoofBackgroundNode = function ({ data }: { data: RoofNodeData }) {
  const { width, height, safeMargins } = data;

  const pxWidth = (width || 0) * 2;
  const pxHeight = (height || 0) * 2;

  const marginFront = (safeMargins?.front || 15) * 2;
  const marginRear = (safeMargins?.rear || 5) * 2;
  const marginLeft = (safeMargins?.left || 5) * 2;
  const marginRight = (safeMargins?.right || 5) * 2;

  return (
    <div
      aria-label={`Dachfläche ${width} mal ${height} Zentimeter`}
      className="bg-paper/40 relative border-2 border-dashed border-copper"
      style={{ width: pxWidth, height: pxHeight, pointerEvents: 'none' }}
    >
      {/* Front Indicator (Windshield) */}
      <div className="absolute -top-12 left-1/2 flex -translate-x-1/2 flex-col items-center">
        <div className="h-8 w-32 rounded-t-full border border-rule bg-bone opacity-70" aria-hidden="true" />
        <span className="label-eyebrow mt-1 text-copper">Fahrtrichtung</span>
      </div>

      {/* Safe Zone Boundary */}
      <div
        className="absolute flex items-center justify-center border-2 border-dashed border-oxide"
        style={{
          top: marginFront,
          bottom: marginRear,
          left: marginLeft,
          right: marginRight,
        }}
      >
        <div className="label-eyebrow rotate-90 select-none text-oxide md:rotate-0">Safe Zone</div>
      </div>

      {/* Dot grid */}
      <div className="roof-dot-grid absolute inset-0 opacity-10" aria-hidden="true" />

      {/* Dimensions Info */}
      <div className="caption-xs absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap font-semibold text-ink">
        Nutzbare Dachfläche: {width}cm x {height}cm
      </div>
    </div>
  );
};

export default React.memo(RoofBackgroundNode);
