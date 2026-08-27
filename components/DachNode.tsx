"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";

export function DachNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-[180px] rounded-2xl border border-rule bg-bone p-3 shadow-sm transition-shadow ${
      selected ? "border-ink shadow-lg ring-2 ring-ink/20" : ""
    }`}>
      <div className="text-sm font-semibold text-ink">{data?.label || "Dach-Element"}</div>
      <div className="caption-xs mt-1 text-ink-soft">Dach-Komponente</div>
      <Handle type="target" position={Position.Top} id="a" className="!bg-ink" />
      <Handle type="source" position={Position.Bottom} id="b" className="!bg-ink" />
    </div>
  );
}
