"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, DC_TERMINALS } from './handles';

const ConsumerNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="consumer" selected={selected} title={data.label} chip="12V" width={188}>
      <Row label="Leistung" value={data.watts || 0} unit="W" />
      <Row label="Nutzung" value={data.hours || 0} unit="h/Tag" />
      <ConnectionHandles config={DC_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(ConsumerNode);
