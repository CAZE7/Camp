import React from 'react';

export default function RoofWindowNode({ data, selected }: any) {
  const width = data.width || 40;
  const height = data.height || 40;

  // Scale: 1cm = 2px
  return (
    <div
      className={"bg-blue-100/50 backdrop-blur-sm border-2 border-blue-400 rounded-sm shadow-sm flex items-center justify-center relative overflow-hidden" + (selected ? " ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : "")}
      style={{ width: width * 2, height: height * 2 }}
    >
      <div className="absolute inset-2 border border-blue-300/50 rounded-sm pointer-events-none"></div>
      <div className="font-semibold text-xs text-blue-800 text-center drop-shadow-sm px-1">
        {data.label || 'Dachfenster'}<br/>
        <span className="text-[10px] opacity-80">{width}x{height}cm</span>
      </div>
    </div>
  );
}
