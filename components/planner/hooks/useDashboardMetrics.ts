import { useMemo, useRef } from 'react';
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
  const nodesChanged = nodes !== lastNodesRef.current && (
    nodes.length !== lastNodesRef.current.length ||
    nodes.some((n, i) => {
      const prev = lastNodesRef.current[i];
      return !prev || n.id !== prev.id || n.type !== prev.type || JSON.stringify(n.data) !== JSON.stringify(prev.data);
    })
  );

  // Check if edges have changed in a way that affects metrics
  // Original logic: serializedEdges = JSON.stringify(edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })));
  // Note: Original logic DID NOT include e.data for edges.
  const edgesChanged = edges !== lastEdgesRef.current && (
    edges.length !== lastEdgesRef.current.length ||
    edges.some((e, i) => {
      const prev = lastEdgesRef.current[i];
      return !prev ||
        e.id !== prev.id ||
        e.source !== prev.source ||
        e.target !== prev.target ||
        e.sourceHandle !== prev.sourceHandle ||
        e.targetHandle !== prev.targetHandle;
    })
  );

  if (nodesChanged || edgesChanged) {
    lastNodesRef.current = nodes;
    lastEdgesRef.current = edges;
  }

  const significantNodes = lastNodesRef.current;
  const significantEdges = lastEdgesRef.current;

  return useMemo(() => {
    // Single pass to categorize nodes and precompute node types
    const {
      nodeTypeMap,
      batteryNode,
      consumers,
      consumers230v,
      hasInverter,
      solarNodes,
      chargers,
    } = significantNodes.reduce(
      (acc, n) => {
        acc.nodeTypeMap[n.id] = n.type;

        if (n.type === 'battery') {
          if (!acc.batteryNode) acc.batteryNode = n;
        } else if (n.type === 'consumer') {
          acc.consumers.push(n);
        } else if (n.type === 'consumer230v') {
          acc.consumers230v.push(n);
        } else if (n.type === 'inverter') {
          acc.hasInverter = true;
        } else if (n.type === 'solar') {
          acc.solarNodes.push(n);
        } else if (n.type === 'charger') {
          acc.chargers.push(n);
        }

        return acc;
      },
      {
        nodeTypeMap: {} as Record<string, string | undefined>,
        batteryNode: undefined as Node | undefined,
        consumers: [] as Node[],
        consumers230v: [] as Node[],
        hasInverter: false,
        solarNodes: [] as Node[],
        chargers: [] as Node[],
      }
    );

    // --- Calculations for Dashboard ---
    const capacityAh = (batteryNode?.data as any)?.capacity || 0;
    const chemistry = (batteryNode?.data as any)?.chemistry || 'LiFePO4';
    const dod = chemistry === 'AGM' ? 0.5 : 0.9;
    const usableCapacityAh = capacityAh * dod;

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
    } else {
      autarkyHours = Infinity;
    }
    const autarkyDays =
      autarkyHours === Infinity ? 'Unendlich' : Math.floor(autarkyHours / 24);
    const autarkyRemainderHours =
      autarkyHours === Infinity ? 0 : Math.round(autarkyHours % 24);
    const autarkyStr =
      autarkyHours === Infinity
        ? 'Unendlich'
        : `${autarkyDays} Tage / ${autarkyRemainderHours} Stunden`;

    // Solar calculation (Series vs Parallel)
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
          (acc, n) => acc + ((n.data as any)?.voltage || 0),
          0
        );
        totalSolarAmps = (solarNodes[0]?.data as any)?.amps || 0;
      } else {
        // Parallel: Amps add up, Voltage stays the same
        totalSolarAmps = solarNodes.reduce(
          (acc, n) => acc + ((n.data as any)?.amps || 0),
          0
        );
        totalSolarVoltage = (solarNodes[0]?.data as any)?.voltage || 0;
      }

      // Seasonal yield reduction for solar
      if (season === 'winter') {
        totalSolarAmps *= 0.2; // Significant reduction in winter
      }
    }

    // Charging time: Capacity * DoD / ChargerAmps * 1.15
    const totalChargerAmps =
      chargers.reduce((acc, n) => acc + (((n.data as any)?.amps || 0) * (((n.data as any)?.efficiency ?? 100) / 100)), 0) +
      totalSolarAmps +
      calculatedSolarWatts / 12;
    let chargingTimeStr = 'N/A';
    if (totalChargerAmps > 0) {
      const chargingTime = (usableCapacityAh / totalChargerAmps) * 1.15;
      chargingTimeStr = `${chargingTime.toFixed(1)} Stunden`;
    } else if (
      chargers.length > 0 ||
      solarNodes.length > 0 ||
      calculatedSolarWatts > 0
    ) {
      chargingTimeStr = '0 Ladeleistung';
    } else {
      chargingTimeStr = 'Kein Ladegerät';
    }

    // Check for direct connection from battery to consumer without fuse
    const hasDirectBatteryToConsumer = significantEdges.some((e) => {
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

    return {
      dailyConsumptionAh,
      autarkyStr,
      chargingTimeStr,
      totalSolarVoltage,
      totalSolarAmps,
      hasDirectBatteryToConsumer,
      solarNodesCount: solarNodes.length,
    };
  }, [significantNodes, significantEdges, season, calculatedSolarWatts]);
}
