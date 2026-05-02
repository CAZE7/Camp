import React from 'react';

export default function RoofSolarNode({ data, selected }: any) {
  const width = data.width || 100;
  const height = data.height || 60;
  const watts = data.watts || 100;

  // Scale: 1cm = 2px
  return (
    <div
      className={"bg-slate-800 border-2 border-slate-600 rounded-sm shadow-md flex items-center justify-center relative overflow-hidden group" + (selected ? " ring-4 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]" : "")}
      style={{ width: width * 2, height: height * 2 }}
    >
      {/* Grid lines to look like solar panel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#475569_1px,transparent_1px),linear-gradient(to_bottom,#475569_1px,transparent_1px)] bg-[size:10px_10px] opacity-30 pointer-events-none"></div>

      <div className="font-bold text-xs text-white text-center z-10 px-1 bg-slate-900/60 rounded py-1">
        {data.label || 'Solarpanel'}<br/>
        <span className="text-[10px] text-orange-400">{watts} W</span>
        <br/>
        <span className="text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">{width}x{height}cm</span>
      </div>
    </div>
  );
}
