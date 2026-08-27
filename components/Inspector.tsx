'use client';

import React, { useEffect, useState } from 'react';
import { Node, Edge } from 'reactflow';
import { Button } from '@/components/ui/button';
import { MousePointerClick, Trash2 } from 'lucide-react';
import { CableEdgeData } from './edges/CableEdge';
import { EdgeInspector } from './inspector/EdgeInspector';
import {
  BatteryInspector,
  ChargerInspector,
  ConduitInspector,
  Consumer230VInspector,
  ConsumerInspector,
  FuseInspector,
  InverterInspector,
  RoofSolarInspector,
  RoofWindowInspector,
  ShorePowerInspector,
  SolarInspector,
  ComponentInfoInspector,
} from './inspector/NodeInspectors';
import { WaterPipeInspector } from './inspector/WaterPipeInspector';
import { NodeDataPatch, PlannerNodeType, TypedNode } from './nodes/types';

/**
 * React Flow liefert Nodes lose (`data: Record<string, any>`). Der Switch auf
 * `node.type` garantiert das Typ-Literal; diese einzige Engstelle schneidet
 * die diskriminierte Registry-Form (`TypedNode<K>`) heraus — alle Inspektoren
 * arbeiten danach datengetypisch statt mit `any`.
 */
function typedAs<K extends PlannerNodeType>(node: Node, _type: K): TypedNode<K> {
  return node as unknown as TypedNode<K>;
}

interface InspectorProps {
  selectedNode?: Node | null;
  selectedEdge?: Edge<CableEdgeData> | null;
  // old names kept for backward-compat
  onDeleteNode?: (nodeId: string) => void;
  onUpdateNode?: (nodeId: string, data: NodeDataPatch) => void;

  // planner-specific props (some callers use these names)
  onDelete?: (nodeId?: string) => void;
  onUpdateNodeData?: (nodeId: string, data: NodeDataPatch) => void;
  onChangeLength?: (id: string, length: number) => void;
  onChangeFuseSize?: (id: string, fuseSize: number) => void;

  // data props
  edges?: Edge[];
  nodes?: Node[];
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}

const EmptySelection = () => (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
      <MousePointerClick className="w-7 h-7 text-primary opacity-70" />
    </div>
    <p className="font-semibold text-foreground">Kein Element ausgewählt</p>
    <p className="text-xs mt-2 text-center px-4 leading-relaxed">
      Tippe eine Komponente oder Leitung im Plan an – hier erscheinen dann nur die passenden Einstellungen
      dazu.
    </p>
    <div className="mt-4 text-xs text-left px-5 space-y-1.5">
      <p className="font-semibold text-foreground">So gehst du vor:</p>
      <p>1. Bauteil aus der linken Leiste ziehen</p>
      <p>2. Bauteile verbinden</p>
      <p>3. Hier Werte wie Kapazität oder Länge anpassen</p>
    </div>
  </div>
);

function TypeSpecificInspector({
  node,
  onUpdateNodeData,
  nodes,
  edges,
  chargingTimeStr,
  calculatedSolarWatts,
}: {
  node: Node;
  onUpdateNodeData?: (id: string, patch: NodeDataPatch) => void;
  nodes?: Node[];
  edges?: Edge[];
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}) {
  switch (node.type) {
    case 'battery':
      return (
        <BatteryInspector
          node={typedAs(node, 'battery')}
          onUpdateNodeData={onUpdateNodeData}
          chargingTimeStr={chargingTimeStr}
          calculatedSolarWatts={calculatedSolarWatts}
        />
      );
    case 'consumer':
      return <ConsumerInspector node={typedAs(node, 'consumer')} onUpdateNodeData={onUpdateNodeData} />;
    case 'charger':
    case 'mpptController':
    case 'dcdcCharger':
    case 'acBatteryCharger':
      return <ChargerInspector node={typedAs(node, 'charger')} onUpdateNodeData={onUpdateNodeData} />;
    case 'fuse':
      return <FuseInspector node={typedAs(node, 'fuse')} onUpdateNodeData={onUpdateNodeData} />;
    case 'shorePower':
      return <ShorePowerInspector node={typedAs(node, 'shorePower')} onUpdateNodeData={onUpdateNodeData} />;
    case 'inverter':
      return (
        <InverterInspector
          node={typedAs(node, 'inverter')}
          onUpdateNodeData={onUpdateNodeData}
          nodes={nodes}
        />
      );
    case 'consumer230v':
      return (
        <Consumer230VInspector node={typedAs(node, 'consumer230v')} onUpdateNodeData={onUpdateNodeData} />
      );
    case 'solar':
      return <SolarInspector node={typedAs(node, 'solar')} onUpdateNodeData={onUpdateNodeData} />;
    case 'roofWindow':
      return <RoofWindowInspector node={typedAs(node, 'roofWindow')} onUpdateNodeData={onUpdateNodeData} />;
    case 'roofSolar':
      return <RoofSolarInspector node={typedAs(node, 'roofSolar')} onUpdateNodeData={onUpdateNodeData} />;
    case 'conduit':
      return (
        <ConduitInspector node={typedAs(node, 'conduit')} onUpdateNodeData={onUpdateNodeData} edges={edges} />
      );
    case 'busbar':
    case 'shunt':
    case 'ground':
    case 'freshWaterTank':
    case 'grayWaterTank':
    case 'pump':
    case 'accumulator':
    case 'preFilter':
    case 'sink':
    case 'shower':
      return <ComponentInfoInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    default:
      return <ComponentInfoInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
  }
}

const NodeInspector = ({
  node,
  onDelete,
  onUpdate,
  nodes,
  edges,
  chargingTimeStr,
  calculatedSolarWatts,
}: {
  node: Node;
  onDelete: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: NodeDataPatch) => void;
  nodes?: Node[];
  edges?: Edge[];
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}) => {
  const [label, setLabel] = useState(node.data?.label || '');

  useEffect(() => {
    setLabel(node.data?.label || '');
  }, [node]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
  const commitLabel = () => {
    if (onUpdate && label !== (node.data?.label || '')) onUpdate(node.id, { label });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1" htmlFor={`${node.id}-label`}>
          Bezeichnung
        </label>
        <input
          id={`${node.id}-label`}
          type="text"
          value={label}
          onChange={handleLabelChange}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="min-h-11 w-full rounded border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Bezeichnung"
        />
      </div>

      <TypeSpecificInspector
        node={node}
        onUpdateNodeData={onUpdate}
        nodes={nodes}
        edges={edges}
        chargingTimeStr={chargingTimeStr}
        calculatedSolarWatts={calculatedSolarWatts}
      />

      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          if (
            window.confirm(
              `„${node.data?.label || node.type || 'Komponente'}“ wirklich löschen? Du kannst die Aktion anschließend rückgängig machen.`
            )
          )
            onDelete(node.id);
        }}
        className="w-full gap-2"
      >
        <Trash2 size={16} />
        Löschen
      </Button>
    </div>
  );
};

export default function Inspector({
  selectedNode,
  selectedEdge,
  onDeleteNode,
  onUpdateNode,
  onDelete,
  onUpdateNodeData,
  onChangeLength,
  onChangeFuseSize,
  edges,
  nodes,
  chargingTimeStr,
  calculatedSolarWatts,
}: InspectorProps) {
  const hasSelection = selectedNode || selectedEdge;

  return (
    <div className="relative h-full w-full bg-card p-4 flex flex-col text-foreground overflow-y-auto">
      <h2 className="text-base font-black mb-4 text-foreground">Details</h2>

      {!hasSelection ? (
        <EmptySelection />
      ) : selectedNode ? (
        <NodeInspector
          node={selectedNode}
          onDelete={(id: string) => {
            if (onDeleteNode) return onDeleteNode(id);
            if (onDelete) return onDelete(id);
          }}
          onUpdate={(id: string, data: NodeDataPatch) => {
            if (onUpdateNode) return onUpdateNode(id, data);
            if (onUpdateNodeData) return onUpdateNodeData(id, data);
          }}
          nodes={nodes}
          edges={edges}
          chargingTimeStr={chargingTimeStr}
          calculatedSolarWatts={calculatedSolarWatts}
        />
      ) : selectedEdge ? (
        <div className="space-y-4">
          {selectedEdge.type === 'waterPipe' ? (
            <WaterPipeInspector edge={selectedEdge} onChangeLength={onChangeLength || (() => {})} />
          ) : (
            <EdgeInspector
              edge={selectedEdge}
              onChangeLength={onChangeLength || (() => {})}
              onChangeFuseSize={onChangeFuseSize}
            />
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    'Diese Leitung wirklich löschen? Du kannst die Aktion anschließend rückgängig machen.'
                  )
                )
                  onDelete();
              }}
              className="w-full gap-2"
            >
              <Trash2 size={16} />
              Löschen
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
