"use client";

import React, { useEffect, useState } from "react";
import { Node, Edge } from "reactflow";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface InspectorProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  // old names kept for backward-compat
  onDeleteNode?: (nodeId: string) => void;
  onUpdateNode?: (nodeId: string, data: any) => void;

  // planner-specific props (some callers use these names)
  onDelete?: (...args: any[]) => void;
  onUpdateNodeData?: (...args: any[]) => void;
  onChangeLength?: (...args: any[]) => void;
  onChangeCrossSection?: (...args: any[]) => void;

  // data props
  edges?: Edge[];
  nodes?: Node[];
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}

const EmptySelection = () => (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
    <svg
      className="w-12 h-12 mb-2 opacity-50"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.5a2 2 0 00-1 .267M7 21H5a2 2 0 01-2-2v-4a2 2 0 012-2h2.5"
      />
    </svg>
    <p>Wähle ein Element zum Inspizieren</p>
  </div>
);

const NodeInspector = ({
  node,
  onDelete,
  onUpdate,
}: {
  node: Node;
  onDelete: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs font-medium text-blue-900 mb-1">Node ID:</p>
        <p className="text-xs text-blue-700 font-mono">{node.id}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={handleLabelChange}
          className="w-full px-2 py-1 border border-border rounded text-sm"
          placeholder="Node label"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Position
        </label>
        <p className="text-xs text-muted-foreground font-mono">
          X: {node.position.x.toFixed(1)}, Y: {node.position.y.toFixed(1)}
        </p>
      </div>

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

const EdgeInspector = ({ edge }: { edge: Edge }) => (
  <div className="space-y-4">
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <p className="text-xs font-medium text-green-900 mb-1">Edge ID:</p>
      <p className="text-xs text-green-700 font-mono">{edge.id}</p>
    </div>

    <div>
      <label className="block text-xs font-medium text-foreground mb-1">
        Von Node
      </label>
      <p className="text-xs text-muted-foreground font-mono">{edge.source}</p>
    </div>

    <div>
      <label className="block text-xs font-medium text-foreground mb-1">
        Zu Node
      </label>
      <p className="text-xs text-muted-foreground font-mono">{edge.target}</p>
    </div>
  </div>
);

export default function Inspector({
  selectedNode,
  selectedEdge,
  onDeleteNode,
  onUpdateNode,
  // planner aliases
  onDelete,
  onUpdateNodeData,
}: InspectorProps) {
  const hasSelection = selectedNode || selectedEdge;

  return (
    <div className="relative h-full w-full bg-card p-4 flex flex-col text-foreground overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 pl-10 text-gray-800">Inspector</h2>

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
        />
      ) : selectedEdge ? (
        <EdgeInspector edge={selectedEdge} />
      ) : null}
    </div>
  );
}
