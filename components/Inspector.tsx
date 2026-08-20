"use client";

import React, { useEffect, useState } from "react";
import { Node, Edge } from "reactflow";
import { Button } from "@/components/ui/button";
import { MousePointerClick, Trash2 } from "lucide-react";
import { CableEdgeData } from "./edges/CableEdge";
import { EdgeInspector } from "./inspector/EdgeInspector";
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
} from "./inspector/NodeInspectors";

interface InspectorProps {
  selectedNode?: Node | null;
  selectedEdge?: Edge<CableEdgeData> | null;
  // old names kept for backward-compat
  onDeleteNode?: (nodeId: string) => void;
  onUpdateNode?: (nodeId: string, data: any) => void;

  // planner-specific props (some callers use these names)
  onDelete?: (...args: any[]) => void;
  onUpdateNodeData?: (...args: any[]) => void;
  onChangeLength?: (id: string, length: number) => void;
  onChangeCrossSection?: (id: string, crossSection: number) => void;
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
      Tippe eine Komponente oder Leitung im Plan an – hier erscheinen dann nur
      die passenden Einstellungen dazu.
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
  onUpdateNodeData?: (id: string, data: any) => void;
  nodes?: Node[];
  edges?: Edge[];
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}) {
  switch (node.type) {
    case "battery":
      return (
        <BatteryInspector
          node={node}
          onUpdateNodeData={onUpdateNodeData}
          chargingTimeStr={chargingTimeStr}
          calculatedSolarWatts={calculatedSolarWatts}
        />
      );
    case "consumer":
      return <ConsumerInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "charger":
    case "mpptController":
    case "dcdcCharger":
    case "acBatteryCharger":
      return <ChargerInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "fuse":
      return <FuseInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "shorePower":
      return <ShorePowerInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "inverter":
      return <InverterInspector node={node} onUpdateNodeData={onUpdateNodeData} nodes={nodes} />;
    case "consumer230v":
      return <Consumer230VInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "solar":
      return <SolarInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "roofWindow":
      return <RoofWindowInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "roofSolar":
      return <RoofSolarInspector node={node} onUpdateNodeData={onUpdateNodeData} />;
    case "conduit":
      return <ConduitInspector node={node} onUpdateNodeData={onUpdateNodeData} edges={edges} />;
    default:
      return null;
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
  onUpdate?: (nodeId: string, data: any) => void;
  nodes?: Node[];
  edges?: Edge[];
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}) => {
  const [label, setLabel] = useState(node.data?.label || "");

  useEffect(() => {
    setLabel(node.data?.label || "");
  }, [node]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    if (onUpdate) {
      onUpdate(node.id, { label: newLabel });
    }
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
          className="w-full px-2 py-1 border border-border rounded text-sm"
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
        onClick={() => onDelete(node.id)}
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
      <h2 className="text-lg font-semibold mb-4 pl-10 text-foreground">Details</h2>

      {!hasSelection ? (
        <EmptySelection />
      ) : selectedNode ? (
        <NodeInspector
          node={selectedNode}
          onDelete={(id: string) => {
            if (onDeleteNode) return onDeleteNode(id);
            if (onDelete) return onDelete(id);
          }}
          onUpdate={(id: string, data: any) => {
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
          <EdgeInspector
            edge={selectedEdge}
            onChangeLength={onChangeLength || (() => {})}
            onChangeFuseSize={onChangeFuseSize}
          />
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete()}
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
