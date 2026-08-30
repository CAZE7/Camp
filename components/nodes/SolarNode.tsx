"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, DC_TERMINALS } from './handles';

const SolarNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="solar" selected={selected} title={data.label} chip="PV" width={188}>
      <Row label="Spannung" value={data.voltage || 0} unit="V" />
      <Row label="Strom" value={data.amps || 0} unit="A" />
      <ConnectionHandles config={DC_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(SolarNode);
