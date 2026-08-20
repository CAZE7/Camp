"use client";

import React, { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import { DachSidebar } from "./DachSidebar";
import Inspector from "@/components/Inspector";
import { DachNode } from "@/components/DachNode";
import { initialNodes, initialEdges } from "../data/initialData";

const nodeTypes = {
  dachNode: DachNode,
};

export function DachPlanerFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("vehicle-001");
  const [activeTab, setActiveTab] = useState<"sidebar" | "canvas" | "inspector">("sidebar");

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      setSelectedEdge(null);
    },
    []
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge);
      setSelectedNode(null);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleAddNode = useCallback(
    (nodeType: string) => {
      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: "dachNode",
        data: { label: nodeType },
        position: { x: 250, y: 250 },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
    },
    [setNodes]
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-73px)] w-full relative planner-mobile-container">
      {/* Sidebar */}
      <div className={`lg:flex h-full ${activeTab === 'sidebar' ? 'block' : 'hidden lg:block'} flex-1 lg:flex-none`}>
        <DachSidebar
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
          onAddNode={handleAddNode}
        />
      </div>

      {/* Canvas */}
      <div className={`lg:flex flex-1 relative react-flow-wrapper flex-col h-full ${activeTab === 'canvas' ? 'flex' : 'hidden lg:flex'}`} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Inspector Panel */}
      <div className={`lg:flex flex-1 lg:flex-none lg:w-[250px] h-full ${activeTab === 'inspector' ? 'flex' : 'hidden lg:flex'} flex-col`}>
        <Inspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onDeleteNode={handleDeleteNode}
          onUpdateNode={handleUpdateNode}
        />
      </div>

      {/* Tablet & Mobile Bottom Navigation Bar */}
      <div className="lg:hidden flex flex-row items-center justify-around bg-card border-t border-border p-2 z-50 shrink-0">
        <button
          onClick={() => setActiveTab('sidebar')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${
            activeTab === 'sidebar'
              ? 'text-blue-600 bg-blue-50'
              : 'text-muted-foreground hover:bg-stone-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-xs mt-1">Sidebar</span>
        </button>

        <button
          onClick={() => setActiveTab('canvas')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${
            activeTab === 'canvas'
              ? 'text-blue-600 bg-blue-50'
              : 'text-muted-foreground hover:bg-stone-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-xs mt-1">Canvas</span>
        </button>

        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-lg p-2 transition-colors ${
            activeTab === 'inspector'
              ? 'text-blue-600 bg-blue-50'
              : 'text-muted-foreground hover:bg-stone-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs mt-1">Inspector</span>
        </button>
      </div>
    </div>
  );
}
