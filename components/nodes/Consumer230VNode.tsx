"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, SINGLE_IN_230 } from './handles';

const Consumer230VNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="consumer230v" selected={selected} title={data.label} chip="230V" width={188}>
      <Row label="Leistung" value={data.watts || 0} unit="W" />
      <Row label="Nutzung" value={data.hours || 0} unit="h/Tag" />
      <ConnectionHandles config={SINGLE_IN_230} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(Consumer230VNode);
