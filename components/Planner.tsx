"use client";

import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CableEdge, { CableEdgeData } from './edges/CableEdge';
import BatteryNode from './nodes/BatteryNode';
import ConsumerNode from './nodes/ConsumerNode';
import ChargerNode from './nodes/ChargerNode';
import Inspector from './Inspector';

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

export default function Planner() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge<CableEdgeData>[]>(initialEdges);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const edgeTypes = useMemo(() => ({ cableEdge: CableEdge }), []);
  const nodeTypes = useMemo(() => ({ battery: BatteryNode, consumer: ConsumerNode, charger: ChargerNode }), []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds) as Edge<CableEdgeData>[]);

      // If the selected edge is removed, clear selection
      const removedEdgeIds = changes.filter(c => c.type === 'remove').map(c => (c as any).id);
      if (selectedEdgeId && removedEdgeIds.includes(selectedEdgeId)) {
        setSelectedEdgeId(null);
      }
    },
    [selectedEdgeId]
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
        },
      };
      setEdges((eds) => addEdge(newEdge, eds) as Edge<CableEdgeData>[]);
      setSelectedEdgeId(newEdge.id); // Select new edge automatically
    },
    []
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

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

  const exportBOM = useCallback(() => {
    const bom = {
      nodes: nodes.map(n => ({ id: n.id, label: n.data.label || n.type })),
      cables: edges.map(e => ({
        id: e.id,
        length: e.data?.length,
      }))
    };

    // Dispatch a custom event to notify the Chat component
    const event = new CustomEvent('export-bom', { detail: bom });
    window.dispatchEvent(event);
  }, [nodes, edges]);

  // --- Calculations for Dashboard ---
  const batteryNode = nodes.find((n) => n.type === 'battery');
  const capacityAh = batteryNode?.data.capacity || 0;
  const chemistry = batteryNode?.data.chemistry || 'LiFePO4';
  const dod = chemistry === 'AGM' ? 0.5 : 0.9;
  const usableCapacityAh = capacityAh * dod;

  const consumers = nodes.filter((n) => n.type === 'consumer');
  const dailyConsumptionAh = consumers.reduce((acc, n) => {
    const w = n.data.watts || 0;
    const h = n.data.hours || 0;
    return acc + (w / 12) * h;
  }, 0);

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

  // Charging time: Capacity * DoD / ChargerAmps * 1.15
  const chargers = nodes.filter((n) => n.type === 'charger');
  const totalChargerAmps = chargers.reduce((acc, n) => acc + (n.data.amps || 0), 0);
  let chargingTimeStr = 'N/A';
  if (totalChargerAmps > 0) {
    const chargingTime = (usableCapacityAh / totalChargerAmps) * 1.15;
    chargingTimeStr = `${chargingTime.toFixed(1)} Stunden`;
  } else if (chargers.length > 0) {
    chargingTimeStr = '0 Ladeleistung';
  } else {
    chargingTimeStr = 'Kein Ladegerät';
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans">
      <div className="flex-1 h-full relative">
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={exportBOM}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded shadow-md transition-colors"
          >
            Stückliste an KI senden
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
          <Panel position="top-right" className="bg-white p-4 rounded-md shadow-lg border border-gray-200 text-sm w-80">
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
            </div>
          </Panel>
        </ReactFlow>
      </div>
      <Inspector
        selectedEdge={selectedEdge}
        onChangeLength={handleChangeLength}
        onChangeCrossSection={handleChangeCrossSection}
      />
    </div>
  );
}
