"use client";
import React from 'react';
import { NodeCard, Row } from './NodeCard';
import { ConnectionHandles, SINGLE_OUT_230 } from './handles';

const ShorePowerNode = function({ data, isConnectable, selected }: any) {
  return (
    <NodeCard type="shorePower" selected={selected} title={data.label} chip="230V" width={188}>
      <Row label="Eingang" value="230V" />
      <Row label="RCD (30mA)" value={data.hasRcd ? 'Ja' : 'Nein'} />
      <ConnectionHandles config={SINGLE_OUT_230} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(ShorePowerNode);
