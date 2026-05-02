"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Edge,
  Node,
  OnConnect,
  addEdge,
  Panel,
  ReactFlowProvider,
  OnSelectionChangeParams,
  useReactFlow,
  useNodesState,
  useEdgesState,
  getOutgoers,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CableEdge, { CableEdgeData } from './edges/CableEdge';
import BatteryNode from './nodes/BatteryNode';
import ConsumerNode from './nodes/ConsumerNode';
import ChargerNode from './nodes/ChargerNode';
import FuseNode from './nodes/FuseNode';
import ShorePowerNode from './nodes/ShorePowerNode';
import Consumer230VNode from './nodes/Consumer230VNode';
import InverterNode from './nodes/InverterNode';
import SolarNode from './nodes/SolarNode';
import GroundNode from './nodes/GroundNode';
import RoofWindowNode from './nodes/RoofWindowNode';
import RoofSolarNode from './nodes/RoofSolarNode';
import Inspector from './Inspector';
import Sidebar from './Sidebar';
import dagre from 'dagre';
import { toPng } from 'html-to-image';

const NODE_TYPES = {
  battery: BatteryNode,
  consumer: ConsumerNode,
  charger: ChargerNode,
  fuse: FuseNode,
  shorePower: ShorePowerNode,
  consumer230v: Consumer230VNode,
  inverter: InverterNode,
  solar: SolarNode,
  ground: GroundNode,
  roofWindow: RoofWindowNode,
  roofSolar: RoofSolarNode
};

const EDGE_TYPES = { cableEdge: CableEdge };

const initialNodes: Node[] = [
  {
    id: 'battery',
    type: 'battery',
    position: { x: 100, y: 100 },
    data: { capacity: 100, chemistry: 'LiFePO4' },
  },
  {
    id: 'fuse-box',
    type: 'default',
    position: { x: 400, y: 100 },
    data: { label: 'Sicherungskasten' },
    style: { border: '1px solid #777', padding: 10, borderRadius: 5, background: '#fff' }
  },
  {
    id: 'consumer-1',
    type: 'consumer',
    position: { x: 700, y: 50 },
    data: { watts: 60, hours: 12 },
  },
  {
    id: 'charger-1',
    type: 'charger',
    position: { x: 100, y: 300 },
    data: { amps: 30 },
  },
];

const initialEdges: Edge<CableEdgeData>[] = [
  {
    id: 'e-battery-fuse',
    source: 'battery',
    target: 'fuse-box',
    type: 'cableEdge',
    data: {
      length: 3,
      crossSection: 6,
    },
  },
  {
    id: 'e-fuse-consumer',
    source: 'fuse-box',
    target: 'consumer-1',
    type: 'cableEdge',
    data: {
      length: 5,
      crossSection: 2.5,
    },
  },
  {
    id: 'e-charger-battery',
    source: 'charger-1',
    target: 'battery',
    type: 'cableEdge',
    data: {
      length: 2,
      crossSection: 10,
    },
  },
];

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200;
  const nodeHeight = 100;

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

function PlannerInner() {
  const [viewMode, setViewMode] = useState<'electric' | 'roof'>('electric');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CableEdgeData>(initialEdges);
  const [roofNodes, setRoofNodes, onRoofNodesChange] = useNodesState<Node>([]);
  const [roofEdges, setRoofEdges, onRoofEdgesChange] = useEdgesState([]);

  const [season, setSeason] = useState<'summer' | 'winter'>('summer');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isProMode, setIsProMode] = useState(false);

  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);

  // We map selected edges backwards for Inspector.tsx (which currently expects a single selected edge)
  const selectedEdgeId = selectedEdges.length > 0 ? selectedEdges[0].id : null;
  const selectedNodeId = selectedNodes.length > 0 ? selectedNodes[0].id : null;

  const { screenToFlowPosition, fitView } = useReactFlow();

  const toggleProMode = useCallback(() => {
    setIsProMode((prev) => {
      const nextMode = !prev;
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.type === 'cableEdge') {
            return {
              ...edge,
              data: {
                ...edge.data,
                length: edge.data?.length ?? 3,
                isProMode: nextMode,
              },
            } as Edge<CableEdgeData>;
          }
          return edge;
        })
      );
      return nextMode;
    });
  }, []);

  const isValidConnection = useCallback(
    (connection: Connection) => {
      // Pre-check for polarity matching
      const sHandle = connection.sourceHandle || '';
      const tHandle = connection.targetHandle || '';

      const sIsPlus = sHandle.includes('plus');
      const tIsPlus = tHandle.includes('plus');
      const sIsMinus = sHandle.includes('minus');
      const tIsMinus = tHandle.includes('minus');

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

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
      const hasCycle = (node: Node, visited = new Set()) => {
        if (visited.has(node.id)) return false;

        visited.add(node.id);

        for (const outgoer of getOutgoers(node, nodes, edges)) {
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
          isProMode: isProMode,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds) as Edge<CableEdgeData>[]);
    },
    [isProMode]
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes);
    setSelectedEdges(params.edges);
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedNodes.length > 0) {
      const nodeIds = selectedNodes.map(n => n.id);
      setNodes((nds) => nds.filter((n) => !nodeIds.includes(n.id)));
      setRoofNodes((nds) => nds.filter((n) => !nodeIds.includes(n.id)));
      // Also delete connected edges
      setEdges((eds) => eds.filter((e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)));
      setRoofEdges((eds) => eds.filter((e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)));
      setSelectedNodes([]);
    }
    if (selectedEdges.length > 0) {
      const edgeIds = selectedEdges.map(e => e.id);
      setEdges((eds) => eds.filter((e) => !edgeIds.includes(e.id)));
      setRoofEdges((eds) => eds.filter((e) => !edgeIds.includes(e.id)));
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
    setRoofNodes((nds) =>
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
      } else if (type === 'roofWindow') {
        newNode.data = { ...newNode.data, width: 40, height: 40 };
      } else if (type === 'roofSolar') {
        newNode.data = { ...newNode.data, width: 100, height: 60, watts: 100 };
      }

      if (viewMode === 'roof') {
        setRoofNodes((nds) => nds.concat(newNode));
      } else {
        setNodes((nds) => nds.concat(newNode));
      }
    },
    [screenToFlowPosition, viewMode]
  );

  // --- Calculations for Dashboard ---
  const batteryNode = nodes.find((n) => n.type === 'battery');
  const capacityAh = (batteryNode?.data as any)?.capacity || 0;
  const chemistry = (batteryNode?.data as any)?.chemistry || 'LiFePO4';
  const dod = chemistry === 'AGM' ? 0.5 : 0.9;
  const usableCapacityAh = capacityAh * dod;

  const consumers = nodes.filter((n) => n.type === 'consumer');
  const consumers230v = nodes.filter((n) => n.type === 'consumer230v');

  // Has an inverter in the circuit to power 230v devices?
  const hasInverter = nodes.some(n => n.type === 'inverter');

  let dailyConsumptionAh = consumers.reduce((acc, n) => {
    const w = (n.data as any)?.watts || 0;
    const h = (n.data as any)?.hours || 0;
    return acc + (w / 12) * h;
  }, 0);

  if (hasInverter) {
    const inverterConsumptionAh = consumers230v.reduce((acc, n) => {
      const w = (n.data as any)?.watts || 0;
      const h = (n.data as any)?.hours || 0;
      // Inverter takes 12V from battery, loses 15% efficiency (0.85)
      // Ah = (W / 12V) * h / 0.85
      return acc + ((w / 12) * h) / 0.85;
    }, 0);
    dailyConsumptionAh += inverterConsumptionAh;
  }

  // Seasonal adjustment for consumption
  if (season === 'winter') {
    dailyConsumptionAh *= 2;
  } else {
    dailyConsumptionAh *= 1.5;
  }

  // Autarky duration: Capacity * DoD / (Daily Consumption / 24)
  let autarkyHours = 0;
  if (dailyConsumptionAh > 0) {
    autarkyHours = usableCapacityAh / (dailyConsumptionAh / 24);
  } else if (usableCapacityAh > 0) {
    autarkyHours = Infinity;
  }
  const autarkyDays = autarkyHours === Infinity ? 'Unendlich' : Math.floor(autarkyHours / 24);
  const autarkyRemainderHours = autarkyHours === Infinity ? 0 : Math.round(autarkyHours % 24);
  const autarkyStr = autarkyHours === Infinity ? 'Unendlich' : `${autarkyDays} Tage / ${autarkyRemainderHours} Stunden`;

  // Solar calculation (Series vs Parallel)
  const solarNodes = nodes.filter(n => n.type === 'solar');
  let totalSolarAmps = 0;
  let totalSolarVoltage = 0;

  if (solarNodes.length > 0) {
    // Basic heuristic for the demo:
    // If we find an edge between two solars from plus to minus, it's series.
    const hasSeriesConnection = edges.some(e => {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      return s?.type === 'solar' && t?.type === 'solar' &&
             ((e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
              (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus')));
    });

    if (hasSeriesConnection) {
      // Series: Voltage adds up, Amps stays the same (take min or average, here we assume identical panels so we take the first)
      totalSolarVoltage = solarNodes.reduce((acc, n) => acc + ((n.data as any)?.voltage || 0), 0);
      totalSolarAmps = (solarNodes[0]?.data as any)?.amps || 0;
    } else {
      // Parallel: Amps add up, Voltage stays the same
      totalSolarAmps = solarNodes.reduce((acc, n) => acc + ((n.data as any)?.amps || 0), 0);
      totalSolarVoltage = (solarNodes[0]?.data as any)?.voltage || 0;
    }

    // Seasonal yield reduction for solar
    if (season === 'winter') {
      totalSolarAmps *= 0.2; // Significant reduction in winter
    }
  }

  const totalRoofSolarWatts = roofNodes.filter((n) => n.type === 'roofSolar').reduce((acc, n) => acc + ((n.data as any)?.watts || 0), 0);

  // Charging time: Capacity * DoD / ChargerAmps * 1.15
  const chargers = nodes.filter((n) => n.type === 'charger');
  const totalChargerAmps = chargers.reduce((acc, n) => acc + ((n.data as any)?.amps || 0), 0) + totalSolarAmps + (totalRoofSolarWatts / 12);
  let chargingTimeStr = 'N/A';
  if (totalChargerAmps > 0) {
    const chargingTime = (usableCapacityAh / totalChargerAmps) * 1.15;
    chargingTimeStr = `${chargingTime.toFixed(1)} Stunden`;
  } else if (chargers.length > 0 || solarNodes.length > 0 || totalRoofSolarWatts > 0) {
    chargingTimeStr = '0 Ladeleistung';
  } else {
    chargingTimeStr = 'Kein Ladegerät';
  }

  // Check for direct connection from battery to consumer without fuse
  const hasDirectBatteryToConsumer = edges.some(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    const targetNode = nodes.find(n => n.id === e.target);
    if (!sourceNode || !targetNode) return false;

    return (sourceNode.type === 'battery' && (targetNode.type === 'consumer' || targetNode.type === 'consumer230v' || targetNode.type === 'inverter')) ||
           (targetNode.type === 'battery' && (sourceNode.type === 'consumer' || sourceNode.type === 'consumer230v' || sourceNode.type === 'inverter'));
  });

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
      >
        {isLeftSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      <button
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 bg-white text-gray-700 hover:bg-gray-100 p-2 rounded shadow-md transition-all duration-300 border border-gray-200"
        style={{ right: isRightSidebarOpen ? 'calc(250px + 1rem)' : '1rem' }}
        title={isRightSidebarOpen ? "Inspector einklappen" : "Inspector ausklappen"}
      >
        {isRightSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="bg-white/80 backdrop-blur-md rounded shadow-xl flex items-center border border-gray-200 overflow-hidden mr-4">
            <button
              className={`px-4 py-2 font-semibold text-sm transition-colors ${viewMode === 'electric' ? 'bg-orange-500 text-white' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
              onClick={() => setViewMode('electric')}
            >
              Elektrik-Schaltplan
            </button>
            <button
              className={`px-4 py-2 font-semibold text-sm transition-colors ${viewMode === 'roof' ? 'bg-blue-500 text-white' : 'bg-transparent text-gray-600 hover:bg-gray-50/50'}`}
              onClick={() => setViewMode('roof')}
            >
              Dach-Planer
            </button>
          </div>

          <button
            onClick={exportBOM}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded shadow-md transition-colors"
          >
            Stückliste an KI senden
          </button>

          <button
            onClick={onLayout}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded shadow-md transition-colors"
          >
            Schaltplan aufräumen
          </button>

          <button
            onClick={onExportImage}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded shadow-md transition-colors"
          >
            Als Bild speichern
          </button>

          <div className="bg-white/80 backdrop-blur-md rounded shadow-xl flex items-center border border-gray-200 overflow-hidden">
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

          <button
            onClick={toggleProMode}
            className={`font-semibold py-2 px-4 rounded-xl shadow-xl transition-colors border backdrop-blur-md ${isProMode ? 'bg-blue-500/90 hover:bg-blue-600/90 text-white border-blue-600' : 'bg-white/80 hover:bg-gray-50/90 text-gray-700 border-gray-200'}`}
          >
            {isProMode ? 'Profi-Modus (CAD-Optik) An' : 'Profi-Modus (CAD-Optik) Aus'}
          </button>
        </div>
        <ReactFlow
          nodes={viewMode === 'roof' ? roofNodes : nodes}
          edges={viewMode === 'roof' ? roofEdges : edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={viewMode === 'roof' ? onRoofNodesChange : onNodesChange}
          onEdgesChange={viewMode === 'roof' ? onRoofEdgesChange : onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          snapToGrid={true}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          {viewMode === 'roof' && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl border-4 border-gray-400 flex items-center justify-center text-gray-300 font-bold text-4xl"
              style={{ width: 520, height: 316, zIndex: -1 }}
            >
              L1 Fahrzeugdach
            </div>
          )}

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
              <div className="flex justify-between">
                <span className="text-gray-600">Ladezeit (komplett leer bis voll):</span>
                <span className="font-semibold text-gray-900">{chargingTimeStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Eingehende Ladeleistung (Dach):</span>
                <span className="font-semibold text-gray-900">{totalRoofSolarWatts} W</span>
              </div>
              {solarNodes.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Solar-Array Output:</span>
                  <span className="font-semibold text-gray-900">{totalSolarVoltage}V / {totalSolarAmps.toFixed(1)}A</span>
                </div>
              )}
              {hasDirectBatteryToConsumer && (
                <div className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded border border-red-200">
                  ⚠️ Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!
                </div>
              )}
              </div>
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

              <button
                onClick={() => setShowBOM(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        )}
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
