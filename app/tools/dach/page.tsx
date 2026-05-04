"use client";

import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  NodeChange,
  OnNodesChange,
  applyNodeChanges,
  useNodesState,
  ReactFlowProvider,
  Panel,
  XYPosition,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import RoofWindowNode from '@/components/nodes/RoofWindowNode';
import RoofSolarNode from '@/components/nodes/RoofSolarNode';
import RoofBackgroundNode from '@/components/nodes/RoofBackgroundNode';
import { useAppStore } from '@/lib/store';
import { vehicleTemplates } from '@/lib/vehicleTemplates';

const nodeTypes = {
  roofWindow: RoofWindowNode,
  roofSolar: RoofSolarNode,
  roofBackground: RoofBackgroundNode,
};

const SAFE_MARGINS = {
  front: 15, // cm
  rear: 5,   // cm
  left: 5,   // cm
  right: 5,  // cm
};

function DachPlanerFlow() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleTemplates[0].id);
  const selectedVehicle = useMemo(() => 
    vehicleTemplates.find(v => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  const [nodes, setNodes] = useNodesState([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { setCalculatedSolarWatts } = useAppStore();

  const onNodeResize = useCallback((event: any, { id, width, height }: { id: string, width: number, height: number }) => {
    setNodes((nds: Node[]) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            width,
            height,
            data: {
              ...node.data,
              width: width / 2, // px to cm
              height: height / 2, // px to cm
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const initialNodes: Node[] = useMemo(() => [
    { 
      id: 'background', 
      type: 'roofBackground', 
      position: { x: 0, y: 0 }, 
      draggable: false,
      selectable: false,
      width: selectedVehicle.roofWidth * 200, // m to px (100cm/m * 2px/cm)
      height: selectedVehicle.roofLength * 200,
      data: { 
        width: selectedVehicle.roofWidth * 100, // m to cm
        height: selectedVehicle.roofLength * 100,
        safeMargins: SAFE_MARGINS,
        onNodeResize
      } 
    },
    { 
      id: 'solar-1', 
      type: 'roofSolar', 
      position: { x: 40, y: 100 }, // px (20cm * 2, 50cm * 2)
      width: 200, // px (100cm * 2)
      height: 120, // px (60cm * 2)
      data: { watts: 200, width: 100, height: 60, onNodeResize } 
    }
  ], [selectedVehicle, onNodeResize]);

  // Set initial nodes or reset on vehicle change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const validateNodes = useCallback((nds: Node[]) => {
    const roofW_px = selectedVehicle.roofWidth * 200;
    const roofH_px = selectedVehicle.roofLength * 200;
    
    const safeMinX = SAFE_MARGINS.left * 2;
    const safeMaxX = roofW_px - (SAFE_MARGINS.right * 2);
    const safeMinY = SAFE_MARGINS.front * 2;
    const safeMaxY = roofH_px - (SAFE_MARGINS.rear * 2);

    return nds.map((node: Node) => {
      if (node.id === 'background') return node;

      const nodeW = node.width || (node.type === 'roofSolar' ? 200 : 80);
      const nodeH = node.height || (node.type === 'roofSolar' ? 120 : 80);
      
      const isOutside = 
        node.position.x < safeMinX || 
        node.position.y < safeMinY || 
        (node.position.x + nodeW) > safeMaxX || 
        (node.position.y + nodeH) > safeMaxY;

      if (node.data.isInvalid !== isOutside) {
        return { ...node, data: { ...node.data, isInvalid: isOutside } };
      }
      return node;
    });
  }, [selectedVehicle]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds: Node[]) => {
        const nextNodes = applyNodeChanges(changes, nds);
        return validateNodes(nextNodes);
      });
    },
    [setNodes, validateNodes]
  );


  const totalRoofSolarWatts = useMemo(() => {
    return nodes
      .filter((n: Node) => n.type === 'roofSolar' && !n.data.isInvalid)
      .reduce((acc: number, n: Node) => {
        const data = n.data as { watts?: number } | undefined;
        return acc + (data?.watts || 0);
      }, 0);
  }, [nodes]);

  useEffect(() => {
    setCalculatedSolarWatts(totalRoofSolarWatts);
  }, [totalRoofSolarWatts, setCalculatedSolarWatts]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        width: type === 'roofSolar' ? 200 : 80, // px
        height: type === 'roofSolar' ? 120 : 80, // px
        data: { 
          label: type === 'roofSolar' ? 'Solarpanel' : 'Dachfenster', 
          watts: type === 'roofSolar' ? 200 : undefined,
          width: type === 'roofSolar' ? 100 : 40, // cm
          height: type === 'roofSolar' ? 60 : 40, // cm
          onNodeResize
        },
      };

      setNodes((nds: Node[]) => validateNodes(nds.concat(newNode)));
    },
    [setNodes, validateNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-[calc(100vh-73px)] w-full relative">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border p-6 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
        <div className="space-y-4">
          <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Fahrzeug Modell</Label>
          <Select value={selectedVehicleId} onValueChange={(val: string | null) => val && setSelectedVehicleId(val)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Wähle dein Fahrzeug" />
            </SelectTrigger>
            <SelectContent>
              {vehicleTemplates.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.brand} {v.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Komponenten</p>
          <div className="space-y-3">
            <Card
              className="cursor-grab hover:ring-2 hover:ring-blue-400 transition-all active:cursor-grabbing border-blue-100 bg-blue-50/20"
              onDragStart={(event) => onDragStart(event, 'roofSolar')}
              draggable
            >
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <div className="w-10 h-10 bg-blue-500 text-white rounded-lg flex items-center justify-center text-xl shadow-sm">☀️</div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Solarpanel</span>
                  <span className="text-[10px] uppercase tracking-widest text-blue-600/70 font-bold">Basis: 100x60cm</span>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-grab hover:ring-2 hover:ring-amber-400 transition-all active:cursor-grabbing border-amber-100 bg-amber-50/20"
              onDragStart={(event) => onDragStart(event, 'roofWindow')}
              draggable
            >
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xl shadow-sm">🪟</div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Dachfenster</span>
                  <span className="text-[10px] uppercase tracking-widest text-amber-600/70 font-bold">Basis: 40x40cm</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-auto border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-tighter text-muted-foreground">Hinweis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Die <strong>Safe Zone</strong> berücksichtigt 15cm Front-Abstand und 5cm Seiten-Abstand. Elemente außerhalb werden rot markiert und nicht zur Leistung addiert.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative react-flow-wrapper" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          className="bg-muted/30"
          minZoom={0.1}
          maxZoom={4}
        >
          <Background color="hsl(var(--border))" gap={20} size={1} />
          <Controls className="rounded-lg overflow-hidden border border-border shadow-sm" />

          <Panel position="top-right" className="mt-4 mr-4 pointer-events-auto">
            <Card className="min-w-[240px] shadow-2xl border-none bg-slate-900 text-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-blue-400 font-bold uppercase tracking-[0.2em] text-[10px]">System Check</CardDescription>
                <CardTitle className="flex items-center justify-between text-2xl font-black">
                  <span>Solarleistung</span>
                  <span className="text-orange-400">{totalRoofSolarWatts} W</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all duration-500" 
                    style={{ width: `${Math.min(100, (totalRoofSolarWatts / 1000) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/50 mt-3 font-medium">
                  Daten werden in Echtzeit mit dem Elektrik-Planer synchronisiert.
                </p>
              </CardContent>
            </Card>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function DachPlanerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              ← Zurück
            </Button>
          </Link>
          <div className="h-6 w-px bg-border mx-2" />
          <h1 className="text-xl font-black flex items-center gap-3 tracking-tight">
            <span className="bg-gradient-to-br from-orange-400 to-red-500 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg text-lg">☀️</span>
            Dachflächen-Planer <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2 uppercase tracking-widest">Pro</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Status</span>
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live Sync Aktiv
            </span>
          </div>
        </div>
      </div>

      {/* Flow */}
      <div className="flex-1 relative overflow-hidden">
        <ReactFlowProvider>
          <DachPlanerFlow />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
