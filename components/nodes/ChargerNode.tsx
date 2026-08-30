"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, DC_TERMINALS } from './handles';

const ChargerNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="charger" selected={selected} title={data.label} chip="Laden" width={188}>
      <Row label="Ladeleistung" value={data.amps || 0} unit="A" />
      <Row label="Effizienz" value={data.efficiency ?? 100} unit="%" />
      <ConnectionHandles config={DC_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(ChargerNode);
