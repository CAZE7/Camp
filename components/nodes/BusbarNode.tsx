"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, DC_TERMINALS } from './handles';

const BusbarNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="busbar" selected={selected} title={data.label} chip="Haupt" width={188}>
      <Row label="Max. Strom" value={data.rating || 250} unit="A" />
      <ConnectionHandles config={DC_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(BusbarNode);
