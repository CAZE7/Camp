"use client";
import React from 'react';
import { NodeCard } from './NodeCard';
import { ConnectionHandles, SINGLE_IN, SINGLE_OUT } from './handles';

const WaterNode = function({ data, isConnectable, selected, type }: any) {
  return (
    <NodeCard type={type} selected={selected} title={data.label} chip="Wasser" width={188}>
      <span className="planner-node__row">{type ?? 'Wasser-Komponente'}</span>
      <ConnectionHandles config={[...SINGLE_IN, ...SINGLE_OUT]} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(WaterNode);
