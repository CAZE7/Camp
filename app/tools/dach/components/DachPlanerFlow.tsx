"use client";

import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { vehicleTemplates } from '@/lib/vehicleTemplates';
import { RoofNodeData } from '@/components/nodes/types';
import RoofWindowNode from '@/components/nodes/RoofWindowNode';
import RoofSolarNode from '@/components/nodes/RoofSolarNode';
import RoofBackgroundNode from '@/components/nodes/RoofBackgroundNode';
import { DachSidebar } from './DachSidebar';
import { DachPanel } from './DachPanel';
import { useDachNodes } from '../hooks/useDachNodes';
import { ListPlus, LayoutTemplate } from 'lucide-react';

const nodeTypes = {
  roofWindow: RoofWindowNode,
  roofSolar: RoofSolarNode,
  roofBackground: RoofBackgroundNode,
};

export function DachPlanerFlow() {
  const [activeTab, setActiveTab] = useState<'sidebar' | 'canvas'>('canvas');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleTemplates[0].id);
  const selectedVehicle = useMemo(() =>
    vehicleTemplates.find(v => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const {
    nodes,
    setNodes,
    onNodesChange,
    selectedNode,
    updateSelectedNodeWatts,
    updateSelectedNodeWidth,
    updateSelectedNodeHeight,
    totalRoofSolarWatts,
    validateNodes,
    onNodeResize
  } = useDachNodes(selectedVehicle);

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

      const newNode: Node<RoofNodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        width: type === 'roofSolar' ? 200 : 80, // px
        height: type === 'roofSolar' ? 120 : 80, // px
        style: {
          width: type === 'roofSolar' ? 200 : 80,
          height: type === 'roofSolar' ? 120 : 80,
        },
        data: {
          label: type === 'roofSolar' ? 'Solarpanel' : 'Dachfenster',
          watts: type === 'roofSolar' ? 200 : undefined,
          width: type === 'roofSolar' ? 100 : 40, // cm
          height: type === 'roofSolar' ? 60 : 40, // cm
          onNodeResize
        },
      };

      setNodes((nds: Node<RoofNodeData>[]) => validateNodes(nds.concat(newNode)));
    },
    [setNodes, validateNodes, onNodeResize]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleMobileAdd = (nodeType: string) => {
    const newNode: Node<RoofNodeData> = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position: { x: window.innerWidth / 2 - 40, y: window.innerHeight / 2 - 40 },
      width: nodeType === 'roofSolar' ? 200 : 80, // px
      height: nodeType === 'roofSolar' ? 120 : 80, // px
      style: {
        width: nodeType === 'roofSolar' ? 200 : 80,
        height: nodeType === 'roofSolar' ? 120 : 80,
      },
      data: {
        label: nodeType === 'roofSolar' ? 'Solarpanel' : 'Dachfenster',
        watts: nodeType === 'roofSolar' ? 200 : undefined,
        width: nodeType === 'roofSolar' ? 100 : 40, // cm
        height: nodeType === 'roofSolar' ? 60 : 40, // cm
        onNodeResize
      },
    };

    setNodes((nds: Node<RoofNodeData>[]) => validateNodes(nds.concat(newNode)));
    setActiveTab('canvas');
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-73px)] w-full relative planner-mobile-container">
      {/* Sidebar */}
      <div className={`md:flex h-full ${activeTab === 'sidebar' ? 'block' : 'hidden md:block'} flex-1 md:flex-none`}>
        <DachSidebar
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
          onDragStart={onDragStart}
          onMobileAdd={handleMobileAdd}
        />
      </div>

      {/* Canvas */}
      <div className={`md:flex flex-1 relative react-flow-wrapper flex-col h-full ${activeTab === 'canvas' ? 'flex' : 'hidden md:flex'}`} ref={reactFlowWrapper}>
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

          <DachPanel
            selectedNode={selectedNode}
            updateSelectedNodeWatts={updateSelectedNodeWatts}
            updateSelectedNodeWidth={updateSelectedNodeWidth}
            updateSelectedNodeHeight={updateSelectedNodeHeight}
            totalRoofSolarWatts={totalRoofSolarWatts}
          />
        </ReactFlow>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex flex-row items-center justify-around bg-card border-t border-border p-2 z-50 shrink-0">
        <button
          onClick={() => setActiveTab('sidebar')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${activeTab === 'sidebar' ? 'text-blue-600 bg-blue-50' : 'text-muted-foreground hover:bg-stone-100'}`}
          aria-label="Bauteile"
        >
          <ListPlus size={24} />
          <span className="text-[10px] font-semibold mt-1">Bauteile</span>
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${activeTab === 'canvas' ? 'text-blue-600 bg-blue-50' : 'text-muted-foreground hover:bg-stone-100'}`}
          aria-label="Plan"
        >
          <LayoutTemplate size={24} />
          <span className="text-[10px] font-semibold mt-1">Plan</span>
        </button>
      </div>
    </div>
  );
}