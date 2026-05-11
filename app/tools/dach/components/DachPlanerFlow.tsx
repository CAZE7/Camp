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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '@/lib/store';
import { vehicleTemplates } from '@/lib/vehicleTemplates';
import { OnNodeResize, RoofNodeData } from '@/components/nodes/types';
import RoofWindowNode from '@/components/nodes/RoofWindowNode';
import RoofSolarNode from '@/components/nodes/RoofSolarNode';
import RoofBackgroundNode from '@/components/nodes/RoofBackgroundNode';
import { SAFE_MARGINS, validateRoofNodes } from '../validation';
import { DachSidebar } from './DachSidebar';
import { DachPanel } from './DachPanel';

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

  const [nodes, setNodes] = useNodesState<RoofNodeData>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { setCalculatedSolarWatts } = useAppStore();

  const onNodeResize: OnNodeResize = useCallback((event, { id, width, height }) => {
    setNodes((nds: Node<RoofNodeData>[]) =>
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

  const initialNodes: Node<RoofNodeData>[] = useMemo(() => [
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

  const validateNodes = useCallback((nds: Node<RoofNodeData>[]) => {
    return validateRoofNodes(nds, selectedVehicle);
  }, [selectedVehicle]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds: Node<RoofNodeData>[]) => {
        const nextNodes = applyNodeChanges(changes, nds);
        return validateNodes(nextNodes as Node<RoofNodeData>[]);
      });
    },
    [setNodes, validateNodes]
  );


  const selectedSolarNode = useMemo(() => {
    return nodes.find(n => n.selected && n.type === 'roofSolar');
  }, [nodes]);

  const updateSelectedNodeWatts = useCallback((watts: number) => {
    if (!selectedSolarNode) return;
    setNodes((nds: Node<RoofNodeData>[]) =>
      nds.map(node => {
        if (node.id === selectedSolarNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              watts
            }
          };
        }
        return node;
      })
    );
  }, [selectedSolarNode, setNodes]);

  const totalRoofSolarWatts = useMemo(() => {
    let total = 0;
    const len = nodes.length;
    for (let i = 0; i < len; i++) {
      const n = nodes[i];
      if (n.type === 'roofSolar' && !n.data.isInvalid) {
        const data = n.data as { watts?: number } | undefined;
        total += data?.watts || 0;
      }
    }
    return total;
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

      const newNode: Node<RoofNodeData> = {
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

      setNodes((nds: Node<RoofNodeData>[]) => validateNodes(nds.concat(newNode)));
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
            selectedSolarNode={selectedSolarNode}
            updateSelectedNodeWatts={updateSelectedNodeWatts}
            totalRoofSolarWatts={totalRoofSolarWatts}
          />
        </ReactFlow>
      </div>
    </div>
  );
}