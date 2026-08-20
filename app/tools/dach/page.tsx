"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { vehicleTemplates } from "@/lib/vehicleTemplates";
import { useDachNodes } from "./hooks/useDachNodes";
import { DachPanel } from "./components/DachPanel";
import RoofBackgroundNode from "@/components/nodes/RoofBackgroundNode";
import RoofSolarNode from "@/components/nodes/RoofSolarNode";
import RoofWindowNode from "@/components/nodes/RoofWindowNode";
import { RoofNodeData } from "@/components/nodes/types";

// Outfit wird lokal über @fontsource-variable/outfit gebündelt (offline-fähiger Build).
const outfit = { className: 'font-outfit' };

const nodeTypes = {
  roofBackground: RoofBackgroundNode,
  roofSolar: RoofSolarNode,
  roofWindow: RoofWindowNode,
};

function DachPlanerInner() {
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleTemplates[0].id);
  const selectedVehicle = useMemo(
    () => vehicleTemplates.find((v) => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  const {
    nodes,
    setNodes,
    onNodesChange,
    selectedNode,
    updateSelectedNodeWatts,
    updateSelectedNodeWidth,
    updateSelectedNodeHeight,
    totalRoofSolarWatts,
    onNodeResize,
  } = useDachNodes(selectedVehicle);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = {
        x: Math.max(40, (event.clientX - (bounds?.left || 0)) - 40),
        y: Math.max(40, (event.clientY - (bounds?.top || 0)) - 40),
      };

      const isSolar = type === "roofSolar";
      const widthPx = isSolar ? 200 : 80;
      const heightPx = isSolar ? 120 : 80;
      const newNode: Node<RoofNodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        width: widthPx,
        height: heightPx,
        style: { width: widthPx, height: heightPx },
        data: {
          label: isSolar ? "Solarpanel" : "Dachfenster",
          watts: isSolar ? 200 : undefined,
          width: isSolar ? 100 : 40,
          height: isSolar ? 60 : 40,
          onNodeResize,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [onNodeResize, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 font-sans overflow-hidden">
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-stone-200 bg-white shadow-sm hover:bg-stone-50">
              ← Zurück
            </Button>
          </Link>
          <div className="h-6 w-px bg-stone-200 mx-2" />
          <h1 className={cn("text-xl md:text-2xl font-black flex items-center gap-3 tracking-tight text-stone-800", outfit.className)}>
            <span className="bg-stone-100 border border-stone-200 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm text-xl">☀️</span>
            Dach-Planer <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full ml-2 uppercase tracking-widest font-bold">Pro</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Status</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live Sync Aktiv
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="w-full lg:w-72 bg-card border-r border-border p-6 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
          <div className="space-y-3">
            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Fahrzeug Modell</Label>
            <Select value={selectedVehicleId} onValueChange={(val) => val && setSelectedVehicleId(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicleTemplates.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} {vehicle.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Komponenten</Label>
            <div className="grid grid-cols-1 gap-2">
              <div
                className="cursor-grab border border-border rounded-xl p-3 bg-card hover:border-orange-300 hover:bg-orange-50 transition-all text-sm font-semibold text-stone-700"
                draggable
                onDragStart={(e) => onDragStart(e, "roofSolar")}
              >
                <div>Solarpanel</div>
                <div className="text-xs text-orange-600 font-mono mt-1">200 W</div>
              </div>
              <div
                className="cursor-grab border border-border rounded-xl p-3 bg-card hover:border-blue-300 hover:bg-blue-50 transition-all text-sm font-semibold text-stone-700"
                draggable
                onDragStart={(e) => onDragStart(e, "roofWindow")}
              >
                Dachfenster
              </div>
            </div>
          </div>
        </aside>

        <div
          className="flex-1 relative react-flow-wrapper react-flow-mock min-h-0"
          ref={reactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background />
            <Controls />
            <DachPanel
              selectedNode={selectedNode}
              updateSelectedNodeWatts={updateSelectedNodeWatts}
              updateSelectedNodeWidth={updateSelectedNodeWidth}
              updateSelectedNodeHeight={updateSelectedNodeHeight}
              totalRoofSolarWatts={totalRoofSolarWatts}
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function DachPlanerPage() {
  return (
    <ReactFlowProvider>
      <DachPlanerInner />
    </ReactFlowProvider>
  );
}
