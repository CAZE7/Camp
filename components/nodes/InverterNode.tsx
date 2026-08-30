"use client";
import React, { useMemo } from 'react';
import { useNodes } from 'reactflow';
import { CommonNodeData } from './types';
import { NodeCard, Row, NodeError } from './NodeCard';
import { ConnectionHandles, DC_INPUT, SINGLE_OUT_230 } from './handles';

const InverterNode = function({ id, data, isConnectable, selected }: any) {
  const nodes = useNodes<CommonNodeData>();

  const overloadStats = useMemo(() => {
    const concurrentDevices = data.concurrentDevices || [];
    const continuousPower = data.continuousPower || 0;

    let totalWatts = 0;
    nodes.forEach((n) => {
      if (n.type === 'consumer230v' && concurrentDevices.includes(n.id)) {
        totalWatts += n.data?.watts || 0;
      }
    });

    return {
      isOverloaded: continuousPower > 0 && totalWatts > continuousPower,
      totalWatts,
      continuousPower,
    };
  }, [nodes, data.concurrentDevices, data.continuousPower]);

  return (
    <NodeCard type="inverter" selected={selected} title={data.label} chip="230V" width={188}>
      <Row label="Wandlung" value="12V → 230V" />
      <Row label="Effizienz" value="85%" />
      {overloadStats.continuousPower > 0 && (
        <Row label="Leistung" value={overloadStats.continuousPower} unit="W" />
      )}
      {overloadStats.isOverloaded && (
        <NodeError>
          Überlastung! Wechselrichter zu schwach für angeschlossene AC-Geräte.
        </NodeError>
      )}
      <ConnectionHandles config={[...DC_INPUT, ...SINGLE_OUT_230]} isConnectable={isConnectable} />
    </NodeCard>
  );
};
export default React.memo(InverterNode);
