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

const nodeTypes = {
  roofWindow: RoofWindowNode,
  roofSolar: RoofSolarNode,
  roofBackground: RoofBackgroundNode,
};

export function DachPlanerFlow() {
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

  return (
    <div className="flex h-[calc(100vh-73px)] w-full relative">
      {/* Sidebar */}
      <DachSidebar
        selectedVehicleId={selectedVehicleId}
        setSelectedVehicleId={setSelectedVehicleId}
        onDragStart={onDragStart}
      />

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
  );
}