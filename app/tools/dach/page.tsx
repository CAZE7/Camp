"use client";

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  OnNodesChange,
  applyNodeChanges,
  useNodesState,
  ReactFlowProvider,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import RoofWindowNode from '@/components/nodes/RoofWindowNode';
import RoofSolarNode from '@/components/nodes/RoofSolarNode';
import { useAppStore } from '@/lib/store';

const nodeTypes = {
  roofWindow: RoofWindowNode,
  roofSolar: RoofSolarNode,
};

const initialNodes: Node[] = [
  { id: 'solar-1', type: 'roofSolar', position: { x: 100, y: 100 }, data: { watts: 200 } }
];

function DachPlanerFlow() {
  const [nodes, setNodes] = useNodesState(initialNodes);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { setCalculatedSolarWatts } = useAppStore();

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const totalRoofSolarWatts = useMemo(() => {
    return nodes
      .filter((n) => n.type === 'roofSolar')
      .reduce((acc, n) => {
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
        data: { label: type === 'roofSolar' ? 'Solarpanel' : 'Dachfenster', watts: type === 'roofSolar' ? 200 : undefined },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-[calc(100vh-73px)] w-full relative">
      {/* Sidebar */}
      <div className="w-72 bg-card border-r border-border p-6 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Komponenten</p>
        <div className="space-y-3">
          <Card
            className="cursor-grab hover:ring-2 hover:ring-blue-400 transition-all active:cursor-grabbing"
            onDragStart={(event) => onDragStart(event, 'roofSolar')}
            draggable
          >
            <CardContent className="flex items-center gap-4 py-3">
              <div className="w-10 h-10 bg-sky-50 text-sky-500 rounded-lg flex items-center justify-center text-xl">☀️</div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Solarpanel</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Drag & Drop</span>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-grab hover:ring-2 hover:ring-amber-400 transition-all active:cursor-grabbing"
            onDragStart={(event) => onDragStart(event, 'roofWindow')}
            draggable
          >
            <CardContent className="flex items-center gap-4 py-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center text-xl">🪟</div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Dachfenster</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Drag & Drop</span>
              </div>
            </CardContent>
          </Card>
        </div>
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
        >
          <Background color="hsl(var(--border))" gap={24} size={2} />
          <Controls className="rounded-lg overflow-hidden border border-border shadow-sm" />

          <Panel position="top-right" className="mt-4 mr-4 pointer-events-auto">
            <Card size="sm" className="min-w-[220px] shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg bg-blue-50 text-blue-500 w-7 h-7 rounded-md flex items-center justify-center">⚡</span>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Solarleistung</span>
                  </div>
                  <span className="font-black text-xl">{totalRoofSolarWatts} <span className="text-sm font-bold text-blue-600">W</span></span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground bg-muted p-2.5 rounded-md">
                  Wird <span className="text-blue-600 font-semibold">automatisch</span> in den Elektrik-Planer übernommen.
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
    <div className="flex flex-col min-h-screen bg-background font-sans">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              ← Zurück
            </Button>
          </Link>
          <h1 className="text-xl font-black flex items-center gap-2.5">
            <span className="bg-gradient-to-br from-sky-400 to-blue-500 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-base">🚐</span>
            Dachflächen-Planer
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-sm text-right hidden md:block">
          Plane die Anordnung deiner <span className="text-blue-600 font-semibold">Solarpanels</span> und <span className="text-amber-600 font-semibold">Dachfenster</span>.
        </p>
      </div>

      {/* Flow */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <DachPlanerFlow />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
