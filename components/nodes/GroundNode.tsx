"use client";
import React from 'react';
import { NodeCard } from './NodeCard';
import { ConnectionHandles, GROUND_TERMINALS } from './handles';

const GroundNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="ground" selected={selected} title={data.label} chip="PE" width={152}>
      <span className="planner-node__row">Karosserie / Masse</span>
      <ConnectionHandles config={GROUND_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(GroundNode);
