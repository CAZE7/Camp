import { useMemo, useState, useEffect } from 'react';
import { BatteryNodeData, ConsumerNodeData, SolarNodeData, ChargerNodeData } from '@/components/nodes/types';
import { Node, Edge } from 'reactflow';
import { getSystemVoltage } from '../utils/voltage';
import {
  VDE_INVERTER_EFFICIENCY,
  VDE_BATTERY_DOD,
  VDE_SOLAR_WINTER_REDUCTION,
  VDE_SOLAR_VMP_VOLTAGE,
  VDE_CHARGE_DERATING_FACTOR,
} from '@/lib/vde-standards';

export function useDashboardMetrics(
  nodes: Node[],
  edges: Edge[],
  season: 'summer' | 'winter',
  calculatedSolarWatts: number
) {
  const [debouncedNodes, setDebouncedNodes] = useState(nodes);
  const [debouncedEdges, setDebouncedEdges] = useState(edges);

  useEffect(() => {
    const nodesChanged =
      nodes.length !== debouncedNodes.length ||
      nodes.some((n, i) => {
        const prev = debouncedNodes[i];
        if (!prev) return true;
        return (
          n.id !== prev.id ||
          n.type !== prev.type ||
          n.data?.watts !== prev.data?.watts ||
          n.data?.capacity !== prev.data?.capacity ||
          n.data?.amps !== prev.data?.amps ||
          n.data?.hours !== prev.data?.hours
        );
      });

    const edgesChanged =
      edges.length !== debouncedEdges.length ||
      edges.some((e, i) => {
        const prev = debouncedEdges[i];
        if (!prev) return true;
        return (
          e.id !== prev.id ||
          e.source !== prev.source ||
          e.target !== prev.target ||
          e.sourceHandle !== prev.sourceHandle ||
          e.targetHandle !== prev.targetHandle ||
          JSON.stringify(e.data) !== JSON.stringify(prev.data)
        );
      });

    if (nodesChanged || edgesChanged) {
      const handler = setTimeout(() => {
        if (nodesChanged) setDebouncedNodes(nodes);
        if (edgesChanged) setDebouncedEdges(edges);
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [nodes, edges, debouncedNodes, debouncedEdges]);

  return useMemo(() => {
    const sysVoltage = getSystemVoltage(debouncedNodes);

    const categories = categorizeNodes(debouncedNodes);

    const usableCapacityAh = calculateUsableCapacity(categories.batteries);

    const dailyConsumptionAh = calculateDailyConsumption(
      categories.consumers,
      categories.consumers230v,
      categories.hasInverter,
      season,
      sysVoltage
    );

    const autarkyStr = calculateAutarky(usableCapacityAh, dailyConsumptionAh);

    const { totalSolarAmps, totalSolarVoltage } = calculateSolarMetrics(
      categories.solarNodes,
      debouncedEdges,
      categories.nodeTypeMap,
      season
    );

    const chargingTimeStr = calculateChargingTime(
      categories.chargers,
      totalSolarAmps,
      calculatedSolarWatts,
      usableCapacityAh,
      categories.solarNodes.length,
      season
    );

    const hasDirectBatteryToConsumer = checkDirectBatteryConnection(debouncedEdges, categories.nodeTypeMap);

    return {
      dailyConsumptionAh,
      autarkyStr,
      chargingTimeStr,
      totalSolarVoltage,
      totalSolarAmps,
      hasDirectBatteryToConsumer,
      solarNodesCount: categories.solarNodes.length,
    };
  }, [debouncedNodes, debouncedEdges, season, calculatedSolarWatts]);
}

// --- Helper Functions ---

function categorizeNodes(nodes: Node[]) {
  const result = {
    nodeTypeMap: {} as Record<string, string | undefined>,
    batteryNode: undefined as Node | undefined,
    batteries: [] as Node[],
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
      result.batteries.push(n);
    } else if (type === 'consumer') {
      result.consumers.push(n);
    } else if (type === 'consumer230v') {
      result.consumers230v.push(n);
    } else if (type === 'inverter') {
      result.hasInverter = true;
    } else if (type === 'solar') {
      result.solarNodes.push(n);
    } else if (['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(type as string)) {
      result.chargers.push(n);
    }
  }

  return result;
}

function calculateUsableCapacity(batteries: Node[]): number {
  return batteries.reduce((acc, batteryNode) => {
    const capacityAh = (batteryNode?.data as BatteryNodeData)?.capacity || 0;
    const chemistry = (batteryNode?.data as BatteryNodeData)?.chemistry || 'LiFePO4';
    const dod = VDE_BATTERY_DOD[chemistry] ?? VDE_BATTERY_DOD.LiFePO4;
    return acc + capacityAh * dod;
  }, 0);
}

function calculateDailyConsumption(
  consumers: Node[],
  consumers230v: Node[],
  hasInverter: boolean,
  season: 'summer' | 'winter',
  sysVoltage: number
): number {
  let dailyConsumptionAh = consumers.reduce((acc, n) => {
    const w = (n.data as ConsumerNodeData)?.watts || 0;
    const h = (n.data as ConsumerNodeData)?.hours || 0;
    let consumption = (w / sysVoltage) * h;

    // Seasonal adjustment only for heaters
    const label = String(n.data?.label || '').toLowerCase();
    const isHeater =
      n.type === 'heater' || label.includes('heiz') || label.includes('heater') || label.includes('autoterm');

    if (isHeater && season === 'winter') {
      consumption *= 2;
    }

    return acc + consumption;
  }, 0);

  const inverterConsumptionAh = consumers230v.reduce((acc, n) => {
    const w = (n.data as ConsumerNodeData)?.watts || 0;
    const h = (n.data as ConsumerNodeData)?.hours || 0;
    // Inverter takes system voltage from battery, loses 15% (VDE_INVERTER_EFFICIENCY)
    return acc + ((w / sysVoltage) * h) / VDE_INVERTER_EFFICIENCY;
  }, 0);
  dailyConsumptionAh += inverterConsumptionAh;

  return dailyConsumptionAh;
}

function calculateAutarky(usableCapacityAh: number, dailyConsumptionAh: number): string {
  let autarkyHours: number;
  if (usableCapacityAh === 0 && dailyConsumptionAh === 0) {
    autarkyHours = Infinity;
  } else if (usableCapacityAh === 0) {
    autarkyHours = 0;
  } else if (dailyConsumptionAh > 0) {
    autarkyHours = usableCapacityAh / (dailyConsumptionAh / 24);
  } else {
    autarkyHours = Infinity;
  }

  const autarkyDays = autarkyHours === Infinity ? 'Unendlich' : Math.floor(autarkyHours / 24);
  const autarkyRemainderHours = autarkyHours === Infinity ? 0 : Math.floor(autarkyHours % 24);

  return autarkyHours === Infinity ? 'Unendlich' : `${autarkyDays} Tage / ${autarkyRemainderHours} Stunden`;
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
        ((e.sourceHandle?.includes('plus') && e.targetHandle?.includes('minus')) ||
          (e.sourceHandle?.includes('minus') && e.targetHandle?.includes('plus')))
      );
    });

    if (hasSeriesConnection) {
      // Series: Voltage adds up, Amps stays the same (take min or average, here we assume identical panels so we take the first)
      totalSolarVoltage = solarNodes.reduce((acc, n) => acc + ((n.data as SolarNodeData)?.voltage || 0), 0);
      totalSolarAmps = (solarNodes[0]?.data as SolarNodeData)?.amps || 0;
    } else {
      // Parallel: Amps add up, Voltage stays the same
      totalSolarAmps = solarNodes.reduce((acc, n) => acc + ((n.data as SolarNodeData)?.amps || 0), 0);
      totalSolarVoltage = (solarNodes[0]?.data as SolarNodeData)?.voltage || 0;
    }

    // Seasonal yield reduction for solar
    if (season === 'winter') {
      const winterReductionFactor = VDE_SOLAR_WINTER_REDUCTION;
      totalSolarAmps *= winterReductionFactor;
    }
  }

  return { totalSolarAmps, totalSolarVoltage };
}

function calculateChargingTime(
  chargers: Node[],
  totalSolarAmps: number,
  calculatedSolarWatts: number,
  usableCapacityAh: number,
  solarNodesCount: number,
  season: 'summer' | 'winter'
): string {
  const hasCanvasSolar = solarNodesCount > 0;
  const effectiveSolarWatts = hasCanvasSolar ? 0 : calculatedSolarWatts;
  const effectiveSolarAmps = hasCanvasSolar ? totalSolarAmps : 0;

  // The roof planner solar (effectiveSolarWatts) must apply a winter reduction to match canvas logic.
  const seasonFactor = season === 'winter' ? VDE_SOLAR_WINTER_REDUCTION : 1;

  // Validated calculation step.
  // Solar panels output at Vmp, not system voltage
  const roofSolarAmps = (effectiveSolarWatts / VDE_SOLAR_VMP_VOLTAGE) * seasonFactor;

  const totalChargerAmps =
    chargers.reduce(
      (acc, n) =>
        acc +
        ((n.data as ChargerNodeData)?.amps || 0) * (((n.data as ChargerNodeData)?.efficiency ?? 100) / 100),
      0
    ) +
    effectiveSolarAmps +
    roofSolarAmps;

  let chargingTimeStr: string;
  if (totalChargerAmps > 0) {
    const chargingTime = (usableCapacityAh / totalChargerAmps) * VDE_CHARGE_DERATING_FACTOR;
    chargingTimeStr = `${chargingTime.toFixed(1)} Stunden`;
  } else if (chargers.length > 0 || solarNodesCount > 0 || calculatedSolarWatts > 0) {
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
        (targetType === 'consumer' || targetType === 'consumer230v' || targetType === 'inverter')) ||
      (targetType === 'battery' &&
        (sourceType === 'consumer' || sourceType === 'consumer230v' || sourceType === 'inverter'))
    );
  });
}
