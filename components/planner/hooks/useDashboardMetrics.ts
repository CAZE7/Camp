import { useMemo } from 'react';
import { Node, Edge } from 'reactflow';

export function useDashboardMetrics(
  nodes: Node[],
  edges: Edge[],
  season: 'summer' | 'winter',
  calculatedSolarWatts: number
) {
  return useMemo(() => {
    // --- Calculations for Dashboard ---
    const batteryNode = nodes.find((n) => n.type === 'battery');
    const capacityAh = (batteryNode?.data as any)?.capacity || 0;
    const chemistry = (batteryNode?.data as any)?.chemistry || 'LiFePO4';
    const dod = chemistry === 'AGM' ? 0.5 : 0.9;
    const usableCapacityAh = capacityAh * dod;

    const consumers = nodes.filter((n) => n.type === 'consumer');
    const consumers230v = nodes.filter((n) => n.type === 'consumer230v');

    // Has an inverter in the circuit to power 230v devices?
    const hasInverter = nodes.some((n) => n.type === 'inverter');

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
    const autarkyDays =
      autarkyHours === Infinity ? 'Unendlich' : Math.floor(autarkyHours / 24);
    const autarkyRemainderHours =
      autarkyHours === Infinity ? 0 : Math.round(autarkyHours % 24);
    const autarkyStr =
      autarkyHours === Infinity
        ? 'Unendlich'
        : `${autarkyDays} Tage / ${autarkyRemainderHours} Stunden`;

    // Solar calculation (Series vs Parallel)
    const solarNodes = nodes.filter((n) => n.type === 'solar');
    let totalSolarAmps = 0;
    let totalSolarVoltage = 0;

    if (solarNodes.length > 0) {
      // Basic heuristic for the demo:
      // If we find an edge between two solars from plus to minus, it's series.
      const hasSeriesConnection = edges.some((e) => {
        const s = nodes.find((n) => n.id === e.source);
        const t = nodes.find((n) => n.id === e.target);
        return (
          s?.type === 'solar' &&
          t?.type === 'solar' &&
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
    const chargers = nodes.filter((n) => n.type === 'charger');
    const totalChargerAmps =
      chargers.reduce((acc, n) => acc + ((n.data as any)?.amps || 0), 0) +
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
    const hasDirectBatteryToConsumer = edges.some((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const targetNode = nodes.find((n) => n.id === e.target);
      if (!sourceNode || !targetNode) return false;

      return (
        (sourceNode.type === 'battery' &&
          (targetNode.type === 'consumer' ||
            targetNode.type === 'consumer230v' ||
            targetNode.type === 'inverter')) ||
        (targetNode.type === 'battery' &&
          (sourceNode.type === 'consumer' ||
            sourceNode.type === 'consumer230v' ||
            sourceNode.type === 'inverter'))
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
  }, [nodes, edges, season, calculatedSolarWatts]);
}
