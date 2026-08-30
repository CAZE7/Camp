"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, DC_TERMINALS } from './handles';

const FuseNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="fuse" selected={selected} title={data.label} chip="Sicherung" width={188}>
      <Row label="Absicherung" value={data.rating || 0} unit="A" />
      <ConnectionHandles config={DC_TERMINALS} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(FuseNode);
