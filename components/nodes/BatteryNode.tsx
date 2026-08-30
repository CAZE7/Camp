"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, DC_TERMINALS } from './handles';

const BatteryNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="battery" selected={selected} title={data.label} chip="12V" width={188}>
      <Row label="Kapazität" value={data.capacity || 0} unit="Ah" />
      <Row label="Chemie" value={data.chemistry || 'LiFePO4'} />
      <ConnectionHandles config={DC_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(BatteryNode);
