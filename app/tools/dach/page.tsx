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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
      .reduce((acc, n) => acc + ((n.data as any)?.watts || 0), 0);
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
    <div className="flex h-[calc(100vh-64px)] w-full">
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto z-10 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Komponenten</h2>
        <div className="space-y-3">
          <div
            className="p-3 border-2 border-gray-300 rounded-lg bg-gray-50 cursor-grab hover:border-blue-500 hover:bg-blue-50 transition-colors shadow-sm text-sm font-semibold text-gray-700 flex items-center gap-2"
            onDragStart={(event) => onDragStart(event, 'roofSolar')}
            draggable
          >
            ☀️ Dach-Solarpanel
          </div>
          <div
            className="p-3 border-2 border-gray-300 rounded-lg bg-gray-50 cursor-grab hover:border-blue-500 hover:bg-blue-50 transition-colors shadow-sm text-sm font-semibold text-gray-700 flex items-center gap-2"
            onDragStart={(event) => onDragStart(event, 'roofWindow')}
            draggable
          >
            🪟 Dachfenster
          </div>
        </div>
      </div>
      <div className="flex-1 relative react-flow-wrapper" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          className="bg-gray-100"
        >
          <Background color="#ccc" gap={20} size={1} />
          <Controls />

          <Panel position="top-right" className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-200 pointer-events-auto mt-4 mr-4">
             <div className="flex flex-col gap-2 min-w-[200px]">
                <div className="flex justify-between items-center pb-2 border-b">
                   <span className="text-sm text-gray-500 font-semibold uppercase">Solarleistung</span>
                   <span className="font-bold text-lg text-blue-600">{totalRoofSolarWatts} W</span>
                </div>
                <div className="text-xs text-gray-500 leading-tight">
                  Wird automatisch in den Elektrik-Planer übernommen.
                </div>
             </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function DachPlanerPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">☀️ Dachflächen-Planer</h1>
        <p className="text-sm text-gray-500 max-w-md text-right">Plane die Anordnung deiner Solarpanels und Dachfenster auf dem Fahrzeugdach.</p>
      </div>
      <div className="flex-1">
        <ReactFlowProvider>
          <DachPlanerFlow />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
