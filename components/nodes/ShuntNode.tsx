"use client";
import React from 'react';
import { NodeCard } from './NodeCard';
import { ConnectionHandles, DC_TERMINALS } from './handles';

const ShuntNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="shunt" selected={selected} title={data.label} chip="Monitor" width={188}>
      <span className="planner-node__row">Batteriemonitor</span>
      <ConnectionHandles config={DC_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(ShuntNode);
