import { useMemo, useRef } from 'react';
import { BatteryNodeData, ConsumerNodeData, SolarNodeData, ChargerNodeData } from '@/components/nodes/types';
import { Node, Edge } from 'reactflow';

export function useDashboardMetrics(
  nodes: Node[],
  edges: Edge[],
  season: 'summer' | 'winter',
  calculatedSolarWatts: number
) {
  // Performance Optimization: 
  // We only care about the type, data, and connections. We explicitly ignore 'position' 
  // to avoid recalculating heavy metrics on every frame during a drag event.
  // Instead of JSON.stringify, we use a manual check to only update a memo key when needed.

  const lastNodesRef = useRef<Node[]>(nodes);
  const lastEdgesRef = useRef<Edge[]>(edges);

  // Check if nodes have changed in a way that affects metrics
  // We use JSON.stringify for data comparison to handle deep changes while avoiding it for the whole array
  let nodesChanged = nodes !== lastNodesRef.current;
  if (nodesChanged) {
    if (nodes.length !== lastNodesRef.current.length) {
      nodesChanged = true;
    } else {
      nodesChanged = false;
      for (let i = 0, len = nodes.length; i < len; i++) {
        const n = nodes[i];
        const prev = lastNodesRef.current[i];
        if (!prev || n.id !== prev.id || n.type !== prev.type || (n.data !== prev.data && JSON.stringify(n.data) !== JSON.stringify(prev.data))) {
          nodesChanged = true;
          break;
        }
      }
    }
  }

  // Check if edges have changed in a way that affects metrics
  // Original logic: serializedEdges = JSON.stringify(edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })));
  // Note: Original logic DID NOT include e.data for edges.
  let edgesChanged = edges !== lastEdgesRef.current;
  if (edgesChanged) {
    if (edges.length !== lastEdgesRef.current.length) {
      edgesChanged = true;
    } else {
      edgesChanged = false;
      for (let i = 0, len = edges.length; i < len; i++) {
        const e = edges[i];
        const prev = lastEdgesRef.current[i];
        if (
          !prev ||
          e.id !== prev.id ||
          e.source !== prev.source ||
          e.target !== prev.target ||
          e.sourceHandle !== prev.sourceHandle ||
          e.targetHandle !== prev.targetHandle
        ) {
          edgesChanged = true;
          break;
        }
      }
    }
  }

  if (nodesChanged || edgesChanged) {
    lastNodesRef.current = nodes;
    lastEdgesRef.current = edges;
  }

  const significantNodes = lastNodesRef.current;
  const significantEdges = lastEdgesRef.current;

  return useMemo(() => {
    const categories = categorizeNodes(significantNodes);

    const usableCapacityAh = calculateUsableCapacity(categories.batteryNode);

    const dailyConsumptionAh = calculateDailyConsumption(
      categories.consumers,
      categories.consumers230v,
      categories.hasInverter,
      season
    );

    const autarkyStr = calculateAutarky(usableCapacityAh, dailyConsumptionAh);

    const { totalSolarAmps, totalSolarVoltage } = calculateSolarMetrics(
      categories.solarNodes,
      significantEdges,
      categories.nodeTypeMap,
      season
    );

    const chargingTimeStr = calculateChargingTime(
      categories.chargers,
      totalSolarAmps,
      calculatedSolarWatts,
      usableCapacityAh,
      categories.solarNodes.length
    );

    const hasDirectBatteryToConsumer = checkDirectBatteryConnection(
      significantEdges,
      categories.nodeTypeMap
    );

    return {
      dailyConsumptionAh,
      autarkyStr,
      chargingTimeStr,
      totalSolarVoltage,
      totalSolarAmps,
      hasDirectBatteryToConsumer,
      solarNodesCount: categories.solarNodes.length,
    };
  }, [significantNodes, significantEdges, season, calculatedSolarWatts]);
}

// --- Helper Functions ---

function categorizeNodes(nodes: Node[]) {
  const result = {
    nodeTypeMap: {} as Record<string, string | undefined>,
    batteryNode: undefined as Node | undefined,
    consumers: [] as Node[],
    consumers230v: [] as Node[],
    hasInverter: false,
    solarNodes: [] as Node[],
    chargers: [] as Node[],
  };

  for (let i = 0, len = nodes.length; i < len; i++) {
    const n = nodes[i];
    result.nodeTypeMap[n.id] = n.type;
    const type = n.type;

    if (type === 'battery') {
      if (!result.batteryNode) result.batteryNode = n;
    } else if (type === 'consumer') {
      result.consumers.push(n);
    } else if (type === 'consumer230v') {
      result.consumers230v.push(n);
    } else if (type === 'inverter') {
      result.hasInverter = true;
    } else if (type === 'solar') {
      result.solarNodes.push(n);
    } else if (type === 'charger') {
      result.chargers.push(n);
    }
  }

  return result;
}

function calculateUsableCapacity(batteryNode: Node | undefined): number {
  const capacityAh = (batteryNode?.data as BatteryNodeData)?.capacity || 0;
  const chemistry = (batteryNode?.data as BatteryNodeData)?.chemistry || 'LiFePO4';
  const dod = chemistry === 'AGM' ? 0.5 : 0.9;
  return capacityAh * dod;
}

function calculateDailyConsumption(
  consumers: Node[],
  consumers230v: Node[],
  hasInverter: boolean,
  season: 'summer' | 'winter'
): number {
  let dailyConsumptionAh = consumers.reduce((acc, n) => {
    const w = (n.data as ConsumerNodeData)?.watts || 0;
    const h = (n.data as ConsumerNodeData)?.hours || 0;
    return acc + (w / 12) * h;
  }, 0);

  if (hasInverter) {
    const inverterConsumptionAh = consumers230v.reduce((acc, n) => {
      const w = (n.data as ConsumerNodeData)?.watts || 0;
      const h = (n.data as ConsumerNodeData)?.hours || 0;
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

  return dailyConsumptionAh;
}

function calculateAutarky(usableCapacityAh: number, dailyConsumptionAh: number): string {
  let autarkyHours = 0;
  if (usableCapacityAh === 0 && dailyConsumptionAh === 0) {
    autarkyHours = Infinity;
  } else if (usableCapacityAh === 0) {
    autarkyHours = 0;
  } else if (dailyConsumptionAh > 0) {
    autarkyHours = usableCapacityAh / (dailyConsumptionAh / 24);
  } else {
    autarkyHours = Infinity;
  }

  const autarkyDays =
    autarkyHours === Infinity ? 'Unendlich' : Math.floor(autarkyHours / 24);
  const autarkyRemainderHours =
    autarkyHours === Infinity ? 0 : Math.round(autarkyHours % 24);

  return autarkyHours === Infinity
      ? 'Unendlich'
      : `${autarkyDays} Tage / ${autarkyRemainderHours} Stunden`;
}

function calculateSolarMetrics(
  solarNodes: Node[],
  significantEdges: Edge[],
  nodeTypeMap: Record<string, string | undefined>,
  season: 'summer' | 'winter'
) {
  let totalSolarAmps = 0;
  let totalSolarVoltage = 0;

  if (solarNodes.length > 0) {
    // Basic heuristic for the demo:
    // If we find an edge between two solars from plus to minus, it's series.
    const hasSeriesConnection = significantEdges.some((e) => {
      const sType = nodeTypeMap[e.source];
      const tType = nodeTypeMap[e.target];
      return (
        sType === 'solar' &&
        tType === 'solar' &&
        ((e.sourceHandle?.includes('plus') &&
          e.targetHandle?.includes('minus')) ||
          (e.sourceHandle?.includes('minus') &&
            e.targetHandle?.includes('plus')))
      );
    });

    if (hasSeriesConnection) {
      // Series: Voltage adds up, Amps stays the same (take min or average, here we assume identical panels so we take the first)
      totalSolarVoltage = solarNodes.reduce(
        (acc, n) => acc + ((n.data as SolarNodeData)?.voltage || 0),
        0
      );
      totalSolarAmps = (solarNodes[0]?.data as SolarNodeData)?.amps || 0;
    } else {
      // Parallel: Amps add up, Voltage stays the same
      totalSolarAmps = solarNodes.reduce(
        (acc, n) => acc + ((n.data as SolarNodeData)?.amps || 0),
        0
      );
      totalSolarVoltage = (solarNodes[0]?.data as SolarNodeData)?.voltage || 0;
    }

    // Seasonal yield reduction for solar
    if (season === 'winter') {
      totalSolarAmps *= 0.2; // Significant reduction in winter
    }
  }

  return { totalSolarAmps, totalSolarVoltage };
}

function calculateChargingTime(
  chargers: Node[],
  totalSolarAmps: number,
  calculatedSolarWatts: number,
  usableCapacityAh: number,
  solarNodesCount: number
): string {
  const totalChargerAmps =
    chargers.reduce((acc, n) => acc + (((n.data as ChargerNodeData)?.amps || 0) * (((n.data as ChargerNodeData)?.efficiency ?? 100) / 100)), 0) +
    totalSolarAmps +
    calculatedSolarWatts / 12;

  let chargingTimeStr = 'N/A';
  if (totalChargerAmps > 0) {
    const chargingTime = (usableCapacityAh / totalChargerAmps) * 1.15;
    chargingTimeStr = `${chargingTime.toFixed(1)} Stunden`;
  } else if (
    chargers.length > 0 ||
    solarNodesCount > 0 ||
    calculatedSolarWatts > 0
  ) {
    chargingTimeStr = '0 Ladeleistung';
  } else {
    chargingTimeStr = 'Kein Ladegerät';
  }

  return chargingTimeStr;
}

function checkDirectBatteryConnection(
  significantEdges: Edge[],
  nodeTypeMap: Record<string, string | undefined>
): boolean {
  return significantEdges.some((e) => {
    const sourceType = nodeTypeMap[e.source];
    const targetType = nodeTypeMap[e.target];
    if (!sourceType || !targetType) return false;

    return (
      (sourceType === 'battery' &&
        (targetType === 'consumer' ||
          targetType === 'consumer230v' ||
          targetType === 'inverter')) ||
      (targetType === 'battery' &&
        (sourceType === 'consumer' ||
          sourceType === 'consumer230v' ||
          sourceType === 'inverter'))
    );
  });
}
