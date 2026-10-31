import { useMemo, useState, useEffect } from 'react';
import { AUTARKY_NOT_CALCULATED } from '../utils/autarky';
import {
  type BatteryNodeData,
  type ConsumerNodeData,
  type SolarNodeData,
  type ChargerNodeData,
  type InverterNodeData,
} from '@/components/nodes/types';
import { type Node, type Edge } from '@xyflow/react';
import { getSystemVoltage } from '../utils/voltage';
import { safeText } from '../../../lib/safeText'; // AUDIT T1
import {
  isStarterBatteryNode,
  VDE_INVERTER_EFFICIENCY,
  VDE_BATTERY_DOD,
  VDE_DOD_REFERENCE,
  VDE_SOLAR_WINTER_REDUCTION,
  VDE_SOLAR_VMP_VOLTAGE,
  VDE_CHARGE_DERATING_FACTOR,
} from '@/lib/vde-standards';
import {
  normalizeBatteryChemistry,
  peukertExponentOf,
  usableCapacityWithPeukertAh,
} from '../../../lib/peukert'; // DOM-002-Nachpflege

/** Ohne eingetragenen Verbrauch gibt es keine Autonomiezeit — weder 0 noch „unendlich“. */

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
          n.data?.hours !== prev.data?.hours ||
          n.data?.nominalVoltage !== prev.data?.nominalVoltage ||
          n.data?.chemistry !== prev.data?.chemistry ||
          n.data?.role !== prev.data?.role ||
          n.data?.label !== prev.data?.label ||
          n.data?.peukertExponent !== prev.data?.peukertExponent ||
          n.data?.efficiency !== prev.data?.efficiency ||
          n.data?.voltage !== prev.data?.voltage ||
          n.data?.continuousPower !== prev.data?.continuousPower ||
          n.data?.idleWatts !== prev.data?.idleWatts ||
          n.data?.idleW !== prev.data?.idleW
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

    // AUDIT DOM-002-Nachpflege (Peukert): erst die Last bestimmen, dann die
    // nutzbare Kapazität peukert-gewichtet — der Faktor hängt von der
    // Dauerstromhöhe ab (Tagesdurchschnitt). Nennkapazität×DoD allein
    // überschätzte die Autarkie gerade bei stark belasteten Blei-Bänken.
    const dailyConsumptionAh = calculateDailyConsumption(
      categories.consumers,
      categories.consumers230v,
      categories.inverters,
      season,
      sysVoltage
    );

    const usableCapacityAh = calculateUsableCapacity(categories.batteries, dailyConsumptionAh / 24);
    const nominalCapacityAh = categories.batteries.reduce((sum, batteryNode) => {
      const capacity = Number((batteryNode.data as BatteryNodeData | undefined)?.capacity);
      return sum + (Number.isFinite(capacity) && capacity > 0 ? capacity : 0);
    }, 0);

    const autarkyStr = calculateAutarky(usableCapacityAh, dailyConsumptionAh);

    const { totalSolarAmps, totalSolarVoltage, seasonalSolarWatts } = calculateSolarMetrics(
      categories.solarNodes,
      debouncedEdges,
      categories.nodeTypeMap,
      season
    );

    const chargingTimeStr = calculateChargingTime(
      categories.chargers,
      totalSolarAmps,
      seasonalSolarWatts,
      calculatedSolarWatts,
      nominalCapacityAh,
      categories.solarNodes.length,
      season,
      sysVoltage
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
  const allBatteries: Node[] = [];
  const result = {
    nodeTypeMap: {} as Record<string, string | undefined>,
    batteryNode: undefined as Node | undefined,
    batteries: [] as Node[],
    consumers: [] as Node[],
    consumers230v: [] as Node[],
    inverters: [] as Node[],
    solarNodes: [] as Node[],
    chargers: [] as Node[],
  };

  for (const n of nodes) {
    result.nodeTypeMap[n.id] = n.type;
    switch (n.type) {
      case 'battery':
        allBatteries.push(n);
        break;
      case 'consumer':
        result.consumers.push(n);
        break;
      case 'consumer230v':
        result.consumers230v.push(n);
        break;
      case 'inverter':
        result.inverters.push(n);
        break;
      case 'solar':
        result.solarNodes.push(n);
        break;
      case 'charger':
      case 'mpptController':
      case 'dcdcCharger':
      case 'acBatteryCharger':
        result.chargers.push(n);
        break;
    }
  }

  // K1: Die Fahrzeug-Starterbatterie dient dem Motorstart und darf NICHT in
  // die nutzbare Aufbau-Kapazität, Autarkie oder Ladezeit eingerechnet werden.
  result.batteries = allBatteries.filter((n) => !isStarterBatteryNode(n));
  result.batteryNode = result.batteries[0];

  return result;
}

function calculateUsableCapacity(batteries: Node[], averageSystemCurrentA = 0): number {
  const count = batteries.length || 1;
  const shareA = averageSystemCurrentA > 0 ? averageSystemCurrentA / count : 0;
  return batteries.reduce((acc, batteryNode) => {
    const data = batteryNode?.data as BatteryNodeData | undefined;
    const capacityAh = Math.max(0, Number(data?.capacity) || 0);
    const chemistry = normalizeBatteryChemistry(data?.chemistry) ?? 'LiFePO4';
    const dod = VDE_BATTERY_DOD[chemistry] ?? VDE_DOD_REFERENCE;
    return acc + usableCapacityWithPeukertAh(capacityAh, dod, shareA, peukertExponentOf(data));
  }, 0);
}

function calculateDailyConsumption(
  consumers: Node[],
  consumers230v: Node[],
  inverters: Node[],
  season: 'summer' | 'winter',
  sysVoltage: number
): number {
  let dailyConsumptionAh = consumers.reduce((acc, n) => {
    const w = Math.max(0, Number((n.data as ConsumerNodeData)?.watts) || 0);
    const h = Math.max(0, Number((n.data as ConsumerNodeData)?.hours) || 0);
    let consumption = (w / sysVoltage) * h;

    // Seasonal adjustment only for heaters
    const label = safeText(n.data?.label).toLowerCase();
    const isHeater =
      n.type === 'heater' || label.includes('heiz') || label.includes('heater') || label.includes('autoterm');

    if (isHeater && season === 'winter') {
      consumption *= 2;
    }

    return acc + consumption;
  }, 0);

  let maxAcHours = 0;
  const inverterConsumptionAh = consumers230v.reduce((acc, n) => {
    const w = Math.max(0, Number((n.data as ConsumerNodeData)?.watts) || 0);
    const h = Math.max(0, Number((n.data as ConsumerNodeData)?.hours) || 0);
    if (w > 0 && h > maxAcHours) {
      maxAcHours = h;
    }
    // Inverter takes system voltage from battery, loses 15% (VDE_INVERTER_EFFICIENCY)
    return acc + ((w / sysVoltage) * h) / VDE_INVERTER_EFFICIENCY;
  }, 0);
  dailyConsumptionAh += inverterConsumptionAh;

  // M3: Eigenverbrauch / Leerlaufaufnahme aktiver Wechselrichter einbeziehen.
  if (inverters.length > 0) {
    for (const inv of inverters) {
      const data = inv.data as (InverterNodeData & { idleW?: number }) | undefined;
      const idleWatts = Math.max(0, Number(data?.idleWatts ?? data?.idleW) || 0);
      if (idleWatts <= 0) continue;
      const explicitHours = data?.hours !== undefined ? Number(data.hours) : undefined;
      const activeHours =
        explicitHours !== undefined && Number.isFinite(explicitHours) && explicitHours >= 0
          ? Math.min(24, explicitHours)
          : maxAcHours > 0
            ? Math.min(24, maxAcHours)
            : 24;
      dailyConsumptionAh += (idleWatts * activeHours) / sysVoltage;
    }
  }

  return dailyConsumptionAh;
}

function calculateAutarky(usableCapacityAh: number, dailyConsumptionAh: number): string {
  // QA B-02: Eine Vorlage ohne Verbrauchsangaben zeigte „Unendlich“. Das ist
  // falsch — die Autonomie ist ohne Verbrauch nicht bestimmt.
  if (!(dailyConsumptionAh > 0)) return AUTARKY_NOT_CALCULATED;
  if (usableCapacityAh <= 0) return '0 Tage / 0 Stunden';
  const autarkyHours = usableCapacityAh / (dailyConsumptionAh / 24);
  return `${Math.floor(autarkyHours / 24)} Tage / ${Math.floor(autarkyHours % 24)} Stunden`;
}

function calculateSolarMetrics(
  solarNodes: Node[],
  edges: Edge[],
  nodeTypeMap: Record<string, string | undefined>,
  season: 'summer' | 'winter'
) {
  let totalSolarAmps = 0;
  let totalSolarVoltage = 0;
  let rawSolarWatts = 0;

  if (solarNodes.length > 0) {
    let hasSeriesConnection = false;
    for (const e of edges) {
      if (nodeTypeMap[e.source] === 'solar' && nodeTypeMap[e.target] === 'solar') {
        if (
          (e.sourceHandle === 'plus' && e.targetHandle === 'minus') ||
          (e.sourceHandle === 'minus' && e.targetHandle === 'plus')
        ) {
          hasSeriesConnection = true;
          break;
        }
      }
    }

    for (const s of solarNodes) {
      const sData = s.data as SolarNodeData | undefined;
      const v = Math.max(0, Number(sData?.voltage) || 0);
      const a = Math.max(0, Number(sData?.amps) || 0);
      const w = Math.max(0, Number(sData?.watts) || 0);
      rawSolarWatts += w > 0 ? w : v * a;
    }

    if (hasSeriesConnection) {
      let minAmps = Infinity;
      for (const s of solarNodes) {
        const sData = s.data as SolarNodeData;
        totalSolarVoltage += Math.max(0, Number(sData?.voltage) || 0);
        const amps = Math.max(0, Number(sData?.amps) || 0);
        if (amps < minAmps) minAmps = amps;
      }
      totalSolarAmps = minAmps === Infinity ? 0 : minAmps;
    } else {
      let maxV = 0;
      for (const s of solarNodes) {
        const sData = s.data as SolarNodeData;
        totalSolarAmps += Math.max(0, Number(sData?.amps) || 0);
        const v = Math.max(0, Number(sData?.voltage) || 0);
        if (v > maxV) maxV = v;
      }
      totalSolarVoltage = maxV;
    }
  }

  // Winterreduktion zentral aus VDE_SOLAR_WINTER_REDUCTION (0.35 = 35% Ertrag)
  const winterFactor = season === 'winter' ? VDE_SOLAR_WINTER_REDUCTION : 1;
  if (season === 'winter') {
    totalSolarAmps *= winterFactor;
  }

  return {
    totalSolarAmps,
    totalSolarVoltage,
    seasonalSolarWatts: rawSolarWatts * winterFactor,
  };
}

function calculateChargingTime(
  chargers: Node[],
  totalSolarAmps: number,
  seasonalSolarWatts: number,
  calculatedSolarWatts: number,
  nominalCapacityAh: number,
  solarNodesCount: number,
  season: 'summer' | 'winter',
  sysVoltage: number
): string {
  const mpptControllers = chargers.filter((c) => c.type === 'mpptController');
  const otherChargers = chargers.filter((c) => c.type !== 'mpptController');

  let totalChargerAmps = 0;
  for (const ch of otherChargers) {
    const chData = ch.data as ChargerNodeData;
    // `amps` ist der AUSGANGS-Nennstrom des Ladegeräts. Der Wirkungsgrad
    // gehört auf die Eingangsseite; ihn hier abzuziehen verkürzte die
    // angezeigte Ladezeit künstlich (Regression).
    const rawAmps = Math.max(0, Number(chData?.amps) || 0);
    totalChargerAmps += rawAmps;
  }

  const winterFactor = season === 'winter' ? VDE_SOLAR_WINTER_REDUCTION : 1;
  const fallbackPvWatts = calculatedSolarWatts > 0 ? calculatedSolarWatts * winterFactor : 0;
  const availablePvWatts = solarNodesCount > 0 ? seasonalSolarWatts : fallbackPvWatts;

  // K2: MPPT-Laderegler und PV-Module bilden EINEN gemeinsamen Ladepfad.
  // Vorher wurden Regler-Nennstrom (z. B. 20 A) UND Modulstrom (z. B. 10 A)
  // addiert (= 30 A aus 200 W!). Korrekt ist min(MPPT-Ausgangsgrenze, PV-Leistung / Systemspannung).
  if (mpptControllers.length > 0) {
    let mpptMaxAmps = 0;
    let weightedEffNumerator = 0;
    let rawMpptSum = 0;
    for (const mppt of mpptControllers) {
      const mData = mppt.data as ChargerNodeData;
      const rawAmps = Math.max(0, Number(mData?.amps) || 0);
      const eff = (Math.max(0, Number(mData?.efficiency)) || 95) / 100;
      // Ausgangsgrenze = Nennstrom des Reglers; der Wirkungsgrad steckt
      // bereits in der PV→Batterie-Umrechnung (pvBatteryAmps).
      mpptMaxAmps += rawAmps;
      weightedEffNumerator += rawAmps * eff;
      rawMpptSum += rawAmps;
    }
    if (solarNodesCount > 0 || calculatedSolarWatts > 0) {
      const avgEff = rawMpptSum > 0 ? weightedEffNumerator / rawMpptSum : 0.95;
      const pvBatteryAmps =
        availablePvWatts > 0 && sysVoltage > 0 ? (availablePvWatts * avgEff) / sysVoltage : totalSolarAmps;
      totalChargerAmps += Math.min(mpptMaxAmps, pvBatteryAmps);
    }
  } else if (solarNodesCount > 0) {
    totalChargerAmps += totalSolarAmps;
  } else if (calculatedSolarWatts > 0) {
    // Solar-Arbeitsspannung zentral aus VDE_SOLAR_VMP_VOLTAGE (18V typ. 12V-Modul)
    totalChargerAmps += fallbackPvWatts / VDE_SOLAR_VMP_VOLTAGE;
  }

  let chargingTimeStr = 'Kein Ladegerät';
  if (totalChargerAmps > 0 && nominalCapacityAh > 0) {
    // Ladeverlustfaktor zentral aus VDE_CHARGE_DERATING_FACTOR (1.15 = +15% CC/CV).
    // „0–100 %" lädt die NENNkapazität. Die nutzbare (DoD-reduzierte)
    // Kapazität gilt für die Autarkie, nicht für den Ladehub.
    const chargingTime = (nominalCapacityAh / totalChargerAmps) * VDE_CHARGE_DERATING_FACTOR;
    chargingTimeStr = `${chargingTime.toFixed(1)} Stunden`;
  } else if (chargers.length > 0 || solarNodesCount > 0 || calculatedSolarWatts > 0) {
    chargingTimeStr = '0 Ladeleistung';
  }
  return chargingTimeStr;
}

function checkDirectBatteryConnection(
  edges: Edge[],
  nodeTypeMap: Record<string, string | undefined>
): boolean {
  for (const e of edges) {
    const sType = nodeTypeMap[e.source];
    const tType = nodeTypeMap[e.target];
    if (
      (sType === 'battery' && (tType === 'consumer' || tType === 'consumer230v' || tType === 'inverter')) ||
      (tType === 'battery' && (sType === 'consumer' || sType === 'consumer230v' || sType === 'inverter'))
    ) {
      return true;
    }
  }
  return false;
}
