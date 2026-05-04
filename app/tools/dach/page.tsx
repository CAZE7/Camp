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
      .reduce((acc, n) => {
        // Safe type cast based on node structure
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
    <div className="flex h-[calc(100vh-85px)] w-full relative">
      <div className="w-80 bg-white/90 backdrop-blur-md border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto z-10 shadow-[20px_0_40px_rgb(0,0,0,0.03)] relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-100 pb-4 relative z-10">Komponenten</h2>
        <div className="space-y-4 relative z-10">
          <div
            className="p-4 border-2 border-slate-100 rounded-2xl bg-white cursor-grab hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all shadow-sm font-bold text-slate-700 flex items-center gap-4 group"
            onDragStart={(event) => onDragStart(event, 'roofSolar')}
            draggable
          >
            <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">☀️</div>
            <div className="flex flex-col">
              <span>Solarpanel</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400">Drag & Drop</span>
            </div>
          </div>
          <div
            className="p-4 border-2 border-slate-100 rounded-2xl bg-white cursor-grab hover:border-amber-400 hover:bg-amber-50 hover:shadow-md transition-all shadow-sm font-bold text-slate-700 flex items-center gap-4 group"
            onDragStart={(event) => onDragStart(event, 'roofWindow')}
            draggable
          >
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🪟</div>
            <div className="flex flex-col">
              <span>Dachfenster</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400">Drag & Drop</span>
            </div>
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
          className="bg-slate-100"
        >
          <Background color="#cbd5e1" gap={24} size={2} />
          <Controls className="bg-white border-slate-200 shadow-md rounded-xl overflow-hidden" />

          <Panel position="top-right" className="bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_20px_40px_rgb(0,0,0,0.08)] border border-slate-100 pointer-events-auto mt-6 mr-6 transition-all hover:shadow-[0_20px_50px_rgb(37,99,235,0.1)]">
             <div className="flex flex-col gap-3 min-w-[220px]">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                   <div className="flex items-center gap-2">
                     <span className="text-xl bg-blue-50 text-blue-500 w-8 h-8 rounded-lg flex items-center justify-center">⚡</span>
                     <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Solarleistung</span>
                   </div>
                   <span className="font-black text-2xl text-slate-800">{totalRoofSolarWatts} <span className="text-sm font-bold text-blue-600">W</span></span>
                </div>
                <div className="text-xs font-semibold text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl">
                  Wird <span className="text-blue-600">automatisch</span> in den Elektrik-Planer übernommen.
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
    <div className="flex flex-col min-h-screen bg-[#f1f5f9] font-sans selection:bg-blue-100">
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between z-20 relative sticky top-0">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <span className="bg-gradient-to-br from-sky-400 to-blue-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-xl">🚐</span>
          Dachflächen-Planer
        </h1>
        <p className="text-sm font-semibold text-slate-500 max-w-md text-right bg-slate-50 p-3 rounded-xl border border-slate-100">
          Plane die Anordnung deiner <span className="text-blue-600 font-bold">Solarpanels</span> und <span className="text-amber-600 font-bold">Dachfenster</span> auf dem Fahrzeugdach.
        </p>
      </div>
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <DachPlanerFlow />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
