"use client";

import React, { useCallback, useMemo, useState } from 'react';

import { useDashboardMetrics } from './planner/hooks/useDashboardMetrics';
import { useAutoWire } from './planner/hooks/useAutoWire';
import { DashboardPanel } from './planner/ui/DashboardPanel';
import { BOMModal } from './planner/ui/BOMModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Edge,
  Node,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
  ReactFlowProvider,
  OnSelectionChangeParams,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import WaterNode from './nodes/WaterNode';
import WaterPipeEdge from './edges/WaterPipeEdge';
import Inspector from './Inspector';
import Sidebar from './Sidebar';
import { useAppStore } from '../lib/store';
import { toPng } from 'html-to-image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { NODE_TYPES, EDGE_TYPES, initialNodes, initialEdges } from './planner/constants';
import { CableEdgeData } from './edges/CableEdge';

import { getLayoutedElements } from './planner/utils/layout';

function PlannerInner() {
  const [viewMode, setViewMode] = useState<'electric' | 'water'>('electric');
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge<CableEdgeData>[]>(initialEdges);
  const [waterNodes, setWaterNodes] = useState<Node[]>([]);
  const [waterEdges, setWaterEdges] = useState<Edge[]>([]);
  const [waterWarning, setWaterWarning] = useState<string | null>(null);
  const [firstTappedHandle, setFirstTappedHandle] = useState<{ nodeId: string, handleId: string, handleType: string } | null>(null);

  const [season, setSeason] = useState<'summer' | 'winter'>('summer');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const { isProMode, toggleProMode, calculatedSolarWatts } = useAppStore();

  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);

  // We map selected edges backwards for Inspector.tsx (which currently expects a single selected edge)
  const selectedEdgeId = selectedEdges.length > 0 ? selectedEdges[0].id : null;
  const selectedNodeId = selectedNodes.length > 0 ? selectedNodes[0].id : null;

  const { screenToFlowPosition, fitView } = useReactFlow();

  const edgeTypes = useMemo(() => ({ ...EDGE_TYPES, waterPipe: WaterPipeEdge }), []);
  const nodeTypes = useMemo(() => ({
    ...NODE_TYPES,
    freshWaterTank: WaterNode,
    grayWaterTank: WaterNode,
    pump: WaterNode,
    accumulator: WaterNode,
    preFilter: WaterNode,
    sink: WaterNode,
    shower: WaterNode
  }), []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds) as Edge<CableEdgeData>[]);
    },
    []
  );



  const onWaterNodesChange: OnNodesChange = useCallback(
    (changes) => setWaterNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onWaterEdgesChange: OnEdgesChange = useCallback(
    (changes) => setWaterEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const allNodes = [...nodes, ...waterNodes];
      const sourceNode = allNodes.find((n) => n.id === connection.source);
      const targetNode = allNodes.find((n) => n.id === connection.target);

      if (viewMode === 'water') {
        if (sourceNode?.type === 'grayWaterTank' && targetNode?.type === 'sink') {
          return false;
        }
        return true;
      }

      // Pre-check for polarity matching
      const sHandle = connection.sourceHandle || '';
      const tHandle = connection.targetHandle || '';

      const sIsPlus = sHandle.includes('plus');
      const tIsPlus = tHandle.includes('plus');
      const sIsMinus = sHandle.includes('minus');
      const tIsMinus = tHandle.includes('minus');

      // Exception for series connection between batteries or solars
      const isSeriesException =
        (sourceNode?.type === 'battery' && targetNode?.type === 'battery') ||
        (sourceNode?.type === 'solar' && targetNode?.type === 'solar');

      if (!isSeriesException) {
        if ((sIsPlus && tIsMinus) || (sIsMinus && tIsPlus)) {
          return false; // Polarity mismatch
        }
      }

      // Check for cycles
      const target = nodes.find((node) => node.id === connection.target);

      const outgoersMap = new Map<string, Node[]>();
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      for (const edge of edges) {
        if (!outgoersMap.has(edge.source)) {
          outgoersMap.set(edge.source, []);
        }
        const tNode = nodeMap.get(edge.target);
        if (tNode) outgoersMap.get(edge.source)!.push(tNode);
      }

      const hasCycle = (node: Node, visited = new Set()) => {
        if (visited.has(node.id)) return false;

        visited.add(node.id);

        const outgoers = outgoersMap.get(node.id) || [];
        for (const outgoer of outgoers) {
          if (outgoer.id === connection.source) return true;
          if (hasCycle(outgoer, visited)) return true;
        }
        return false;
      };

      if (target?.id === connection.source) return false;
      if (target) return !hasCycle(target);

      return true;
    },
    [nodes, edges]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;

      if (viewMode === 'water') {
        const allNodes = [...waterNodes];
        const sourceNode = allNodes.find((n) => n.id === connection.source);
        const targetNode = allNodes.find((n) => n.id === connection.target);

        if (sourceNode?.type === 'pump' && targetNode?.type === 'sink') {
          setWaterWarning("Ein Accumulator schont die Pumpe und verhindert stotternden Wasserfluss.");
          setTimeout(() => setWaterWarning(null), 5000);
        }

        const newEdge: Edge = {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          id: `ew-${connection.source}-${connection.target}-${Date.now()}`,
          type: 'waterPipe',
          data: {}
        };
        setWaterEdges((eds) => addEdge(newEdge, eds));
        return;
      }

      const newEdge: Edge<CableEdgeData> = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        type: 'cableEdge',
        data: {
          length: 3,
          crossSection: 2.5,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds) as Edge<CableEdgeData>[]);
    },
    []
  );

    // Sequential Tap Connect Logic
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const handleEl = target.closest('.react-flow__handle');
      if (handleEl) {
        const nodeId = handleEl.getAttribute('data-nodeid');
        const handleId = handleEl.getAttribute('data-handleid');
        const handleType = handleEl.classList.contains('source') ? 'source' : 'target';

        if (nodeId && handleId) {
          setFirstTappedHandle((prev) => {
            if (!prev) {
               // First tap
               return { nodeId, handleId, handleType };
            } else {
               // Second tap
               if (prev.nodeId === nodeId && prev.handleId === handleId) {
                  return null; // Cancel if same handle tapped twice
               }

               // Attempt connection
               const connection = {
                 source: prev.handleType === 'source' ? prev.nodeId : nodeId,
                 target: prev.handleType === 'target' ? prev.nodeId : nodeId,
                 sourceHandle: prev.handleType === 'source' ? prev.handleId : handleId,
                 targetHandle: prev.handleType === 'target' ? prev.handleId : handleId,
               };

               if (isValidConnection(connection as Connection)) {
                 onConnect(connection as Connection);
               }

               return null; // Reset after attempt
            }
          });
        }
      } else {
        // Clicked somewhere else, reset tap connect
        setFirstTappedHandle(null);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [isValidConnection, onConnect]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes);
    setSelectedEdges(params.edges);
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedNodes.length > 0) {
      const nodeIdsSet = new Set(selectedNodes.map(n => n.id));
      setNodes((nds) => nds.filter((n) => !nodeIdsSet.has(n.id)));
      // Also delete connected edges
      setEdges((eds) => eds.filter((e) => !nodeIdsSet.has(e.source) && !nodeIdsSet.has(e.target)));
      setSelectedNodes([]);
    }
    if (selectedEdges.length > 0) {
      const edgeIdsSet = new Set(selectedEdges.map(e => e.id));
      setEdges((eds) => eds.filter((e) => !edgeIdsSet.has(e.id)));
      setSelectedEdges([]);
    }
  }, [selectedNodes, selectedEdges]);

  const updateNodeData = useCallback((id: string, data: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, ...data } };
        }
        return n;
      })
    );
  }, []);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      'LR'
    );
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        fitView({ duration: 800 });
      });
    }
  }, [nodes, edges, fitView]);

  const autoWireSystem = useAutoWire(nodes, setNodes, edges, setEdges, fitView);


  const handleChangeLength = useCallback((id: string, length: number) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          return { ...e, data: { ...e.data!, length } };
        }
        return e;
      })
    );
  }, []);

  const onExportImage = useCallback(() => {
    const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowWrapper) return;

    // We optionally use the view pane inside react flow so we capture only the canvas
    toPng(reactFlowWrapper, {
      filter: (node) => {
        // Exclude the controls and panels if desired, or exclude HTML components that cause issues.
        // For now, keep everything as requested.
        if (
          node?.classList?.contains('react-flow__panel') ||
          node?.classList?.contains('react-flow__controls') ||
          node?.classList?.contains('react-flow__minimap')
        ) {
          return false;
        }
        return true;
      },
    }).then((dataUrl) => {
      const link = document.createElement('a');
      link.download = 'schaltplan.png';
      link.href = dataUrl;
      link.click();
    }).catch((err) => {
      console.error('Failed to export image', err);
    });
  }, []);

  const handleChangeCrossSection = useCallback((id: string, crossSection: number) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          return { ...e, data: { ...e.data!, crossSection } };
        }
        return e;
      })
    );
  }, []);

  const selectedEdge = useMemo(() => {
    return edges.find((e) => e.id === selectedEdgeId) || null;
  }, [edges, selectedEdgeId]);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const [showBOM, setShowBOM] = useState(false);

  const generateBOM = useCallback(() => {
    const counts: Record<string, number> = {};
    nodes.forEach(n => {
      counts[n.type!] = (counts[n.type!] || 0) + 1;
    });

    const cableLengths: Record<string, number> = {};
    edges.forEach(e => {
      const cs = e.data?.crossSection || 2.5;
      cableLengths[cs] = (cableLengths[cs] || 0) + (e.data?.length || 3);
    });

    return { counts, cableLengths };
  }, [nodes, edges]);

  const exportBOM = useCallback(() => {
    const bom = generateBOM();

    // Dispatch a custom event to notify the Chat component if needed
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('export-bom', { detail: bom });
      window.dispatchEvent(event);
    }

    // Show BOM Modal
    setShowBOM(true);
  }, [generateBOM]);

  const checkSchematic = useCallback(() => {
    const schematic = { nodes, edges };
    const event = new CustomEvent('check-schematic', { detail: schematic });
    window.dispatchEvent(event);
  }, [nodes, edges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: label },
      };

      if (type === 'battery') {
        newNode.data = { ...newNode.data, capacity: 100, chemistry: 'LiFePO4' };
      } else if (type === 'consumer') {
        newNode.data = { ...newNode.data, watts: 50, hours: 2 };
      } else if (type === 'charger') {
        newNode.data = { ...newNode.data, amps: 10 };
      } else if (type === 'fuse') {
        newNode.data = { ...newNode.data, rating: 30 };
      } else if (type === 'shorePower') {
        newNode.data = { ...newNode.data, hasRcd: false };
      } else if (type === 'consumer230v') {
        newNode.data = { ...newNode.data, watts: 1000, hours: 0.5 };
      } else if (type === 'solar') {
        newNode.data = { ...newNode.data, voltage: 18, amps: 5 };
      }

      if (viewMode === 'water') {
        setWaterNodes((nds) => nds.concat(newNode));
      } else {
        setNodes((nds) => nds.concat(newNode));
      }
    },
    [screenToFlowPosition, viewMode]
  );

  React.useEffect(() => {
    const handleCustomDrop = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { clientX, clientY, type, label } = customEvent.detail;

      const position = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: label },
      };

      if (type === 'battery') {
        newNode.data = { ...newNode.data, capacity: 100, chemistry: 'LiFePO4' };
      } else if (type === 'consumer') {
        newNode.data = { ...newNode.data, watts: 50, hours: 2 };
      } else if (type === 'charger') {
        newNode.data = { ...newNode.data, amps: 10 };
      } else if (type === 'fuse') {
        newNode.data = { ...newNode.data, rating: 30 };
      } else if (type === 'shorePower') {
        newNode.data = { ...newNode.data, hasRcd: false };
      } else if (type === 'consumer230v') {
        newNode.data = { ...newNode.data, watts: 1000, hours: 0.5 };
      } else if (type === 'solar') {
        newNode.data = { ...newNode.data, voltage: 18, amps: 5 };
      }

      if (viewMode === 'water') {
        setWaterNodes((nds) => nds.concat(newNode));
      } else {
        setNodes((nds) => nds.concat(newNode));
      }
    };

    window.addEventListener('custom-node-drop', handleCustomDrop);
    return () => window.removeEventListener('custom-node-drop', handleCustomDrop);
  }, [screenToFlowPosition, viewMode]);


  const {
    dailyConsumptionAh,
    autarkyStr,
    solarNodesCount,
    totalSolarVoltage,
    totalSolarAmps,
    hasDirectBatteryToConsumer,
    chargingTimeStr,
  } = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans relative">
      <div
        className={`transition-all duration-300 ease-in-out absolute md:relative z-40 h-full ${isLeftSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'} flex-shrink-0 shadow-xl bg-white/80 backdrop-blur-md max-w-[calc(100vw-2rem)]`}
      >
        <div className="w-64 h-full max-w-full">
          <Sidebar mode={viewMode} />
        </div>
      </div>

      <button
        onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 bg-white text-gray-700 hover:bg-gray-100 p-2 rounded shadow-md transition-all duration-300 border border-gray-200"
        style={{ left: isLeftSidebarOpen ? 'calc(16rem + 1rem)' : '1rem' }}
        title={isLeftSidebarOpen ? "Sidebar einklappen" : "Sidebar ausklappen"}
        aria-label={isLeftSidebarOpen ? "Linke Sidebar einklappen" : "Linke Sidebar ausklappen"}
      >
        {isLeftSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      <button
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 bg-white text-gray-700 hover:bg-gray-100 p-2 rounded shadow-md transition-all duration-300 border border-gray-200"
        style={{ right: isRightSidebarOpen ? 'calc(250px + 1rem)' : '1rem' }}
        title={isRightSidebarOpen ? "Inspector einklappen" : "Inspector ausklappen"}
        aria-label={isRightSidebarOpen ? "Rechte Sidebar einklappen" : "Rechte Sidebar ausklappen"}
      >
        {isRightSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-4 bg-white/80 backdrop-blur-md shadow-xl rounded-xl p-4 pointer-events-none w-[calc(100%-2rem)]">
          <div className="bg-white/80 backdrop-blur-md rounded shadow-xl flex items-center border border-gray-200 overflow-hidden mr-4 pointer-events-auto flex-wrap">
            <Link href="/" className="px-4 py-2 font-semibold text-sm transition-colors border-r bg-transparent text-gray-600 hover:bg-gray-50/50">
              Zurück zur Startseite
            </Link>
            <button
              className={`px-4 py-2 font-semibold text-sm transition-colors ${viewMode === 'electric' ? 'bg-orange-500 text-white' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
              onClick={() => setViewMode('electric')}
            >
              Elektrik-Schaltplan
            </button>
            <button
              className={`px-4 py-2 font-semibold text-sm transition-colors ${viewMode === 'water' ? 'bg-cyan-500 text-white' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
              onClick={() => setViewMode('water')}
            >
              Wasser & Sanitär
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white font-semibold">
                  Aktionen
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl p-2 min-w-56">
                <DropdownMenuItem onClick={exportBOM} className="cursor-pointer hover:bg-orange-50 text-orange-700 font-medium rounded-lg p-2 mb-1">
                  Stückliste an KI senden
                </DropdownMenuItem>
                <DropdownMenuItem onClick={autoWireSystem} className="cursor-pointer hover:bg-yellow-50 text-yellow-700 font-medium rounded-lg p-2 mb-1">
                  Automatisch Verkabeln & Absichern
                </DropdownMenuItem>
                <DropdownMenuItem onClick={checkSchematic} className="cursor-pointer hover:bg-red-50 text-red-700 font-medium rounded-lg p-2 mb-1">
                  Schaltplan von KI prüfen lassen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLayout} className="cursor-pointer hover:bg-indigo-50 text-indigo-700 font-medium rounded-lg p-2 mb-1">
                  Schaltplan aufräumen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportImage} className="cursor-pointer hover:bg-green-50 text-green-700 font-medium rounded-lg p-2">
                  Als Bild speichern
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="bg-white/80 backdrop-blur-md rounded shadow-xl flex items-center border border-gray-200 overflow-hidden flex-wrap">
              <button
                className={`px-4 py-2 font-semibold text-sm transition-colors ${season === 'summer' ? 'bg-yellow-400 text-yellow-900' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
                onClick={() => setSeason('summer')}
              >
                Sommer
              </button>
              <button
                className={`px-4 py-2 font-semibold text-sm transition-colors ${season === 'winter' ? 'bg-blue-400 text-blue-900' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
                onClick={() => setSeason('winter')}
              >
                Winter
              </button>
            </div>
          </div>

          <div className="ml-auto pointer-events-auto pl-4 border-l border-gray-300 flex items-center">
            <button
              onClick={toggleProMode}
              className={`font-semibold py-2 px-4 rounded-xl shadow-xl transition-colors border backdrop-blur-md ${isProMode ? 'bg-blue-500/90 hover:bg-blue-600/90 text-white border-blue-600' : 'bg-white/80 hover:bg-gray-50/90 text-gray-700 border-gray-200'}`}
            >
              {isProMode ? 'Profi-Modus An' : 'Profi-Modus Aus'}
            </button>
          </div>
        </div>
        {waterWarning && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-100 text-yellow-800 border border-yellow-300 p-4 rounded-xl shadow-xl font-semibold">
            {waterWarning}
          </div>
        )}
        <ReactFlow
          nodes={viewMode === 'water' ? waterNodes : nodes}
          edges={viewMode === 'water' ? waterEdges : edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={viewMode === 'water' ? onWaterNodesChange : onNodesChange}
          onEdgesChange={viewMode === 'water' ? onWaterEdgesChange : onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          snapToGrid={true}
          snapGrid={[10, 10]}
          deleteKeyCode={['Backspace', 'Delete']}
        >

          <Background color="#ccc" gap={16} />
          <Controls />
          <MiniMap />

          {viewMode === 'electric' && (
            <Panel position="top-center" className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-xl border border-gray-200 text-sm w-80">
              <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">System Berechnungen</h3>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Täglicher Gesamtverbrauch:</span>
                <span className="font-semibold text-gray-900">{dailyConsumptionAh.toFixed(1)} Ah</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Batterie-Autarkie (ohne Laden):</span>
                <span className="font-semibold text-gray-900">{autarkyStr}</span>
              </div>
              {solarNodesCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Solar-Array Output:</span>
                  <span className="font-semibold text-gray-900">{totalSolarVoltage}V / {totalSolarAmps.toFixed(1)}A</span>
                </div>
              )}
              {hasDirectBatteryToConsumer && (
                <div className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded border border-red-200">
                  Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!
                </div>
              )}
              </div>
            </Panel>
          )}

          {viewMode === 'electric' && calculatedSolarWatts > 0 && (
            <Panel position="bottom-center" className="bg-blue-50/90 backdrop-blur-md p-3 rounded-xl shadow border border-blue-200 text-blue-800 text-sm mb-4">
              <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung verfügbar. Du kannst nun deinen MPPT-Regler entsprechend dimensionieren.
            </Panel>
          )}
        </ReactFlow>

        {showBOM && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Stückliste (BOM)</h2>

              <div className="mb-4">
                <h3 className="font-semibold mb-2 text-gray-700">Komponenten:</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {Object.entries(generateBOM().counts).map(([type, count]) => (
                    <li key={type} className="capitalize">{count}x {type}</li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-gray-700">Kabelbedarf:</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {Object.entries(generateBOM().cableLengths).map(([cs, length]) => (
                    <li key={cs}>{length.toFixed(1)} Meter {cs} mm² Kabel</li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowBOM(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keeping existing BOMModal to not break any external dependencies, but the above renders first */}
        {showBOM && <BOMModal bom={generateBOM()} onClose={() => setShowBOM(false)} />}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out absolute right-0 md:relative z-40 h-full ${isRightSidebarOpen ? 'w-[250px] translate-x-0' : 'w-0 translate-x-full'} flex-shrink-0 shadow-xl bg-white/80 backdrop-blur-md max-w-[calc(100vw-2rem)]`}
      >
        <div className="w-[250px] h-full max-w-full">
          <Inspector
            selectedEdge={selectedEdge}
            selectedNode={selectedNode}
            onChangeLength={handleChangeLength}
            onChangeCrossSection={handleChangeCrossSection}
            onDelete={deleteSelected}
            onUpdateNodeData={updateNodeData}
            edges={edges}
            chargingTimeStr={chargingTimeStr}
            calculatedSolarWatts={calculatedSolarWatts}
          />
        </div>
      </div>
    </div>
  );
}

export default function Planner() {
  return (
    <ReactFlowProvider>
      <PlannerInner />
    </ReactFlowProvider>
  );
}
